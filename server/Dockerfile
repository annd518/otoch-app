# OTOCH API — staging/test image (provider-agnostic). Not yet built or deployed.
#   docker build -t otoch-api .                      # runtime image
#   docker build -t otoch-api-migrate --target migrate .   # one-off: prisma migrate deploy
# All configuration comes from environment variables (see docs/l1-1-backend-plan.md §6).

FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY prisma ./prisma
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY assets ./assets
RUN npx prisma generate && npx tsc -p tsconfig.build.json

# Release step: applies committed migrations only (never db push / migrate reset)
FROM build AS migrate
CMD ["npx", "prisma", "migrate", "deploy"]

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/assets ./assets
COPY prisma/schema.prisma ./prisma/schema.prisma
# Committed migrations, so a platform pre-deploy step can run `prisma migrate deploy`
# from this image (render.yaml); the CLI is fetched at that step, not shipped.
COPY prisma/migrations ./prisma/migrations
# Private bucket probe for the deployed container (docs/release/l1-1-release-6-10.md)
COPY scripts/storage-probe.cjs ./scripts/storage-probe.cjs
USER node
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
