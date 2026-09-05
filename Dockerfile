# Dockerfile — AI Writer Studio (Sprint 6, Agent 4)
# Mehrstufiger Build: Node baut das Vite-Bundle, Caddy serviert es statisch.

FROM node:22-alpine AS build
WORKDIR /app

# Abhängigkeiten (lockfile-getrieben, reproduzierbar)
COPY package.json package-lock.json ./
RUN npm ci

# Quellen + Build
COPY index.html vite.config.ts tsconfig.json tsconfig.node.json ./
COPY public ./public
COPY src ./src
RUN npm run build

# ── Runtime: Caddy serviert dist/ + kann als /health Endpunkt dienen ──
FROM caddy:2-alpine
COPY --from=build /app/dist /srv
# Zentrale Konfiguration: statisch, SPA-Fallback, Cache für Assets
RUN printf ':80\n{\n\tencode gzip\n}\n\nroot * /srv\nfile_server\n\ntry_files {path} /index.html\n\n@static path /assets/*\nheader @static Cache-Control "public, max-age=31536000, immutable"\n' > /etc/caddy/Caddyfile

EXPOSE 80
