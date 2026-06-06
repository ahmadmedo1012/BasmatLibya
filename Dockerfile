# syntax=docker/dockerfile:1.7

# --- Stage 1: deps ----------------------------------------------------------
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

# --- Stage 2: build ---------------------------------------------------------
FROM deps AS build
COPY . .
RUN pnpm --filter @basmat/shared build \
 && pnpm --filter @basmat/server build \
 && pnpm --filter @basmat/web build

# --- Stage 3: runtime -------------------------------------------------------
FROM node:22-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

# Bring over only what the server needs at runtime.
COPY --from=build /repo/package.json /repo/pnpm-workspace.yaml /repo/pnpm-lock.yaml ./
COPY --from=build /repo/packages/shared/package.json packages/shared/
COPY --from=build /repo/packages/shared/dist        packages/shared/dist
COPY --from=build /repo/apps/server/package.json    apps/server/
COPY --from=build /repo/apps/server/dist            apps/server/dist
# Drizzle's runtime migrator reads .sql files + meta/_journal.json from disk.
# The preDeployCommand (render.yaml) runs `pnpm db:migrate` from the runtime
# image, so the migrations folder must be present at the same path the
# compiled migrate.js resolves relative to itself (apps/server/dist/db/migrations).
COPY --from=build /repo/apps/server/src/db/migrations apps/server/dist/db/migrations
COPY --from=build /repo/apps/web/dist               apps/web/dist
RUN pnpm install --prod --frozen-lockfile

USER node

EXPOSE 3001
CMD ["node", "apps/server/dist/index.js"]
