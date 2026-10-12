# Multi-stage Dockerfile for Trovi (Vite Frontend + FastAPI Backend)
# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --prefer-offline || npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Python Backend runtime
FROM python:3.11-slim AS runner
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

# Install dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend code and database
COPY backend/ ./backend/

# Copy built frontend assets and public directory for product images
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
COPY frontend/public ./frontend/public

WORKDIR /app/backend
EXPOSE 8000

CMD ["sh", "-c", "python -c 'import setup_db; setup_db.create_database()' && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
