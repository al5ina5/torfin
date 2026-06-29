<pre align="center">
████████╗ ██████╗ ██████╗ ███████╗██╗███╗   ██╗
╚══██╔══╝██╔═══██╗██╔══██╗██╔════╝██║████╗  ██║
   ██║   ██║   ██║██████╔╝█████╗  ██║██╔██╗ ██║
   ██║   ██║   ██║██╔══██╗██╔══╝  ██║██║╚██╗██║
   ██║   ╚██████╔╝██║  ██║██║     ██║██║ ╚████║
   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═══╝
</pre>

<h1 align="center">Torfin</h1>

<p align="center">
  <strong>Your Jellyfin library. Your services.</strong><br>
  Browse catalogs, connect your own debrid account and Stremio-compatible addons, and import downloads into Jellyfin.
</p>

<p align="center">
  <a href="https://github.com/al5ina5/torfin/releases/latest">Download</a>
  ·
  <a href="https://github.com/al5ina5/torfin/pkgs/container/torfin">Docker</a>
  ·
  <a href="docs/README.md">Docs</a>
</p>

<br>

<p align="center">
  <img src="docs/assets/screenshot.png" alt="Torfin — browse movies, pick streams, download to Jellyfin" width="920">
</p>

<br>

## Install

### Desktop

Download the build for your platform from [Releases](https://github.com/al5ina5/torfin/releases/latest):

| Platform | File to grab |
|----------|----------------|
| [macOS](https://github.com/al5ina5/torfin/releases/latest) (Apple Silicon) | `*_aarch64.dmg` |
| [Linux](https://github.com/al5ina5/torfin/releases/latest) | `*_amd64.AppImage` or `*_amd64.deb` |
| [Windows](https://github.com/al5ina5/torfin/releases/latest) | `*_x64-setup.exe` or `*.msi` |

Open the app, paste your Torbox key on first launch, then open **Settings** to wire up plugins and Jellyfin.

New tags (`v*`) automatically build all three platforms and attach them to the GitHub release.

---

### Docker

**One command. Open the browser.**

```bash
docker run -d --name torfin -p 3020:3020 -v torfin-data:/data -v torfin-movies:/media/movies ghcr.io/al5ina5/torfin:latest
```

Then go to **[http://localhost:3020](http://localhost:3020)**

Mount your real movies folder by swapping `torfin-movies` for a host path, e.g. `-v /srv/media/movies:/media/movies`. Full Jellyfin setup lives in the [docs](docs/setup.md).

---

<p align="center">
  <sub>MIT · homelab client for Jellyfin · <a href="docs/legal.md">Legal notice</a></sub>
</p>
