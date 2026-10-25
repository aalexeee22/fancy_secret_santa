FROM node:22-bookworm-slim AS frontend-build

WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
COPY --from=frontend-build /build/frontend/dist ./frontend/dist

# Rulăm ca utilizator fără drepturi de root
RUN useradd --create-home --uid 1000 santa && chown -R santa:santa /app
USER santa

EXPOSE 8000

CMD ["python", "start.py"]
