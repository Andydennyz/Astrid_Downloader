FROM python:3.13-slim-trixie

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATABASE_SSL_CA_FILE=/app/certs/prod-ca-2021.crt

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates \
       ffmpeg \
       nodejs \
       gosu \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./

RUN pip install --no-cache-dir -r requirements.txt

COPY certs ./certs
COPY app ./app

RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin app \
    && mkdir -p /app/storage \
    && chown -R app:app /app

EXPOSE 8000

CMD ["sh", "-c", "chown app:app /app/storage && exec gosu app uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1"]