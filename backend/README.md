# Astrid Downloader Backend

This directory contains the Python FastAPI backend for Astrid Downloader.

## Stack
- FastAPI
- Supabase PostgreSQL
- SQLAlchemy 2.0
- Alembic
- yt-dlp + FFmpeg
- JWT verification compatible with Supabase auth

## Setup

Use Python 3.13 for the backend runtime. The project dependencies currently target the
Python 3.13 toolchain; Python 3.14 is not yet compatible with the async database and
pydantic build chain.

From the repository root, create the virtual environment and install dependencies:

```powershell
py -3.13 -m venv .venv-backend
.\.venv-backend\Scripts\python.exe -m pip install -r backend\requirements.txt
```

Copy `backend\.env.example` to `backend\.env` and fill in your Supabase configuration.
From the repository root, apply migrations and start the API from the backend directory:

```powershell
Set-Location backend
..\.venv-backend\Scripts\python.exe -m alembic upgrade head
..\.venv-backend\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The API health check is available at `http://127.0.0.1:8000/api/v1/health`.
Use `/api/v1/health/ready` for readiness probes; it verifies the database, download
worker, yt-dlp, FFmpeg, and FFprobe. `/api/v1/health/db` checks database connectivity.
Vite's development server proxies the same-origin `/api` path to the backend, avoiding
cross-origin requests. Set `VITE_API_BASE_URL` in the repository-root `.env` only if your
deployment uses a different API route.
Frontend authentication is configured separately: copy the repository-root `.env.example`
to `.env`, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or
`VITE_SUPABASE_ANON_KEY`), then restart Vite and sign in before analyzing links. The
media API requires a Supabase bearer token.

Downloaded files are stored on the backend host under `STORAGE_PATH`, partitioned by
authenticated user. Relative destinations (including the default `~/Downloads/Astrid`)
are treated as folders inside that managed root; absolute destinations must also be
inside it. Set `STORAGE_QUOTA_BYTES` to a positive byte count to enforce a per-user
library quota, or leave it at `0` for no configured quota. The overview API reports
library usage, remaining quota, and free space on the storage volume.

## Background downloads

The worker processes the database-backed queue sequentially. Queued work survives
restarts, and jobs interrupted in the `downloading` or `processing` state are requeued
when the backend starts. Active downloads are stopped cleanly during application
shutdown, leaving unfinished jobs queued for recovery. Pause and cancel requests stop
the current yt-dlp task and remove its partial file; resume starts a fresh attempt.
Transient download failures receive bounded automatic retries before being marked
failed. `DOWNLOAD_MAX_RETRIES` counts retries after the first attempt (default `2`),
and `DOWNLOAD_RETRY_BACKOFF_SECONDS` sets the exponential backoff base (default `1`).

## Production deployment and operations

Run behind a TLS-terminating reverse proxy or Cloudflare Tunnel, and keep the backend
port private. The API process also hosts the sequential download worker, so run one
Uvicorn worker (`--workers 1`) unless the worker and queue are moved to a separate
service. The in-memory rate limiter is also per process; use an edge/shared rate
limiter if deploying multiple instances.

For a reverse proxy, enable Uvicorn proxy headers only for the proxy addresses you
trust. Do not trust forwarded client IP headers from arbitrary internet clients.
Configure `MAX_RATE_REQUESTS_PER_MINUTE` to tune the per-process API limit.

Persist and back up the directory configured by `STORAGE_PATH`; it contains both media
and, when using the local database, the SQLite database. Use `/api/v1/health` as a
liveness probe and `/api/v1/health/ready` as a readiness probe. The backend emits
newline-delimited JSON logs to stdout, including request IDs, request timing, rate-limit
events, and download-worker state changes. Forward stdout to the hosting platform's
log service and configure a production alert/error-reporting destination there.

## Notes
- Do not commit `.env` files.
- The frontend is intentionally kept backend-agnostic; this backend exposes the API layer for the existing contracts.
- Supabase Auth JWTs are validated using the Supabase JWKS endpoint, including RSA/RS256
  and EC P-256/ES256 signing keys.
- YouTube extraction uses the current yt-dlp release and its `default` extras; install Node.js or Deno as a JavaScript runtime for YouTube signature challenges.
