#!/bin/sh
set -eu

: "${PORT:=10000}"
: "${MODEL_PROXY_KEY:?MODEL_PROXY_KEY is required}"
MODEL_NAME="${MODEL_NAME:-qwen2.5:0.5b}"

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
  proxy_connect_timeout 10s;
  proxy_read_timeout 300s;
  proxy_send_timeout 300s;
  proxy_buffering off;

  server {
    listen ${PORT};
    server_name _;

    # Liveness: Render must be able to see that the container is alive while
    # the model is still being downloaded/loaded. Model readiness is exposed
    # separately through /ready.
    location = /health {
      default_type application/json;
      add_header Cache-Control "no-store";
      return 200 '{"status":"ok","service":"morok-ollama"}';
    }

    location = /ready {
      if (!-f /tmp/morok-ready) { return 503; }
      proxy_http_version 1.1;
      proxy_set_header Host \$host;
      proxy_pass http://127.0.0.1:11434/api/tags;
      proxy_intercept_errors off;
    }

    location / {
      # Do not send model requests to Ollama until the configured model is
      # actually installed. This makes the API receive a retryable 503
      # instead of a misleading model-not-found/502 during cold start.
      if (!-f /tmp/morok-ready) { return 503; }

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

echo "Verificando modelo ${MODEL_NAME}..."
if ! ollama list | awk 'NR > 1 {print $1}' | grep -Fxq "${MODEL_NAME}"; then
  echo "Modelo não encontrado; baixando ${MODEL_NAME}..."
  downloaded=0
  for attempt in 1 2 3; do
    if ollama pull "${MODEL_NAME}"; then
      downloaded=1
      break
    fi
    echo "Tentativa de download do modelo falhou ($attempt/3)." >&2
    sleep 5
  done
  if [ "$downloaded" -ne 1 ]; then
    echo "Não foi possível baixar ${MODEL_NAME}." >&2
    exit 1
  fi
fi

if ! ollama list | awk 'NR > 1 {print $1}' | grep -Fxq "${MODEL_NAME}"; then
  echo "Modelo ${MODEL_NAME} não está disponível após o pull." >&2
  exit 1
fi

touch /tmp/morok-ready
echo "Morok Ollama pronto."
while kill -0 "${OLLAMA_PID}" 2>/dev/null && kill -0 "${NGINX_PID}" 2>/dev/null; do
  sleep 2
done
if ! kill -0 "${OLLAMA_PID}" 2>/dev/null; then
  echo "Ollama encerrou inesperadamente." >&2
else
  echo "Nginx encerrou inesperadamente." >&2
fi
exit 1
