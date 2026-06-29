# Torfin

Torfin is a beta v1 app for browsing Stremio-compatible addon streams and downloading movies to your Jellyfin library. It runs as a macOS desktop app (Tauri) or as a Docker-hosted web app with a built-in download server.

## What you need

- A [Torbox](https://torbox.app) account and API key (for resolving torrent streams)
- A Jellyfin server with a movies library folder
- One of:
  - **macOS desktop** — for SSH downloads directly to a remote Jellyfin host, or local/qBittorrent downloads
  - **Docker server** — for web UI + server-side aria2 downloads into a folder Jellyfin watches

## Quick start (Docker — recommended for Jellyfin downloads)

This is the fastest path to downloading into Jellyfin without installing the macOS app.

### 1. Clone and configure

```bash
git clone https://github.com/al5ina5/torfin.git
cd torfin
npm install
```

Create your server environment file from the example:

```bash
mkdir -p data media/movies
cp data/jellyfin.env.example data/jellyfin.env
```

Edit `data/jellyfin.env`:

| Variable | What to set |
|----------|-------------|
| `JELLYFIN_URL` | Your Jellyfin URL, e.g. `http://jellyfin.local:8096` |
| `JELLYFIN_API_KEY` | Jellyfin API key (Dashboard → API Keys) |
| `JELLYFIN_PATH_MAP_FROM` | Path **inside the container** where downloads land (`/media/movies`) |
| `JELLYFIN_PATH_MAP_TO` | Path **Jellyfin sees** for that folder (e.g. `/movies` if your library mount is `/movies`) |
| `TORBOX_SERVER_API_KEY` | A long random string you choose — required in production |
| `TORBOX_DOWNLOAD_DIR` | Container download path (default `/media/movies`) |

Point `TORFIN_MEDIA_PATH` in `docker-compose.yml` (or via env) at the host folder Jellyfin watches, e.g.:

```yaml
volumes:
  - ./data:/data
  - /srv/storage/media/movies:/media/movies
```

### 2. Build and run

```bash
docker compose up -d --build
```

Open `http://localhost:3020/` (or your host:3020).

### 3. Configure the web app

1. Open **Settings** (gear icon in the sidebar).
2. **Plugins tab** — paste your Torbox API key. Enable Torrentio/Comet/etc. and use `{imdbId}` in stream URL templates.
3. **Downloads tab** — set Jellyfin URL and API key (same as server env if using Docker). Enable **Refresh Jellyfin on complete**.
4. Browse a movie → pick a stream → click **Download**.

The Docker server downloads via aria2 into your movies folder and refreshes Jellyfin when done.

### 4. Optional: protect the API

If you set `TORBOX_SERVER_API_KEY` in `data/jellyfin.env`, also set `VITE_SERVER_API_KEY` when building the frontend:

```bash
VITE_SERVER_API_KEY=your_same_key npm run build
docker compose up -d --build
```

For local dev with auth:

```bash
VITE_SERVER_API_KEY=your_key TORBOX_SERVER_API_KEY=your_key npm run dev:full
```

---

## Quick start (macOS desktop)

```bash
npm install
npm run tauri:dev
```

Requires [FFmpeg](https://ffmpeg.org/) for in-app playback:

```bash
brew install ffmpeg
```

### Desktop Jellyfin downloads (SSH)

1. Open **Settings → Downloads**.
2. Set **Downloader** to **SSH**.
3. Fill in SSH host, username, password, and the remote path Jellyfin watches (e.g. `/srv/storage/media/movies`).
4. Set Jellyfin URL and API key; enable **Refresh Jellyfin on complete**.
5. Pick a stream and click **Download**.

The app resolves the stream through Torbox, then runs `curl` on the remote host over SSH into your library folder.

---

## Deploy to a remote Docker host

### One-time server setup

On the machine that runs Docker:

1. Install Docker and Docker Compose.
2. Create `data/jellyfin.env` on the server (same as local Docker setup above).
3. Ensure the media volume points at your Jellyfin movies folder.

### Local deploy command

Copy the deploy example and fill in your SSH details:

```bash
cp .env.deploy.example .env.thinktower
# edit .env.thinktower — DEPLOY_HOST, DEPLOY_USER, DEPLOY_PASSWORD, etc.
```

Deploy the latest build:

```bash
npm run thinktower
```

This builds the app, rsyncs to the remote host, rebuilds the Docker image, and health-checks `http://<host>:3020/api/health`.

### Auto-deploy on GitHub push

Add these **repository secrets** in GitHub (Settings → Secrets → Actions):

| Secret | Description |
|--------|-------------|
| `DEPLOY_HOST` | SSH hostname or IP |
| `DEPLOY_USER` | SSH username |
| `DEPLOY_PASSWORD` | SSH password **or** use `DEPLOY_SSH_KEY` instead |
| `DEPLOY_SSH_KEY` | (optional) Private SSH key contents |
| `DEPLOY_REMOTE_DIR` | (optional) Remote path, default `~/torfin` |
| `DEPLOY_PORT` | (optional) Health check port, default `3020` |
| `DEPLOY_URL` | (optional) Full health URL override |
| `DEPLOY_DOCKER_USER` | (optional) Container user:group, e.g. `14:staff` if your data dir is not owned by `1000:1000` |
| `DEPLOY_LEGACY_DATA_DIR` | (optional) Existing data directory to reuse |
| `DEPLOY_ENV_FILE` | (optional) Path to server `jellyfin.env` on the host |
| `DEPLOY_MEDIA_PATH` | (optional) Host path mounted as `/media/movies` in the container |
| `DEPLOY_LEGACY_PROJECT` | (optional) Old container name to remove before starting Torfin |

Pushing to `main` runs tests, builds, and deploys when secrets are configured.

---

## Development

```bash
npm install
npm run dev          # Vite only (http://127.0.0.1:5173)
npm run dev:full     # Vite + API server on port 3020
npm run test         # Unit tests
npm run test:ui      # Playwright smoke test (set UI_SMOKE_URL to target a deploy)
npm run lint
npm run tauri:build  # macOS .app bundle
```

---

## Features

- Movies and TV catalog from Cinemeta with infinite scroll
- Stremio addon plugins (Torrentio, Comet, MediaFusion, Knightcrawler)
- Torbox stream resolution for info-hash results
- Ranked stream profiles (Netflix, Data Saver, Cinephile) + custom profiles
- In-app playback with FFmpeg HLS transcoding (macOS)
- Downloads: local folder, SSH remote host, qBittorrent, or Docker aria2 server
- Jellyfin library refresh after downloads
- Watchlist, continue watching, playback progress, themes

---

## Project structure

```
src/           React UI
server/        Node download API helpers
server.mjs     Docker/web download server
src-tauri/     macOS shell (FFmpeg, SSH, Keychain)
scripts/       Deploy and smoke-test scripts
data/          Runtime config (gitignored; see jellyfin.env.example)
```

---

## Security notes

- Never commit `data/jellyfin.env`, `.env.thinktower`, or API keys.
- Desktop: outbound fetch is host-allowlisted; secrets use macOS Keychain.
- Docker: `TORBOX_SERVER_API_KEY` is required in production — the server refuses to start without it.
- Set `VITE_SERVER_API_KEY` in the client when the API requires auth.

---

## License

MIT — see [LICENSE](LICENSE).
