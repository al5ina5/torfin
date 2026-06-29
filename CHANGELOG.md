# Changelog

## Unreleased

## 1.0.0-beta.4 — 2026-06-29

### Added
- easy-torbox-style Torrentio URL presets (quality filter, cached-only, CAM/3D exclusion, Torbox key)
- Enhanced Comet debrid config (dedupe, trash removal, per-resolution limits)
- Playability ranking: cached → direct URL → debrid-ready → peer count
- Optional AIOStreams and MediaFusion indexers under Settings → More indexers (paste your config)
- Inspector overhaul: embedded trailers, genres, external links, episode picker, person credits
- Torrent export without debrid (“Save torrent” path)
- Legal/disclaimer-first onboarding and third-party addon acknowledgment
- Download UI gating (queue visible when addons enabled or jobs exist)

### Changed
- Stream “More” expands profile-filtered results, not raw unfiltered addon output
- Fastest profile caps file size at 5 GB (matches easy-torbox Data Saver)
- Reliable profile picks one best stream per quality tier by playability
- CI smoke tests seed enabled Torrentio plugin for download queue checks

### Fixed
- CI failure: download queue link hidden on fresh install
- Version strings synced to `1.0.0-beta.4`

## 1.0.0-beta.3 and earlier

### Added
- Jellyfin library badges on catalog posters when titles are already in your library
- Skip owned episodes when queueing a full season download
- Play in Jellyfin primary action in the inspector when a library match exists
- Import Jellyfin favorites into the local watchlist (Settings → Downloads)
- Per-episode labels and batch metadata in the download queue, with retry for failed jobs
- Keyboard shortcuts overlay (`?`)
- Pull-to-refresh on mobile catalog views
- Playwright bug-hunt and smoke tests in CI
- `server/jellyfin.mjs` module for Jellyfin API helpers

### Changed
- Playback status overlay shows clearer connecting vs transcoding phases
- Empty watchlist / continue / recent states include actionable next steps

### Fixed
- Jellyfin season episode lookup available on desktop via Tauri
