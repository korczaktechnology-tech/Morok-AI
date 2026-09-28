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
  proxy_read_timeout 120s;
  proxy_send_timeout 120s;

  server {
    listen ${PORT};
    listen [::]:${PORT};
    server_name _;

    location = /health {
      default_type text/plain;
      return 200 "ok\n";
    }

    location / {
      auth_basic "Morok Ollama";
      auth_basic_user_file /etc/nginx/.htpasswd;

      proxy_http_version 1.1;
      proxy_set_header Host \$host;
      proxy_set_header X-Real-IP \$remote_addr;
      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto \$scheme;
      proxy_pass http://127.0.0.1:11434;
    }
  }
}
EOF

OLLAMA_HOST=0.0.0.0:11434 ollama serve &
OLLAMA_PID=$!

echo "Aguardando Ollama..."
until ollama list >/dev/null 2>&1; do
  sleep 1
done

nginx -t
nginx -g 'daemon off;' &
NGINX_PID=$!

echo "Garantindo modelo qwen2.5:0.5b..."
ollama pull qwen2.5:0.5b

wait "$OLLAMA_PID"
