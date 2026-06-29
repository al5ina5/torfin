# Development

```bash
npm install
yarn dev             # UI at http://localhost:5173 (+ API on 127.0.0.1:3020)
npm run test         # Unit tests
npm run test:ui      # Playwright smoke test (set UI_SMOKE_URL to target a deploy)
npm run lint
npm run tauri:build  # desktop bundle (.dmg / .AppImage / .msi)
```

## Project structure

```
src/           React UI
server/        Node download API helpers
server.mjs     Docker/web download server
src-tauri/     Tauri desktop shell (FFmpeg, SSH, Keychain on macOS)
scripts/       Deploy and smoke-test scripts
data/          Runtime config (gitignored; see jellyfin.env.example)
docs/          Full documentation
```
