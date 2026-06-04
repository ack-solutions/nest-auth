# syntax=docker/dockerfile:1
#
# Backend image — the example-nest reference app.
# Serves: the auth REST API + Swagger UI (/api) + the admin console SPA (/api/auth/admin).
#
# Built from the monorepo root context so the workspace packages resolve.
#   docker build -f apps/example-nest/Dockerfile -t nest-auth-backend .

FROM node:20-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /repo

# Copy the whole monorepo (node_modules / dist excluded via .dockerignore).
COPY . .

# Install workspace deps from the frozen lockfile.
RUN pnpm install --frozen-lockfile

# Build the backend AND the admin console SPA bundle. Turbo resolves the graph:
#   contracts -> nest-auth (tsc + swagger) -> nest-auth-admin (vite) + example-nest
RUN pnpm turbo run build --filter=example-nest --filter=@ackplus/nest-auth-admin

# Non-production so cookies aren't forced Secure (HTTPS) for local http testing,
# and the debug logger stays readable. Override per your needs.
ENV NODE_ENV=development
ENV PORT=3333

EXPOSE 3333
WORKDIR /repo/apps/example-nest
CMD ["node", "dist/main.js"]
