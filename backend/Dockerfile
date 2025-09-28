############################
# Stage 1: Builder
############################
FROM node:22-bookworm-slim AS builder
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ curl unzip ca-certificates git \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci
COPY . .
RUN npm run build

# Optional: stamp assets with a fresh version (if script exists)
RUN node scripts/stamp-assets.js || true

############################
# Stage 2: Runtime
############################
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    DEBIAN_FRONTEND=noninteractive

# System deps needed for calibre & rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
  curl wget xz-utils ca-certificates fontconfig python3 \
    libx11-6 libnss3 libxrender1 libxext6 libxi6 libglib2.0-0 libgl1 libuuid1 \
    libegl1 libopengl0 libxcb-cursor0 libxkbcommon0 libxkbcommon-x11-0 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Install Calibre (official installer)
ENV CALIBRE_INSTALL_DIR=/opt/calibre
RUN wget -O /tmp/linux-installer.sh https://download.calibre-ebook.com/linux-installer.sh \
  && ln -sf /usr/bin/python3 /usr/bin/python \
  && bash /tmp/linux-installer.sh install_dir=/opt isolated=true ignore_umask=true \
  && ln -sf /opt/calibre/ebook-convert /usr/bin/ebook-convert \
  && rm -f /tmp/linux-installer.sh || true

# Copy build artefacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

RUN mkdir -p logs cache/authors cache/covers cache/converted /tmp/conversions

# Ensure unprivileged user exists and has write access to app and temp conversion dir
RUN useradd -m -u 1001 nodeuser \
  && chown -R nodeuser:nodeuser /app \
  && chown -R nodeuser:nodeuser /tmp/conversions
USER nodeuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:3000/health || exit 1

ENV ENABLE_CALIBRE=1 \
    CALIBRE_CONVERSION_TIMEOUT_MS=180000 \
    SKIP_DB_INIT=0

CMD ["node", "dist/app.js"]
