FROM ollama/ollama:latest

ENV OLLAMA_HOST=0.0.0.0:11434 \
    OLLAMA_MODELS=/data/models \
    OLLAMA_NUM_PARALLEL=1 \
    OLLAMA_MAX_LOADED_MODELS=1 \
    OLLAMA_KEEP_ALIVE=5m \
    OLLAMA_FLASH_ATTENTION=0 \
    OLLAMA_KV_CACHE_TYPE=q4_0 \
    OLLAMA_CONTEXT_LENGTH=512

EXPOSE 10000

# Keep the expensive OS-package layer before application files so
# changes to start.sh do not invalidate the package-install cache.
RUN apt-get update \
  && apt-get install -y --no-install-recommends nginx apache2-utils curl \
  && rm -rf /var/lib/apt/lists/*

COPY start.sh /start.sh
RUN chmod +x /start.sh

ENTRYPOINT ["/bin/sh", "/start.sh"]
