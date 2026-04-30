# Ledgerra on TrueNAS SCALE

TrueNAS SCALE 24.10 and newer can install third-party apps from Docker Compose
YAML through **Apps > Discover Apps > more_vert > Install via YAML**.

## Install via YAML

1. Create a dataset for PostgreSQL data, for example:

   ```text
   /mnt/tank/apps/ledgerra/postgres
   ```

2. Open **Apps > Discover Apps > more_vert > Install via YAML**.
3. Set the app name to `ledgerra`.
4. Paste `ledgerra-custom-app.yaml` into **Custom Config**.
5. Before saving, replace:

   - `replace-with-a-long-random-password`
   - `replace-with-at-least-32-random-characters`
   - `/mnt/tank/apps/ledgerra/postgres` if your dataset path differs
   - `v0.1.0` with the release tag you want
   - host port `8080` if it is already used

Open Ledgerra at `http://<truenas-ip>:8080`, or the host port configured in
the YAML.

## Metadata

`app-metadata.yaml` is a lightweight metadata record for publishing or tracking
Ledgerra as a TrueNAS custom app. It is not a full TrueNAS catalog contribution;
the installable artifact for users is `ledgerra-custom-app.yaml`.
