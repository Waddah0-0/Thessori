# Stage 1: Build the React frontend
FROM node:20-slim AS frontend-builder
WORKDIR /frontend
COPY frontend/package.json .
RUN npm install
COPY frontend/ .
# vite outDir '../ui_dist' → /ui_dist
RUN npm run build

# Stage 2: Python API (serves the built UI + the API on one port)
FROM python:3.12-slim
WORKDIR /app

# Install minimal LaTeX engine for PDF export
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-latex-base \
    texlive-latex-recommended \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY agent/ ./agent/
COPY api/ ./api/
# built React app
COPY --from=frontend-builder /ui_dist ./ui_dist
COPY nginx.conf /etc/nginx/nginx.conf

RUN mkdir -p output
RUN useradd -m appuser && chown -R appuser /app
USER appuser

EXPOSE 8000

CMD ["uvicorn", "api.server:app", "--host", "0.0.0.0", "--port", "8000"]
