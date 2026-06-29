# Changelog

## Unreleased

### Added
- Jellyfin library badges on catalog posters when titles are already in your library
- Skip owned episodes when queueing a full season download
- Play in Jellyfin primary action in the inspector when a library match exists
- Import Jellyfin favorites into the local watchlist (Settings → Downloads)
- Per-episode labels and batch metadata in the download queue, with retry for failed jobs
- Keyboard shortcuts overlay (`?`)
- First-run setup prompt for Torbox API key
- Pull-to-refresh on mobile catalog views
- Playwright bug-hunt and smoke tests in CI
- `server/jellyfin.mjs` module for Jellyfin API helpers

### Changed
- Playback status overlay shows clearer connecting vs transcoding phases
- Empty watchlist / continue / recent states include actionable next steps

### Fixed
- Jellyfin season episode lookup available on desktop via Tauri
