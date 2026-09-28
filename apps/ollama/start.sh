#!/bin/sh
set -eu

: "${PORT:=10000}"
: "${MODEL_PROXY_KEY:?MODEL_PROXY_KEY is required}"

if [ "${#MODEL_PROXY_KEY}" -lt 24 ]; then
  echo "MODEL_PROXY_KEY must contain at least 24 characters." >&2
  exit 1
fi

printf 'morok:%s\n' "$(htpasswd -nbB morok "$MODEL_PROXY_KEY" | cut -d: -f2-)" > /etc/nginx/.htpasswd
chmod 600 /etc/nginx/.htpasswd

cat > /etc/nginx/nginx.conf <<EOF
worker_processes 1;
pid /tmp/nginx.pid;
error_log /dev/stderr warn;

events {
  worker_connections 128;
}

http {
  access_log /dev/stdout;
  client_max_body_size 10m;
  proxy_connect_timeout 5s;
  proxy_read_timeout 120s;
  proxy_send_timeout 120s;
  proxy_buffering off;

  server {
    listen ${PORT};
    listen [::]:${PORT};
    server_name _;

    location = /health {
      proxy_http_version 1.1;
      proxy_set_header Host \$host;
      proxy_set_header X-Real-IP \$remote_addr;
      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto \$scheme;
      proxy_pass http://127.0.0.1:11434/api/tags;
      proxy_intercept_errors off;
    }

    location / {
      auth_basic "Morok Ollama";
      auth_basic_user_file /etc/nginx/.htpasswd;

      proxy_http_version 1.1;
      proxy_set_header Host \$host;
      proxy_set_header X-Real-IP \$remote_addr;
      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto \$scheme;
      proxy_set_header Connection "";
      proxy_pass http://127.0.0.1:11434;
      proxy_intercept_errors off;
    }
  }
}
EOF

echo "Iniciando Ollama..."
OLLAMA_HOST=0.0.0.0:11434 ollama serve &
OLLAMA_PID=$!

echo "Iniciando proxy HTTP..."
nginx -t
nginx -g 'daemon off;' &
NGINX_PID=$!

cleanup() {
  kill "${OLLAMA_PID}" 2>/dev/null || true
  kill "${NGINX_PID}" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "Aguardando API interna do Ollama..."
until curl -fsS http://127.0.0.1:11434/api/tags >/dev/null 2>&1; do
  if ! kill -0 "${OLLAMA_PID}" 2>/dev/null; then
    echo "Ollama encerrou antes de ficar pronto." >&2
    exit 1
  fi
  sleep 1
done

echo "Garantindo modelo qwen2.5:0.5b..."
ollama pull qwen2.5:0.5b

if ! ollama list | awk 'NR > 1 {print $1}' | grep -Fxq "qwen2.5:0.5b"; then
  echo "Modelo qwen2.5:0.5b não está disponível após o pull." >&2
  exit 1
fi

echo "Morok Ollama pronto."
wait "${OLLAMA_PID}"
