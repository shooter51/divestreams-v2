FROM node:20-alpine

# Install dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN echo "=== npm ci starting ===" && npm ci 2>&1 && echo "=== npm ci complete ==="

# Copy source and build
COPY . .
RUN echo "=== Build starting ===" && \
    echo "Node: $(node -v), NPM: $(npm -v)" && \
    ls -la lib/stubs/ && \
    npm run build 2>&1 && \
    echo "=== Build complete ==="

# Start
CMD ["npm", "run", "start"]
