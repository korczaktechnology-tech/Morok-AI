FROM ollama/ollama:latest
ENV OLLAMA_HOST=0.0.0.0:11434
ENV OLLAMA_MODELS=/data/models
ENV OLLAMA_NUM_PARALLEL=1
ENV OLLAMA_MAX_LOADED_MODELS=1
ENV OLLAMA_KEEP_ALIVE=5m
ENV OLLAMA_FLASH_ATTENTION=0
ENV OLLAMA_KV_CACHE_TYPE=q8_0
ENV OLLAMA_CONTEXT_LENGTH=2048
EXPOSE 10000
COPY start.sh /start.sh
RUN apt-get update \
  && apt-get install -y --no-install-recommends nginx apache2-utils curl \
  && rm -rf /var/lib/apt/lists/* \
  && chmod +x /start.sh
ENTRYPOINT ["/bin/sh", "/start.sh"]
