# Ledgerra

Ledgerra is a self-hosted personal finance tracker built with an ASP.NET Core API and a React frontend. It is designed for homelab deployments such as Unraid and TrueNAS SCALE, keeps a clean JSON API, and covers the full personal finance workflow — accounts, transactions, budgets, savings goals, and analytics.

**Current version: v0.12.0**

## Features

### Accounts
- Multiple accounts with types: Checking, Savings, Credit Card, Investment, and more
- Per-account balance chart with range selector
- Institution, masked account number, and icon support
- Transfer between accounts without distorting income/expense reporting

### Transactions
- Full transaction CRUD with inline editing
- Split transactions across multiple categories
- Recurring transaction templates with auto-generation
- Bulk actions: categorize, transfer, delete
- Advanced filters (date range, category, account, amount, type) with shareable URL state
- CSV export of filtered transactions
- Smart CSV import with field mapping

### Budgets & Categories
- Monthly category budgets with progress tracking
- CSV export of budget data with category detail

### Savings Goals
- Savings goals with optional deadlines and target amounts
- Progress tracking linked to actual account transfers

### Dashboard
- Customizable widget layout (persisted per user)
- Global month selector
- Quick transaction entry from the dashboard
- Spending insights and net worth summary

### Reports
- Monthly income vs. expense charts (powered by Recharts)
- AI-assisted monthly report analysis via OpenAI-compatible providers

### Backup & Import
- Full data export and restore (backup/restore flow)
- CSV transaction import with preview and conflict handling

### Settings & Security
- JWT authentication with access tokens and refresh tokens
- Personal access tokens for API access
- Profile, security, and appearance settings
- Accent color selection, density, motion, and minimal navigation preferences
- Dark mode
- Internationalization (i18n) with locale switching

### App
- Mobile-responsive PWA with bottom navigation bar
- Onboarding checklist for new users
- Security-hardened API and frontend (audit fixes in v0.1.0)

## Project Layout

- `backend/` — .NET solution: API, domain, infrastructure, and tests
- `frontend/` — React + TypeScript SPA
- `deploy/` — deployment templates for Unraid and TrueNAS SCALE
- `site/` — static GitHub Pages project website
- `docker-compose.yml` — full self-hosted stack

## Local Development

Run the whole development stack from the repository root:

```bash
./scripts/dev-stack.sh
```

The script reuses an existing `ledgerra-postgres` container or starts
PostgreSQL with Docker Compose if needed, then starts the backend and Vite
frontend if they are not already running. Defaults:

- API: `http://127.0.0.1:5027`
- Frontend: `http://127.0.0.1:5173`
- PostgreSQL: `localhost:5432`

### Backend

#### Local PostgreSQL setup

```bash
docker run --name ledgerra-postgres \
  -e POSTGRES_DB=ledgerra \
  -e POSTGRES_USER=ledgerra \
  -e POSTGRES_PASSWORD=ledgerra \
  -p 5432:5432 \
  -d postgres:17-alpine
```

Use this connection string for local backend development:

```bash
ConnectionStrings__Ledgerra="Host=localhost;Port=5432;Database=ledgerra;Username=ledgerra;Password=ledgerra"
```

Example:

```bash
cd backend
ConnectionStrings__Ledgerra="Host=localhost;Port=5432;Database=ledgerra;Username=ledgerra;Password=ledgerra" \
dotnet run --project src/Ledgerra.Api/Ledgerra.Api.csproj
```

If you already run PostgreSQL natively, create:

- database: `ledgerra`
- user: `ledgerra`
- password: `ledgerra`

```bash
cd backend
dotnet test Ledgerra.sln
dotnet run --project src/Ledgerra.Api/Ledgerra.Api.csproj
```

The API listens on `http://localhost:5027` when started via the default launch profile. A basic health endpoint is available at `/health`.

### Frontend

```bash
cd frontend
npm install
npm test
npm run build
npm run dev
```

For local browser development, set:

```bash
VITE_API_BASE_URL=http://localhost:5027
```

If you do not set it, the frontend assumes same-origin `/api`, which is the production Docker behavior.

## Project Website

The `site/` directory contains a static project website for GitHub Pages. It is
separate from the Ledgerra application and only describes the project, features,
stack, and self-hosting workflow. The included GitHub Actions workflow publishes
that static site after changes are merged to `main`.

In the repository settings, set **Pages > Build and deployment > Source** to
**GitHub Actions**.

## Self-Hosted Deployment

The included compose file is suitable for Docker or Unraid-style deployments:

```bash
docker compose up --build -d
```

Services:

- `postgres` stores the application data
- `backend` runs the ASP.NET Core API on internal port `8080`
- `frontend` serves the React app on host port `8080` and proxies `/api` to the backend

Before production use, change:

- `Auth__SigningKey`
- `POSTGRES_PASSWORD`
- any public-facing reverse proxy or TLS configuration

### Release Builds

Tagged releases publish ready-to-run Docker images to GitHub Container Registry
and attach deployment assets to the GitHub Release. This is the recommended path
for Unraid OS, TrueNAS SCALE, and Linux hosts because the target machine only
needs Docker Compose and does not need to build Ledgerra from source.

To publish a release, create and push a semantic version tag:

```bash
git tag v0.12.0
git push origin v0.12.0
```

The release workflow runs backend and frontend checks, builds multi-architecture
Linux images for `amd64` and `arm64`, pushes them to GHCR, and creates a GitHub
Release. The published image names are:

```text
ghcr.io/<github-owner>/ledgerra-backend:<tag>
ghcr.io/<github-owner>/ledgerra-frontend:<tag>
```

The same images are also tagged as `latest`.

For release deployment, download these assets from the matching GitHub Release:

- `docker-compose.yml`
- `env.example`
- `unraid-ledgerra-stack.yml` and `unraid-ledgerra-stack.env.example` for
  Unraid Docker Compose Manager
- `truenas-ledgerra-custom-app.yaml` and `truenas-app-metadata.yaml` for
  TrueNAS SCALE custom app installs
- `unraid-README.md` and `truenas-README.md` for platform-specific steps

Then prepare the host:

```bash
mkdir -p ledgerra
cd ledgerra
cp env.example .env
```

Edit `.env` before first start:

- set `POSTGRES_PASSWORD` to a long random password
- set `AUTH_SIGNING_KEY` to at least 32 random characters
- confirm `LEDGERRA_VERSION` matches the release tag
- change `LEDGERRA_HTTP_PORT` if the host already uses port `8080`
- change `LEDGERRA_POSTGRES_DATA` to a NAS-friendly appdata path if needed

Start Ledgerra:

```bash
docker compose pull
docker compose up -d
```

Upgrade to a newer release by changing `LEDGERRA_VERSION` in `.env`, then run:

```bash
docker compose pull
docker compose up -d
```

Platform-specific deployment templates live in:

- `deploy/unraid/`
- `deploy/truenas/`

### Unraid OS Setup

Ledgerra can run on Unraid with the Docker Compose Manager plugin or from the
Unraid terminal with Docker Compose.

1. Install the **Docker Compose Manager** plugin from Unraid Community
   Applications, or confirm that `docker compose` is available in the Unraid
   terminal.
2. Create an application directory:

   ```bash
   mkdir -p /mnt/user/appdata/ledgerra/postgres
   ```

3. Download the release `docker-compose.yml` and `env.example` from the GitHub
   Release, then place them in `/mnt/user/appdata/ledgerra`. Rename
   `env.example` to `.env`.
4. Edit `/mnt/user/appdata/ledgerra/.env` before first start:

   - Change `POSTGRES_PASSWORD` in `.env`.
   - Replace `AUTH_SIGNING_KEY` in `.env` with a long random secret.
   - Change `LEDGERRA_HTTP_PORT` if Unraid already uses `8080`.
   - Set `LEDGERRA_POSTGRES_DATA=/mnt/user/appdata/ledgerra/postgres` for
     Unraid-friendly backups.

5. Start Ledgerra:

   ```bash
   cd /mnt/user/appdata/ledgerra
   docker compose pull
   docker compose up -d
   ```

6. Open Ledgerra at `http://<unraid-server-ip>:8080`, or the alternate host
   port you configured.

Useful maintenance commands:

```bash
cd /mnt/user/appdata/ledgerra
docker compose pull
docker compose up -d
docker compose logs -f
docker compose down
```

Keep `/mnt/user/appdata/ledgerra/postgres` in your Unraid backup plan. That
directory contains the PostgreSQL data when using the recommended bind mount.

### TrueNAS SCALE Setup

TrueNAS SCALE 24.10 and newer can install Ledgerra through the custom app YAML
flow:

1. Create a PostgreSQL data dataset such as
   `/mnt/tank/apps/ledgerra/postgres`.
2. Open **Apps > Discover Apps > more_vert > Install via YAML**.
3. Use `ledgerra` as the app name.
4. Paste the release `truenas-ledgerra-custom-app.yaml` into the custom config
   editor.
5. Replace the example password, signing key, release tag, and dataset path.
6. Save the app and open Ledgerra at `http://<truenas-ip>:8080`.

## Verification

Backend checks:

```bash
cd backend
dotnet test tests/Ledgerra.Domain.Tests/Ledgerra.Domain.Tests.csproj
dotnet test tests/Ledgerra.Api.Tests/Ledgerra.Api.Tests.csproj
```

Frontend checks:

```bash
cd frontend
npm test
npm run build
```
