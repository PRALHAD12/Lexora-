# =========================================================
# Stage 1: Build & Dependencies
# =========================================================
FROM node:20-alpine AS dependencies

WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# =========================================================
# Stage 2: Production Runner
# =========================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Set node env to production
ENV NODE_ENV=production
ENV PORT=5000

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S express -u 1001

# Copy dependencies and application source code
COPY --from=dependencies /app/node_modules ./node_modules
COPY package*.json ./
COPY src/ ./src/

# Set correct permissions
RUN chown -R express:nodejs /app

# Switch to non-root user
USER express

# Expose server port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/v1/health || exit 1

# Entry point
CMD ["node", "src/server.js"]
