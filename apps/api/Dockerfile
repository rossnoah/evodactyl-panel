FROM oven/bun:1.3 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock* ./
COPY src/prisma/schema.prisma ./src/prisma/schema.prisma
RUN bun install --production
RUN bunx prisma generate --schema=src/prisma/schema.prisma

# Build stage (copy source)
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bunx prisma generate --schema=src/prisma/schema.prisma

# Production
FROM base AS production
ENV NODE_ENV=production
ENV APP_ENV=production

# Create non-root user (Bun image is Debian-based)
RUN groupadd --system --gid 1001 pterodactyl && \
    useradd --system --uid 1001 --gid pterodactyl panel

COPY --from=build --chown=panel:pterodactyl /app /app

# The public directory with frontend assets should be mounted or copied in
# from the main project: docker cp panel/public /app/public
# Or mount as a volume: -v ./public:/app/public:ro

USER panel

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["bun", "run", "src/index.ts"]
