FROM ollama/ollama:latest
ENV OLLAMA_HOST=0.0.0.0:11434
ENV OLLAMA_MODELS=/data/models
EXPOSE 11434
COPY start.sh /start.sh
RUN chmod +x /start.sh
ENTRYPOINT ["/bin/sh", "/start.sh"]
