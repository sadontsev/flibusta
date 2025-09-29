#!/bin/bash
set -e

# Fast local build + runtime Docker image approach
# Avoids transferring 9GB+ of context by pre-building locally

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${PROJECT_ROOT}/backend"

echo "🏗️  Local pre-build + lightweight Docker deployment"
echo "Backend directory: ${BACKEND_DIR}"

# Change to backend directory
cd "${BACKEND_DIR}"

# Check if we have Node.js locally
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Node.js not found. Please install Node.js locally or use full Docker build."
    exit 1
fi

echo "📦 Installing/updating dependencies..."
npm ci

echo "🔨 Building TypeScript..."
npm run build

echo "🐳 Building lightweight runtime Docker image..."
# Use a runtime-only Dockerfile that just copies pre-built artifacts
# Temporarily use runtime-specific dockerignore to include dist/public
mv .dockerignore .dockerignore.build-backup 2>/dev/null || true
cp .dockerignore.runtime .dockerignore
docker build -f Dockerfile.runtime -t flibusta-backend .
# Restore original dockerignore
mv .dockerignore.build-backup .dockerignore 2>/dev/null || true

echo "✅ Build complete! Runtime image ready."
echo "💡 To deploy with pre-built image:"
echo "    docker compose -f docker-compose.yml -f docker-compose.local.yml up -d"
echo "💡 Or use: make quick-deploy-local"
