FROM public.ecr.aws/docker/library/node:22-bookworm-slim AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
COPY vendor ./vendor
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build

FROM public.ecr.aws/docker/library/node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV QUICK_CONVERT_SOFFICE_PATH=/usr/bin/soffice

RUN apt-get update \
  && apt-get install -y --no-install-recommends libreoffice-writer libreoffice-core-nogui \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/server/assets/templates ./assets/templates

EXPOSE 3000
CMD ["node", "dist/index.js"]
