# Setup

## What you need

- A [Torbox](https://torbox.app) account and API key (for resolving torrent streams)
- A Jellyfin server with a movies library folder
- One of:
  - **Desktop** (macOS, Linux, or Windows) — SSH downloads to a remote Jellyfin host, or local/qBittorrent downloads
  - **Docker server** — web UI + server-side aria2 downloads into a folder Jellyfin watches

## Docker (full setup)

The [README](../README.md) one-liner is enough to try Torfin. For Jellyfin integration, configure volumes and environment.

### 1. Clone and configure

```bash
git clone https://github.com/al5ina5/torfin.git
cd torfin
npm install
```

Create your server environment file:

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
| `JELLYFIN_PATH_MAP_TO` | Path **Jellyfin sees** for that folder (e.g. `/movies`) |
| `TORBOX_SERVER_API_KEY` | A long random string — recommended before exposing Torfin to a network |
| `TORBOX_DOWNLOAD_DIR` | Container download path (default `/media/movies`) |

Point `TORFIN_MEDIA_PATH` in `docker-compose.yml` (or via env) at the host folder Jellyfin watches:

```yaml
volumes:
  - ./data:/data
  - /srv/storage/media/movies:/media/movies
```

### 2. Build and run

```bash
docker compose up -d --build
```

Open [http://localhost:3020](http://localhost:3020).

### 3. Configure the web app

1. Open **Settings** (gear icon in the sidebar).
2. **Settings** — under **Accounts**, paste your Torbox API key. Under **Addons**, enable Torrentio/Comet/etc. and use `{imdbId}` in stream URL templates.
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
VITE_SERVER_API_KEY=your_key TORBOX_SERVER_API_KEY=your_key yarn dev
```

## Desktop

Download the build for your platform from [Releases](https://github.com/al5ina5/torfin/releases/latest):

| Platform | File to grab |
|----------|----------------|
| macOS (Apple Silicon) | `*_aarch64.dmg` — open the `.dmg` and drag Torfin to Applications |
| Linux | `*_amd64.AppImage` (portable) or `*_amd64.deb` (Debian/Ubuntu) |
| Windows | `*_x64-setup.exe` (NSIS installer) |

Pushing a `v*` tag triggers CI to build all three and publish them on the same GitHub release.

For development from source:

```bash
npm install
npm run tauri:dev
```

Requires [FFmpeg](https://ffmpeg.org/) for in-app playback on macOS:

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

## Features

- Movies and TV catalog from Cinemeta with infinite scroll
- Stremio addon plugins (Torrentio, Comet, MediaFusion, Knightcrawler)
- Torbox stream resolution for info-hash results
- Ranked stream profiles (Netflix, Data Saver, Cinephile) + custom profiles
- In-app playback with FFmpeg HLS transcoding (macOS)
- Downloads: local folder, SSH remote host, qBittorrent, or Docker aria2 server
- Jellyfin library refresh after downloads
- Watchlist, continue watching, playback progress, themes
