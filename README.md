# MediaDock

### Your Media. Your Library. Your Control.

MediaDock is a modern, full-stack video and audio downloading platform designed to make media discovery, downloading, organization, and management simple and intuitive.

Built with React, TypeScript, Python, FastAPI, Supabase, and Docker, MediaDock combines a responsive media-management interface with a powerful backend processing engine.

The application allows users to analyze media URLs, explore available formats, configure download preferences, extract audio, manage download queues, and organize their media library.

MediaDock supports both guest sessions and authenticated accounts, providing a flexible experience while maintaining user-specific download data and storage isolation.

**Live Application:** https://media-dock.astrid-downloader.workers.dev/


---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Application Architecture](#application-architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [How MediaDock Works](#how-mediadock-works)
- [Supported Media Platforms](#supported-media-platforms)
- [Authentication and User Management](#authentication-and-user-management)
- [Storage Architecture](#storage-architecture)
- [Backend API](#backend-api)
- [Environment Configuration](#environment-configuration)
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [Production Infrastructure](#production-infrastructure)
- [Security](#security)
- [Testing and Quality Assurance](#testing-and-quality-assurance)
- [Known Limitations](#known-limitations)
- [Future Development](#future-development)
- [Contributing](#contributing)
- [License](#license)

---

# Overview

MediaDock is designed around a straightforward idea: media downloading should not require complicated desktop software or fragmented tools.

Instead of relying on a traditional desktop downloader, MediaDock provides a browser-accessible workspace where users can analyze media, select formats, monitor downloads, and manage their media collection.

The platform separates its frontend and backend responsibilities.

The frontend provides the interactive user experience, while the backend handles media extraction, download processing, database operations, authentication verification, and temporary media storage.

Supabase provides persistent relational data storage and authentication, while Fly.io hosts the Python backend and its persistent storage volume.

The frontend is deployed independently through Cloudflare.

This architecture allows the frontend and backend to evolve independently while communicating through a defined HTTP API.

---

# Features

## 1. Media Analysis

MediaDock uses yt-dlp to inspect supported media URLs before downloading.

When a user submits a URL, the backend extracts available metadata, including:

- Media title
- Creator or uploader
- Thumbnail
- Duration
- Upload date
- Description
- Available media formats
- Video resolution
- Audio and video codecs
- Estimated file sizes where available

The frontend presents the extracted information and available format options before the download begins.

## 2. Video Downloads

Download video content with configurable preferences.

Supported options include:

- Best available quality
- 2160p (4K)
- 1440p
- 1080p
- 720p
- 480p
- 360p

Users can also select supported output containers, including MP4 and WebM.

The backend uses yt-dlp to select and retrieve the appropriate media streams.

## 3. Audio Extraction

MediaDock supports audio-only downloads and extraction.

Available audio preferences include:

- Original or best available audio
- MP3
- M4A
- WAV
- FLAC

FFmpeg handles media conversion and stream processing where required.

## 4. Download Queue Management

MediaDock includes a persistent download queue managed by the backend.

Users can:

- Add downloads to the queue.
- Monitor download progress.
- View downloaded bytes.
- Monitor download speed.
- View estimated completion time.
- Pause downloads.
- Resume paused downloads.
- Cancel active downloads.
- Retry failed downloads.
- Remove download records.

The backend processes queued jobs sequentially.

Download jobs are stored in PostgreSQL, allowing queued work to survive backend restarts.

Interrupted downloads are recovered when the backend starts again.

## 5. Media Library

Completed downloads are recorded in a user-specific library.

Library records contain information such as:

- Filename
- Media title
- Creator
- Media type
- File extension
- Quality
- File size
- Download date
- Original source URL

Users can browse and manage their completed media.

## 6. Download History

MediaDock maintains a history of download activities.

History records include completed and failed downloads, with relevant metadata and error information.

Users can inspect previous activities and remove individual records or clear their history.

## 7. Dashboard and Analytics

The dashboard provides an overview of download activity.

It includes:

- Total downloads
- Completed downloads
- Failed downloads
- Active download information
- Storage usage
- Download activity charts
- Video and audio activity breakdowns
- Current download queue information

The overview supports selectable reporting periods.

## 8. User Settings

MediaDock provides configurable application preferences.

These include:

- Default video quality
- Default audio format
- Preferred media container
- Download organization preferences
- Automatic organization by media type
- Automatic organization by creator
- Download behavior
- Device download directory
- Interface appearance and density preferences

Settings are managed through the frontend service architecture.

## 9. Browser-Based Device Downloads

MediaDock supports browser-based downloads to a user's device.

On supported browsers, users can select a destination folder through the File System Access API.

Completed media can then be transferred from backend storage to the selected device folder.

When direct folder access is unavailable, MediaDock falls back to the browser's standard download mechanism.

---

# Application Architecture

MediaDock uses a distributed application architecture consisting of independently deployed frontend and backend services.

### Architecture Overview

```text
                         INTERNET
                            |
                            |
                     USER'S BROWSER
                            |
                            |
                            v
                  CLOUDFLARE WORKER
                  Frontend Application
                            |
                            |
                            | HTTPS
                            |
                            v
                  FLY.IO BACKEND HOST
                            |
                            |
                    FASTAPI APPLICATION
                            |
             +--------------+--------------+
             |              |              |
             v              v              v
        AUTHENTICATION   MEDIA ENGINE    API SERVICES
             |              |              |
             |              |              |
             v              v              v
        SUPABASE AUTH    yt-dlp         SQLAlchemy
                            |              |
                            v              |
                         FFmpeg            |
                            |              |
                            +-------+------+
                                    |
                                    v
                            SUPABASE POSTGRES
                                    |
                                    |
                             PERSISTENT DATA
                                    |
                                    v
                         FLY.IO PERSISTENT VOLUME
                                    |
                                    |
                                    v
                           BROWSER / DEVICE
```

### Component Responsibilities

| Component | Responsibility |
|---|---|
| Cloudflare | Frontend hosting and delivery |
| React | User interface |
| TypeScript | Frontend application logic |
| TanStack Router | Application routing |
| FastAPI | Backend HTTP API |
| yt-dlp | Media extraction and downloading |
| FFmpeg | Audio/video processing |
| SQLAlchemy | Database interaction |
| Supabase PostgreSQL | Persistent application data |
| Supabase Auth | User authentication |
| Fly.io | Backend application hosting |
| Fly Volumes | Persistent backend media storage |
| Docker | Application containerization |
| Nginx | Local production-style frontend serving and API reverse proxy |

The frontend communicates with the backend through the `/api/v1` API namespace.

---

# Technology Stack

## Frontend

| Technology | Purpose |
|---|---|
| React 19 | Component-based UI |
| TypeScript | Type-safe development |
| Vite | Development and build tooling |
| TanStack Router | File-based application routing |
| TanStack Start | React application server integration |
| TanStack Query | Server-state management |
| Tailwind CSS 4 | Styling |
| shadcn-based UI components | Interface components |
| Lucide React | Icons |
| Recharts | Dashboard charts |
| Motion | Interface animations |
| Supabase JS | Authentication integration |

## Backend

| Technology | Purpose |
|---|---|
| Python 3.13 | Backend runtime |
| FastAPI | REST API framework |
| Uvicorn | ASGI application server |
| SQLAlchemy 2 | Database ORM |
| Alembic | Database migrations |
| asyncpg | Asynchronous PostgreSQL driver |
| yt-dlp | Media extraction and downloading |
| FFmpeg | Media conversion and processing |
| PyJWT | JWT validation |
| Pydantic | Configuration and data validation |
| httpx | HTTP communication |

## Infrastructure

| Technology | Purpose |
|---|---|
| Cloudflare Workers | Frontend deployment |
| Fly.io | Backend deployment |
| Supabase | PostgreSQL and authentication |
| Docker | Containerization |
| Docker Compose | Local service orchestration |
| Nginx | Reverse proxy and static frontend serving |

---

# Project Structure

The repository contains the frontend and backend in a single project.

```text
MediaDock/
│
├── backend/
│   │
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth.py
│   │   │   ├── health.py
│   │   │   └── media.py
│   │   │
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── exceptions.py
│   │   │   ├── logging_config.py
│   │   │   └── security.py
│   │   │
│   │   ├── database/
│   │   │   ├── base.py
│   │   │   ├── connection.py
│   │   │   ├── migrations.py
│   │   │   └── models.py
│   │   │
│   │   ├── middleware/
│   │   │   ├── rate_limit.py
│   │   │   └── request_logging.py
│   │   │
│   │   ├── repositories/
│   │   ├── schemas/
│   │   ├── services/
│   │   │
│   │   └── main.py
│   │
│   ├── alembic/
│   │   └── versions/
│   │
│   ├── tests/
│   │
│   ├── certs/
│   ├── storage/
│   ├── Dockerfile
│   ├── fly.toml
│   ├── requirements.txt
│   ├── .env.example
│   └── alembic.ini
│
├── src/
│   │
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   ├── routes/
│   │   ├── _app/
│   │   └── auth/
│   │
│   ├── services/
│   │   ├── mock/
│   │   ├── contracts.ts
│   │   ├── http.ts
│   │   ├── types.ts
│   │   └── device-storage.ts
│   │
│   ├── router.tsx
│   └── server.ts
│
├── public/
│
├── nginx/
│   └── default.conf
│
├── Dockerfile
├── compose.yaml
├── package.json
├── vite.config.ts
├── wrangler.jsonc
├── tsconfig.json
└── README.md
```

---

# How MediaDock Works

## 1. Media Analysis Workflow

```text
User submits media URL
          |
          v
Frontend validates URL
          |
          v
POST /api/v1/media/analyze
          |
          v
FastAPI receives request
          |
          v
yt-dlp extracts metadata
          |
          v
Backend returns media information
          |
          v
Frontend displays preview
          |
          v
User selects format and quality
```

Media analysis does not immediately start downloading the media.

The user first receives the available media information and makes a selection.

## 2. Download Workflow

```text
User confirms download
          |
          v
POST /api/v1/downloads
          |
          v
FastAPI validates request
          |
          v
Download job saved in PostgreSQL
          |
          v
Job added to background queue
          |
          v
Background worker processes job
          |
          v
yt-dlp retrieves media
          |
          v
FFmpeg processes media if required
          |
          v
File saved in managed storage
          |
          v
Database updated
          |
          v
Download marked completed
          |
          v
Frontend updates library and history
```

The background worker supports automatic recovery of interrupted jobs and bounded retries for transient download failures.

## 3. Device Storage Workflow

MediaDock separates temporary backend media storage from the user's device storage.

```text
Media download completed
          |
          v
Backend stores media temporarily
          |
          v
Frontend requests media access
          |
          v
Backend creates secure file-access ticket
          |
          v
Browser retrieves media
          |
          v
User's selected device folder
          |
          v
Frontend confirms device save
          |
          v
Backend removes staged media copy
          |
          v
Database metadata retained
```

When the browser cannot use direct folder access, MediaDock uses the standard browser download flow.

The application does not claim to control the entire device's filesystem or drive capacity.

---

# Supported Media Platforms

MediaDock uses yt-dlp for media extraction.

The following platforms are explicitly recognized by the application's platform detection logic:

| Platform | Domain |
|---|---|
| YouTube | youtube.com, youtu.be |
| Vimeo | vimeo.com |
| SoundCloud | soundcloud.com |
| Twitch | twitch.tv |
| Bandcamp | bandcamp.com |
| Facebook | facebook.com, fb.watch |
| Instagram | instagram.com, instagr.am |
| Pinterest | pinterest.com, pin.it |
| TikTok | tiktok.com |
| X / Twitter | x.com, twitter.com |
| Reddit | reddit.com, redd.it |
| Dailymotion | dailymotion.com, dai.ly |

Guest users are restricted to these explicitly supported platform domains.

Authenticated users can use other websites supported by yt-dlp.

Actual availability depends on the source platform, media accessibility, and the capabilities of the installed yt-dlp version.

MediaDock does not bypass DRM, private content restrictions, platform authentication requirements, or other access controls.

---

# Authentication and User Management

MediaDock supports two usage modes.

## Guest Sessions

Users can analyze and download supported media without creating an account.

Guest sessions use browser-generated UUID-based tokens.

The backend validates these tokens and derives isolated guest identities.

Each guest receives separate:

- Download queues
- Download history
- Media library records
- Storage directories

Guest sessions are isolated per browser tab.

When a guest tab closes, its session is cleared from the browser. Server-side cleanup provides a seven-day expiry fallback.

Previously saved files on the user's device are not automatically deleted when a guest session ends.

## Authenticated Users

MediaDock integrates with Supabase Auth.

Users can sign in through the authentication interface.

The frontend obtains Supabase access tokens and sends them to the backend using:

```http
Authorization: Bearer <access_token>
```

The backend validates JWTs using Supabase's JWKS endpoint.

The implementation supports RS256 and ES256 signing keys.

Authenticated users receive account-specific download queues, history, library records, and storage directories.

Signing out returns the interface to guest mode.

---

# Storage Architecture

MediaDock uses two distinct storage locations.

## Backend Storage

The backend maintains managed media storage.

Each user receives a separate storage directory.

Example:

```text
/app/storage/
    |
    ├── user-identifier-1/
    │      ├── video/
    │      └── audio/
    │
    ├── user-identifier-2/
    │      ├── video/
    │      └── audio/
    │
    └── guest-identifier/
           ├── video/
           └── audio/
```

The actual directory organization depends on the selected download destination and organization settings.

In production, this storage is mounted through a Fly.io persistent volume.

## Device Storage

Users can select a destination folder on their own devices.

Supported browsers can use the File System Access API to grant MediaDock access to the selected folder.

When unavailable, downloads use the browser's normal download mechanism.

## Database Storage

PostgreSQL stores application metadata rather than acting as the primary media-file storage location.

The database maintains:

- User records
- Download jobs
- Media library records
- Download history
- Download status and progress
- File metadata

The backend storage volume and the user's device folder serve different purposes.

**Important:** Back up both the database and persistent media storage. Database records alone cannot reconstruct deleted media files.

---

# Backend API

The backend exposes its HTTP API under:

```text
/api/v1
```

## Health Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/health` | Application liveness |
| GET | `/api/v1/health/db` | Database connectivity |
| GET | `/api/v1/health/ready` | Application readiness |

## Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/auth/me` | Retrieve authenticated user information |

## Media

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/media/validate` | Validate a media URL |
| POST | `/api/v1/media/analyze` | Analyze media metadata |
| GET | `/api/v1/media/{media_id}/formats` | Retrieve available formats |

## Downloads

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/downloads` | List download jobs |
| POST | `/api/v1/downloads` | Create a download |
| GET | `/api/v1/downloads/{job_id}` | Retrieve a download |
| POST | `/api/v1/downloads/{job_id}/pause` | Pause a download |
| POST | `/api/v1/downloads/{job_id}/resume` | Resume a download |
| POST | `/api/v1/downloads/{job_id}/cancel` | Cancel a download |
| POST | `/api/v1/downloads/{job_id}/retry` | Retry a failed download |
| DELETE | `/api/v1/downloads/{job_id}` | Remove a download record |
| POST | `/api/v1/downloads/{job_id}/device-saved` | Confirm device storage |

## Library

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/library` | List library items |
| DELETE | `/api/v1/library/{library_id}` | Remove a library item |

## History

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/history` | Retrieve download history |
| DELETE | `/api/v1/history/{history_id}` | Remove a history entry |
| DELETE | `/api/v1/history` | Clear history |

## Storage and File Access

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/files/open-session` | Create a file access session |
| POST | `/api/v1/files/download-session` | Create a browser download session |
| GET | `/api/v1/files/open/{ticket}` | Retrieve authorized media |
 
## Dashboard

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/stats/overview` | Retrieve dashboard statistics |

## Guest Management

| Method | Endpoint | Purpose |
|---|---|---|
| DELETE | `/api/v1/guest-session` | Clear the current guest session |

Interactive API documentation:

https://astrid-downloader-api.fly.dev/docs

---

# Environment Configuration

MediaDock separates frontend configuration from backend secrets.

Never commit real credentials or production secrets to GitHub.

## Frontend Environment Variables

Create a `.env` file in the repository root.

```env
VITE_API_BASE_URL=/api/v1

VITE_SUPABASE_URL=https://your-project.supabase.co

VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

Alternatively, the frontend supports:

```env
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

The Supabase URL and publishable/anon key are browser-visible configuration values.

Never place a service-role key or database password in the frontend environment.

## Backend Environment Variables

Create:

```text
backend/.env
```

Use the supplied `backend/.env.example` as the template.

```env
SUPABASE_URL=https://your-project.supabase.co

SUPABASE_ANON_KEY=your-anon-key

SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

DATABASE_URL=postgresql+asyncpg://postgres:password@host:5432/postgres

SUPABASE_JWT_SECRET=

SECRET_KEY=your-long-random-secret

FRONTEND_URL=http://localhost:5173

STORAGE_PATH=./storage

STORAGE_QUOTA_BYTES=0

DOWNLOAD_MAX_RETRIES=2

DOWNLOAD_RETRY_BACKOFF_SECONDS=1

MAX_RATE_REQUESTS_PER_MINUTE=120

ENVIRONMENT=development
```

### Environment Variable Reference

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side administrative key |
| `DATABASE_URL` | PostgreSQL connection string |
| `SUPABASE_JWT_SECRET` | Optional legacy JWT configuration |
| `SECRET_KEY` | Backend application secret |
| `FRONTEND_URL` | Frontend origin allowed by CORS |
| `STORAGE_PATH` | Backend managed storage location |
| `STORAGE_QUOTA_BYTES` | Optional storage quota |
| `DOWNLOAD_MAX_RETRIES` | Maximum retries after the initial attempt |
| `DOWNLOAD_RETRY_BACKOFF_SECONDS` | Exponential retry backoff base |
| `MAX_RATE_REQUESTS_PER_MINUTE` | Backend request rate limit |
| `ENVIRONMENT` | Application environment |
| `DATABASE_SSL_CA_FILE` | Optional PostgreSQL CA certificate path |

Production credentials should be configured through the hosting platform's secret-management facility.

---

# Local Development

## Prerequisites

Install the following:

- Git
- Node.js 22 or compatible current Node.js release
- npm
- Python 3.13
- FFmpeg
- Docker Desktop (recommended)

For YouTube signature challenges, the backend Docker image also includes Node.js as a JavaScript runtime.

## 1. Clone the repository

```bash
git clone https://github.com/Andydennyz/Astrid_Downloader.git

cd Astrid_Downloader
```

To work with the Supabase online branch:

```bash
git checkout version/supabase-online
```

## 2. Install frontend dependencies

```bash
npm install
```

## 3. Configure the frontend

Create the repository-root `.env` file and configure the frontend variables described above.

## 4. Configure the backend

From PowerShell:

```powershell
Copy-Item backend\.env.example backend\.env
```

Edit `backend\.env` and provide the required credentials.

## 5. Create a Python virtual environment

From the repository root:

```powershell
py -3.13 -m venv .venv-backend
```

Install dependencies:

```powershell
.\.venv-backend\Scripts\python.exe -m pip install -r backend\requirements.txt
```

## 6. Apply database migrations

```powershell
Set-Location backend

..\.venv-backend\Scripts\python.exe -m alembic upgrade head
```

## 7. Start the backend

```powershell
..\.venv-backend\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The backend will be available at:

```text
http://127.0.0.1:8000
```

API documentation:

```text
http://127.0.0.1:8000/docs
```

## 8. Start the frontend

Open another terminal at the repository root:

```bash
npm run dev
```

Vite uses port `5174` in the current development configuration.

---

# Docker Deployment

MediaDock includes Docker and Docker Compose configurations for running the frontend and backend together locally.

The local architecture uses:

- A React production build.
- Nginx for static file serving.
- FastAPI for backend operations.
- A private Docker network.
- A persistent local storage directory.
- A mounted backend environment secret.

## 1. Configure Docker environment

Create:

```powershell
Copy-Item backend\docker.env.example backend\docker.env
```

Configure the actual credentials and a unique `SECRET_KEY`.

## 2. Build and start the application

From the repository root:

```powershell
docker compose up --build -d
```

## 3. Check running containers

```powershell
docker compose ps
```

## 4. View logs

```powershell
docker compose logs -f
```

Backend logs only:

```powershell
docker compose logs -f backend
```

## 5. Access MediaDock

Open:

```text
http://localhost:5175
```

The Nginx container serves the frontend and proxies `/api/` requests to FastAPI.

## 6. Stop the application

```powershell
docker compose down
```

Local Docker storage is maintained in the ignored repository `data/` directory.

The local Docker environment is intended for development and trusted LAN use, not direct public internet exposure.

---

# Production Infrastructure

MediaDock uses independently deployed frontend and backend infrastructure.

## Frontend Hosting

**Provider:** Cloudflare Workers

The frontend is deployed using the Cloudflare integration configured through Wrangler and TanStack Start.

Live application:

https://media-dock.astrid-downloader.workers.dev/

## Backend Hosting

**Provider:** Fly.io

The Python backend is containerized using the backend Dockerfile and deployed as a Fly.io application.

Application:

```text
astrid-downloader-api
```

Region:

```text
cdg
```

Internal application port:

```text
8000
```

Backend:

https://astrid-downloader-api.fly.dev/

## Persistent Storage

The backend uses a Fly.io persistent volume mounted at:

```text
/app/storage
```

The configured volume is:

```text
astrid_storage
```

The volume preserves managed media files across machine restarts and application deployments.

## Database

**Provider:** Supabase

Supabase PostgreSQL provides persistent application data storage.

The backend connects through SQLAlchemy and asyncpg.

Alembic manages database schema migrations.

## Production Environment Variables

Configure the backend secrets through Fly.io rather than committing credentials to the repository.

The frontend's public Supabase configuration is supplied separately through the Cloudflare deployment environment.

The backend runs one Uvicorn worker because its download-processing worker and in-memory rate limiter are designed for a single-instance topology.

---

# Security

MediaDock incorporates several security controls.

### Authentication

- Supabase access-token validation.
- JWT verification using Supabase JWKS.
- Explicitly supported RS256 and ES256 algorithms.
- User-specific resource ownership checks.
- Guest identity validation.

### Storage Security

- User-partitioned storage directories.
- Managed storage destination validation.
- Protection against parent-directory traversal.
- Safe filename generation.
- Restricted file-access sessions.
- Storage quota enforcement when configured.

### Backend Security

- Configurable request rate limiting.
- Request logging.
- Error handling.
- HTTPS enforcement in the production Fly.io HTTP service.
- Non-root application execution inside the Docker container.
- Environment-based secret management.

### Operational Security

Never commit:

- `.env` files containing actual credentials.
- Supabase service-role keys.
- Database passwords.
- Production secret keys.
- Fly.io deployment secrets.

The frontend publishable key is public configuration, but administrative credentials must remain server-side.

---

# Testing and Quality Assurance

The repository includes frontend and backend tests.

## Frontend

Run tests:

```bash
npm test
```

Type checking:

```bash
npm run typecheck
```

Linting:

```bash
npm run lint
```

Production build:

```bash
npm run build
```

## Backend

From the backend directory, activate the Python virtual environment and execute:

```powershell
python -m pytest
```

The backend test suite includes coverage for:

- API contracts
- Authentication
- Database migrations
- Download processing
- Health endpoints
- Media analysis
- Rate limiting
- Storage operations

---

# Known Limitations

MediaDock depends on third-party media platforms and their accessibility.

Consequently:

- Some media URLs may not be downloadable.
- Certain platforms may change their extraction mechanisms.
- Private or restricted media may require access that the application does not provide.
- DRM-protected content is not supported.
- Guest downloads are limited to explicitly supported platforms.
- Direct device-folder access depends on browser support and secure-context requirements.
- The production download worker processes jobs sequentially.
- In-memory rate limiting is intended for the current single-instance backend architecture.

Download availability and output quality depend on the original media source.

---

# Future Development

MediaDock is built with an architecture that can support further improvements.

Potential development directions include:

- Expanded media-platform compatibility.
- Improved download analytics.
- Enhanced media organization.
- Advanced download scheduling.
- Additional export formats.
- Improved storage management.
- More comprehensive operational monitoring.
- Expanded automated integration testing.
- Enhanced mobile experience.
- Additional user-account capabilities.

These are possible future improvements, not claims about currently implemented functionality.

---

# Contributing

Contributions, suggestions, and bug reports are welcome.

To contribute:

1. Fork the repository.
2. Create a feature branch.
3. Implement your changes.
4. Run the relevant tests.
5. Submit a pull request describing your changes.

Please avoid committing credentials, downloaded media, generated build files, or local environment configurations.

---

# License

Choose and add an appropriate open-source license before distributing MediaDock under an open-source license.

---

## MediaDock

**A unified workspace for discovering, downloading, and managing your media.**

Live Application: https://media-dock.astrid-downloader.workers.dev/

Backend API: https://astrid-downloader-api.fly.dev/

Repository: https://github.com/Andydennyz/Astrid_Downloader

Built with React, TypeScript, Python, FastAPI, Supabase, Docker, Cloudflare, and Fly.io.




# Local Docker setup

Docker Compose builds the React app as a static SPA and runs Nginx to serve its
files directly. Nginx publishes port `5175` on this machine and on the local
network, serves client-side routes and assets, and forwards `/api/` requests to
the private FastAPI/yt-dlp backend. Vite is used only during the image build;
`npm run dev` remains available for local development on port `5174`. This
Docker stack uses HTTP and is intended for local/LAN use, not direct public
internet exposure. It does not change the existing Cloudflare Worker
configuration or deploy anything to Cloudflare.

Other devices on your LAN can reach the host Vite development server using this
computer's LAN IP and port `5174`, or the Nginx-served Docker app using the PC's
LAN IP and port `5175`. On a phone, use `http://<PC-LAN-IP>:5175` (for example,
`http://192.168.100.83:5175`) while both devices are on the same network. If
Windows Firewall blocks access on a trusted home network, set that Wi-Fi network
to the Private profile in Windows and allow Docker Desktop or TCP port `5175` on
the Private profile only. Do not open the port on a Public network. The LAN IP may
change; reserve it on your router or update the Supabase redirect allow-list when
it changes. For LAN sign-in, allow
`http://<PC-LAN-IP>:5175/auth/callback` in Supabase Auth redirect URLs.

LAN access is not public internet access. Do not forward the development server
port through your router; use a production deployment or an authenticated TLS
tunnel/reverse proxy for internet access.

Create the local backend settings file once:

```powershell
Copy-Item backend\docker.env.example backend\docker.env
```

Set `SECRET_KEY` in `backend\docker.env` to a unique random value. For optional
Supabase sign-in, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or
`VITE_SUPABASE_ANON_KEY`) in the repository-root `.env`. Those `VITE_` values are
public browser configuration; never put a Supabase service-role key or other
server secret in the root `.env`.

Start the app:

```powershell
docker compose up --build -d
docker compose ps
```

Stop it with `docker compose down`. The browser writes completed media to the
folder you select in **Settings**. The backend temporarily stages each download
under the ignored `data\` folder and, when folder access is available, streams it
to that browser folder when complete and removes its server copy while keeping
the user's media metadata in the database. Back up the selected device folder
to preserve your media. The backend
uses the PostgreSQL database configured by `DATABASE_URL` in
`backend\docker.env`; Compose does not create that database. If `DATABASE_URL`
is unset, the backend falls back to SQLite in the persisted storage folder.

Signed-in library and history metadata remains in the database; media bytes are
kept in the selected device folder. Guest sessions are isolated per tab and are
cleared when the tab closes (with a seven-day server-side expiry as a fallback).
Already-saved device files are intentionally left in place when a guest tab
closes. The browser does not expose total drive capacity/free space, so the app
reports the size of its own tracked media rather than claiming the whole drive's
free space.

Direct folder access requires a browser with the File System Access API
(currently Chrome or Edge) and a secure context: use `http://localhost:5175` on
the Docker host, or serve the app over HTTPS for access from another device.
The plain HTTP LAN address (`http://<PC-LAN-IP>:5175`) can serve the app, but
browsers do not permit this folder API there. When folder access is supported,
choose the folder in Settings before starting a download; the app asks for
permission and automatically transfers each completed download. If folder
access is unavailable, the app sends completed files through the browser's
standard download flow instead. The browser chooses the download location, and
whether it shows a Save As prompt depends on the browser's "Ask where to save
each file" preference (Chrome: `chrome://settings/downloads`; Edge:
`edge://settings/downloads`). The app keeps its staged server copy because it
cannot confirm that the browser saved the file.

Backend settings are read from `backend\docker.env`, mounted read-only at runtime
as a Docker secret. They are not copied into either image or passed as container
environment variables. Docker build contexts exclude local environment files,
dependencies, and downloaded media. A Docker host administrator can still access
the mounted source file, so keep the host secure and do not commit it.

The frontend build only receives the Supabase URL and publishable/anon key,
which are intended to be visible to browsers. `SUPABASE_SERVICE_ROLE_KEY`,
`DATABASE_URL`, `SUPABASE_JWT_SECRET`, and `SECRET_KEY` must remain in the
backend settings file.

## Vite template notes

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.
You can also try [the experimental native React Compiler support in plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md#rust-react-compiler) by using `compiler: true` in the plugin options instead of using the Babel plugin.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
