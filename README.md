# Ledgerra

Ledgerra is a self-hosted budget planner and spending tracker built with an ASP.NET Core API and a React frontend. It is designed for homelab deployments such as Unraid, keeps a clean JSON API for future mobile clients, and focuses on multiple accounts, transaction tracking, and monthly category budgets.

## Current MVP

- Local email/password authentication with JWT access tokens and refresh tokens
- CRUD-ready account, category, transaction, budget, and dashboard API endpoints
- Transfer support between accounts without distorting income/expense reporting
- React dashboard with:
  - login and registration
  - dashboard summary
  - transaction entry
  - accounts management
  - categories management
  - monthly budget planning
- Dockerized PostgreSQL + backend + frontend stack

## Project Layout

- `backend/` contains the .NET solution, API, domain, infrastructure, and tests
- `frontend/` contains the React + TypeScript SPA
- `docker-compose.yml` runs the full self-hosted stack

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

You can run PostgreSQL locally with Docker:

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

3. Copy this repository's `docker-compose.yml` to
   `/mnt/user/appdata/ledgerra/docker-compose.yml`.
4. Edit `/mnt/user/appdata/ledgerra/docker-compose.yml` before first start:

   - Change `POSTGRES_PASSWORD`.
   - Use the same password in `ConnectionStrings__Ledgerra`.
   - Replace `Auth__SigningKey` with a long random secret.
   - Change the frontend port mapping if Unraid already uses `8080`, for
     example `8088:80`.
   - For Unraid-friendly backups, replace the `postgres` volume mapping with:

     ```yaml
     volumes:
       - /mnt/user/appdata/ledgerra/postgres:/var/lib/postgresql/data
     ```

     If you use this bind mount, remove the top-level `volumes:` block for the
     named `ledgerra-postgres` volume.

5. Start Ledgerra:

   ```bash
   cd /mnt/user/appdata/ledgerra
   docker compose up --build -d
   ```

6. Open Ledgerra at `http://<unraid-server-ip>:8080`, or the alternate host
   port you configured.

Useful maintenance commands:

```bash
cd /mnt/user/appdata/ledgerra
docker compose pull
docker compose up --build -d
docker compose logs -f
docker compose down
```

Keep `/mnt/user/appdata/ledgerra/postgres` in your Unraid backup plan. That
directory contains the PostgreSQL data when using the recommended bind mount.

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
