FROM ollama/ollama:latest
ENV OLLAMA_HOST=127.0.0.1:11434
ENV OLLAMA_MODELS=/data/models
EXPOSE 10000
COPY start.sh /start.sh
RUN apt-get update \
  && apt-get install -y --no-install-recommends nginx apache2-utils \
  && rm -rf /var/lib/apt/lists/* \
  && chmod +x /start.sh
ENTRYPOINT ["/bin/sh", "/start.sh"]
