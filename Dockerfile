FROM node:20-alpine AS development-dependencies-env
COPY . /app
WORKDIR /app
RUN npm ci

FROM node:20-alpine AS production-dependencies-env
COPY ./package.json package-lock.json /app/
WORKDIR /app
RUN npm ci --omit=dev

FROM node:20-alpine AS build-env
COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
RUN echo "=== Starting build ===" && \
    echo "Node version: $(node -v)" && \
    echo "NPM version: $(npm -v)" && \
    echo "Contents of /app:" && ls -la /app && \
    echo "Contents of lib/stubs:" && ls -la /app/lib/stubs/ && \
    echo "=== Running npm run build ===" && \
    npm run build 2>&1 || (echo "=== Build failed ===" && exit 1)

FROM node:20-alpine
COPY ./package.json package-lock.json /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
COPY --from=build-env /app/lib /app/lib
WORKDIR /app
CMD ["npm", "run", "start"]
