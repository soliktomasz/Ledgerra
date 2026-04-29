#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-ledgerra-postgres}"
POSTGRES_TIMEOUT_SECONDS="${POSTGRES_TIMEOUT_SECONDS:-60}"

BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-5027}"
BACKEND_URL="http://${BACKEND_HOST}:${BACKEND_PORT}"
BACKEND_HEALTH_URL="${BACKEND_URL}/health"
BACKEND_TIMEOUT_SECONDS="${BACKEND_TIMEOUT_SECONDS:-90}"

FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
FRONTEND_URL="http://${FRONTEND_HOST}:${FRONTEND_PORT}"
FRONTEND_PUBLIC_ORIGIN="http://localhost:${FRONTEND_PORT}"
FRONTEND_TIMEOUT_SECONDS="${FRONTEND_TIMEOUT_SECONDS:-60}"

CONNECTION_STRING="${CONNECTION_STRING:-Host=localhost;Port=5432;Database=ledgerra;Username=ledgerra;Password=ledgerra}"

BACKEND_PID=""
FRONTEND_PID=""

log() {
  printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$*"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

require_docker_daemon() {
  if ! docker info >/dev/null 2>&1; then
    printf 'Docker is not reachable. Start Docker Desktop or check Docker daemon permissions, then run this script again.\n' >&2
    exit 1
  fi
}

is_url_ready() {
  curl --silent --fail --max-time 2 "$1" >/dev/null 2>&1
}

wait_for_url() {
  local name="$1"
  local url="$2"
  local timeout_seconds="$3"
  local elapsed=0

  until is_url_ready "$url"; do
    if [ "$elapsed" -ge "$timeout_seconds" ]; then
      printf '%s did not become ready at %s within %ss.\n' "$name" "$url" "$timeout_seconds" >&2
      return 1
    fi

    sleep 1
    elapsed=$((elapsed + 1))
  done
}

is_compose_postgres_running() {
  docker compose -f "$ROOT_DIR/docker-compose.yml" ps --services --status running | grep -qx "$POSTGRES_SERVICE"
}

postgres_container_exists() {
  docker inspect "$POSTGRES_CONTAINER" >/dev/null 2>&1
}

postgres_container_running() {
  [ "$(docker inspect --format '{{.State.Running}}' "$POSTGRES_CONTAINER" 2>/dev/null || true)" = "true" ]
}

postgres_health_status() {
  docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$POSTGRES_CONTAINER" 2>/dev/null || true
}

wait_for_postgres() {
  local elapsed=0
  local status=""

  until [ "$status" = "healthy" ] || [ "$status" = "running" ]; do
    status="$(postgres_health_status)"

    if [ "$status" = "unhealthy" ]; then
      printf 'PostgreSQL container is unhealthy. Check logs with: docker compose logs postgres\n' >&2
      return 1
    fi

    if [ "$elapsed" -ge "$POSTGRES_TIMEOUT_SECONDS" ]; then
      printf 'PostgreSQL did not become ready within %ss. Last status: %s\n' "$POSTGRES_TIMEOUT_SECONDS" "${status:-unknown}" >&2
      return 1
    fi

    sleep 1
    elapsed=$((elapsed + 1))
  done
}

start_postgres_if_needed() {
  if is_compose_postgres_running; then
    log "PostgreSQL is already running."
  elif postgres_container_running; then
    log "PostgreSQL container ${POSTGRES_CONTAINER} is already running."
  elif postgres_container_exists; then
    log "Starting existing PostgreSQL container ${POSTGRES_CONTAINER}."
    docker start "$POSTGRES_CONTAINER" >/dev/null
  else
    log "Starting PostgreSQL with Docker Compose."
    docker compose -f "$ROOT_DIR/docker-compose.yml" up -d "$POSTGRES_SERVICE"
  fi

  wait_for_postgres
}

start_backend_if_needed() {
  if is_url_ready "$BACKEND_HEALTH_URL"; then
    log "Backend is already running at ${BACKEND_URL}."
    return
  fi

  log "Starting backend at ${BACKEND_URL}."
  (
    cd "$ROOT_DIR"
    ASPNETCORE_ENVIRONMENT=Development \
    ConnectionStrings__Ledgerra="$CONNECTION_STRING" \
    Cors__Origins__0="$FRONTEND_PUBLIC_ORIGIN" \
    Cors__Origins__1="$FRONTEND_URL" \
    exec dotnet run --project backend/src/Ledgerra.Api/Ledgerra.Api.csproj --launch-profile http
  ) &
  BACKEND_PID="$!"

  wait_for_url "Backend" "$BACKEND_HEALTH_URL" "$BACKEND_TIMEOUT_SECONDS"
}

start_frontend_if_needed() {
  if is_url_ready "$FRONTEND_URL"; then
    log "Frontend is already running at ${FRONTEND_URL}."
    return
  fi

  log "Starting frontend at ${FRONTEND_URL}."
  (
    cd "$ROOT_DIR/frontend"
    VITE_API_BASE_URL="$BACKEND_URL" \
    exec npm run dev -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT" --strictPort
  ) &
  FRONTEND_PID="$!"

  wait_for_url "Frontend" "$FRONTEND_URL" "$FRONTEND_TIMEOUT_SECONDS"
}

cleanup() {
  local exit_code=$?

  if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" >/dev/null 2>&1; then
    log "Stopping frontend process."
    kill "$FRONTEND_PID" >/dev/null 2>&1 || true
  fi

  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    log "Stopping backend process."
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi

  exit "$exit_code"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

require_command curl
require_command docker
require_command dotnet
require_command npm
require_docker_daemon

start_postgres_if_needed
start_backend_if_needed
start_frontend_if_needed

log "Ledgerra dev stack is ready."
printf 'Backend:  %s\n' "$BACKEND_URL"
printf 'Frontend: %s\n' "$FRONTEND_URL"
printf 'Postgres: localhost:5432 (%s/%s)\n' "ledgerra" "ledgerra"
printf '\nPress Ctrl+C to stop backend/frontend processes started by this script. PostgreSQL stays running in Docker.\n'

while true; do
  if [ -n "$BACKEND_PID" ] && ! kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    printf 'Backend process stopped unexpectedly.\n' >&2
    exit 1
  fi

  if [ -n "$FRONTEND_PID" ] && ! kill -0 "$FRONTEND_PID" >/dev/null 2>&1; then
    printf 'Frontend process stopped unexpectedly.\n' >&2
    exit 1
  fi

  sleep 2
done
