# ==============================================================================
# Lehar AI — Multi-Stage Production Dockerfile (SIH26067)
# Stage 1: Build React 19 + TypeScript + Vite Frontend Static Bundle
# Stage 2: Serve Unified FastAPI Backend + Static SPA from Python 3.12 Slim
# ==============================================================================

# --- STAGE 1: FRONTEND BUILDER ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Install npm dependencies with clean cache
COPY package*.json ./
RUN npm ci

# Copy frontend source code and compile production bundle
COPY index.html tsconfig*.json vite.config.ts postcss.config.js tailwind.config.js ./
COPY public ./public
COPY src ./src

RUN npm run build

# --- STAGE 2: PRODUCTION FASTAPI RUNNER ---
FROM python:3.12-slim AS production
WORKDIR /app

# Install system utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Install Python backend dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy backend application source
COPY backend ./backend

# Copy compiled frontend static bundle from Stage 1
COPY --from=frontend-builder /app/dist ./dist

# Create data directory for SQLite persistence
RUN mkdir -p /app/backend/data

# Environment configuration
ENV PYTHONUNBUFFERED=1 \
    PORT=8000 \
    HOST=0.0.0.0

EXPOSE 8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD sh -c "curl -f http://localhost:${PORT:-8000}/health || exit 1"

# Launch Lehar AI unified server (respects Render dynamic $PORT)
CMD ["sh", "-c", "python -m uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
