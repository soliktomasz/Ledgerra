# Ledgerra on Unraid OS

Ledgerra runs as a three-container Docker Compose stack: PostgreSQL, backend,
and frontend. Use the Unraid Docker Compose Manager plugin rather than a single
Community Applications XML container template.

## Install

1. Install Docker Compose Manager from Unraid Community Applications.
2. Create the appdata directory:

   ```bash
   mkdir -p /mnt/user/appdata/ledgerra/postgres
   ```

3. Copy `ledgerra-stack.yml` and `ledgerra-stack.env.example` to
   `/mnt/user/appdata/ledgerra`.
4. Rename `ledgerra-stack.env.example` to `.env`.
5. Edit `.env`:

   - set `POSTGRES_PASSWORD`
   - set `AUTH_SIGNING_KEY`
   - set `LEDGERRA_VERSION` to the release tag
   - change `LEDGERRA_HTTP_PORT` if port `8080` is already used

6. Start the stack from Docker Compose Manager, or from the Unraid terminal:

   ```bash
   cd /mnt/user/appdata/ledgerra
   docker compose -f ledgerra-stack.yml pull
   docker compose -f ledgerra-stack.yml up -d
   ```

Open Ledgerra at `http://<unraid-server-ip>:8080`, or the port configured in
`.env`.

## Upgrade

Change `LEDGERRA_VERSION` in `.env`, then run:

```bash
cd /mnt/user/appdata/ledgerra
docker compose -f ledgerra-stack.yml pull
docker compose -f ledgerra-stack.yml up -d
```
