# Deployment

## Deploy to a remote Docker host

### One-time server setup

On the machine that runs Docker:

1. Install Docker and Docker Compose.
2. Create `data/jellyfin.env` on the server (same as [Docker setup](./setup.md#docker-full-setup)).
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

### Auto-deploy on push (local)

Deploy runs from **your machine** after a successful `git push`, not on GitHub.

One-time setup:

```bash
npm run install:hooks
cp .env.deploy.example .env.thinktower
# edit .env.thinktower with your SSH details
```

After that, every `git push` will:

1. Push to GitHub
2. Run `npm run thinktower` to deploy to your Docker host

Push without deploying:

```bash
SKIP_DEPLOY=1 git push
```

Manual deploy anytime:

```bash
npm run thinktower
```

## Docker image (GHCR)

Official images are published to `ghcr.io/al5ina5/torfin` on every push to `main` and on version tags.

```bash
docker pull ghcr.io/al5ina5/torfin:latest
```

See the [README](../README.md) for the one-command quick start.
