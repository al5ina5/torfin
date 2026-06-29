FROM node:22-bookworm-slim AS build

WORKDIR /app
ARG VITE_SERVER_API_KEY=
ENV VITE_SERVER_API_KEY=$VITE_SERVER_API_KEY
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends aria2 wget curl ca-certificates ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3020
ENV TORBOX_DATA_DIR=/data
ENV TORBOX_DOWNLOAD_DIR=/media/movies

COPY --from=build /app/dist ./dist
COPY --from=build /app/server.mjs ./server.mjs
COPY --from=build /app/server ./server
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3020
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD curl -f "http://127.0.0.1:3020/api/health" || exit 1
ENTRYPOINT ["docker-entrypoint.sh"]
