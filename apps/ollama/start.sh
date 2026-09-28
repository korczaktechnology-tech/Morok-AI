#!/bin/sh
set -eu

ollama serve &
OLLAMA_PID=$!

echo "Aguardando Ollama..."
until ollama list >/dev/null 2>&1; do
  sleep 1
done

echo "Garantindo modelo qwen2.5:0.5b..."
ollama pull qwen2.5:0.5b

wait "$OLLAMA_PID"
