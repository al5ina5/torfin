# Security

- Never commit `data/jellyfin.env`, `.env.thinktower`, or API keys.
- Desktop: outbound fetch is host-allowlisted; secrets use macOS Keychain.
- Docker: set `TORBOX_SERVER_API_KEY` before exposing Torfin beyond localhost.
- Set `VITE_SERVER_API_KEY` in the client build when the API requires auth (must match the server key).

The quick-start `docker run` command leaves the API open on your machine by default. This is fine for local use; add a server key and rebuild with `VITE_SERVER_API_KEY` for shared or internet-facing hosts.
