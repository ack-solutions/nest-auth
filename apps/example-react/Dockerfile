# syntax=docker/dockerfile:1
#
# Frontend image — the example-react SPA (signup / login / MFA / sessions / profile).
# Built from the monorepo root context, served as static files by nginx.
#   docker build -f apps/example-react/Dockerfile -t nest-auth-web .
#
# NOTE: VITE_API_BASE_URL is baked at BUILD time (Vite inlines import.meta.env).
# It must be the URL the BROWSER uses to reach the backend (the host-mapped port),
# NOT a docker-internal hostname — the SPA runs in the user's browser.

FROM node:20-bookworm-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile

ARG VITE_API_BASE_URL=http://localhost:3333/api
# Write the .env so Vite bakes the value in (deterministic regardless of .dockerignore).
RUN printf 'VITE_API_BASE_URL=%s\n' "$VITE_API_BASE_URL" > apps/example-react/.env

# Turbo builds the SDK deps first (contracts -> client -> react) then example-react.
RUN pnpm turbo run build --filter=example-react

# --- serve stage ---
FROM nginx:1.27-alpine AS serve
COPY apps/example-react/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/example-react/dist /usr/share/nginx/html
EXPOSE 80
