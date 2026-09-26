# ==============================================================================
# AetherPanel - Universal Production Container Image
# Multi-arch support: linux/amd64, linux/arm64
# Compatible with Docker, Podman, Kubernetes, Proxmox LXC, Coolify, Portainer
# ==============================================================================

FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ git curl

# Copy package descriptors
COPY package*.json ./

# Install dependencies (clean install)
RUN npm ci

# Copy application source
COPY . .

# Compile production bundles (frontend + backend)
RUN npm run build

# Production runtime image
FROM node:22-alpine AS runner

WORKDIR /app

# Install essential runtime tools (bash, curl, tar, procps, git, OpenJDK for Minecraft)
RUN apk add --no-cache \
    bash \
    curl \
    git \
    tar \
    xz \
    procps \
    coreutils \
    libstdc++ \
    ca-certificates \
    openjdk21-jre-headless \
    openjdk17-jre-headless

ENV NODE_ENV=production
ENV PORT=3000
ENV SFTP_PORT=2022
ENV HOST=0.0.0.0

# Copy package descriptors and install production-only dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled bundles and static assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/public ./public
COPY --from=builder /app/index.html ./index.html
COPY --from=builder /app/metadata.json ./metadata.json

# Create required persistent data directories
RUN mkdir -p /app/data /app/data/servers /app/data/backups /app/data/logs /app/bin

# Expose Web Panel (3000), SFTP (2022), and Daemon (8080) ports
EXPOSE 3000 2022 8080 25565

# Volumes for persistent state across restarts
VOLUME ["/app/data"]

# Health check
HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start AetherPanel control plane
CMD ["npm", "start"]
