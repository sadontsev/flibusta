FROM ghcr.io/linuxserver/calibre:latest

# Create directory for our tiny API server
USER root
RUN apk add --no-cache python3 py3-pip || (apt-get update && apt-get install -y python3 && rm -rf /var/lib/apt/lists/*) || true

WORKDIR /opt/calibre-svc
COPY server.py ./server.py

# Default port for the HTTP wrapper
ENV CALIBRE_HTTP_PORT=7090

# linuxserver/calibre image runs as abc user; switch back to it
USER abc

EXPOSE 7090

# Start Xvfb/Calibre base init and our API after; use s6-overlay if present, but fallback to python
# Many linuxserver images use s6 as init; to keep simple, run our server as the container command.
CMD ["python3", "server.py"]
