# Troubleshooting

## Downloads finish but Jellyfin does not show the movie

1. Confirm `JELLYFIN_PATH_MAP_FROM` matches where files land **inside the container** (usually `/media/movies`).
2. Confirm `JELLYFIN_PATH_MAP_TO` matches the path **Jellyfin uses** for that library (e.g. `/movies`).
3. Check the download job in Torfin — if import verification failed, run a manual library scan in Jellyfin.
4. Ensure the filename is a video extension (`.mkv`, `.mp4`, etc.).

## Streams fail to play in the browser

- Docker/web: FFmpeg must be available on the server (included in the Docker image).
- macOS app: install FFmpeg (`brew install ffmpeg`) or use the native player (IINA/mpv).
- Try another stream result or profile — some codecs require transcoding.

## UI tests fail locally

```bash
npm run build
PORT=3026 node server.mjs
UI_SMOKE_URL=http://127.0.0.1:3026/ npm run test:ui:all
```

## CI UI tests

CI starts the production server on port 3026 after `npm run build` and runs `test:ui` + `test:bug-hunt`.
