FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production image
FROM node:20-alpine AS production
WORKDIR /app

# Copy package files and install production deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built application
COPY --from=builder /app/build ./build
COPY --from=builder /app/lib ./lib

# Copy migration files and scripts
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts/run-migrations.mjs ./scripts/run-migrations.mjs
COPY --from=builder /app/scripts/setup-admin.mjs ./scripts/setup-admin.mjs
COPY --from=builder /app/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
RUN chmod +x ./scripts/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
