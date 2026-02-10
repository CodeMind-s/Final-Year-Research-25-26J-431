# Multi-stage Dockerfile for NestJS microservices
# Usage: docker build --build-arg SERVICE_NAME=api-gateway -t api-gateway .

FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY nx.json ./
COPY tsconfig*.json ./

# Copy workspace package files
COPY apps/ ./apps/
COPY packages/ ./packages/
COPY proto/ ./proto/
COPY types/ ./types/

# Install all dependencies
RUN npm install --legacy-peer-deps

# Build argument for service name
ARG SERVICE_NAME
ENV SERVICE_NAME=${SERVICE_NAME}

# Build the specific service
RUN npx nx build ${SERVICE_NAME} --configuration=production

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install production dependencies only
RUN apk add --no-cache dumb-init

# Build argument for service name
ARG SERVICE_NAME
ENV SERVICE_NAME=${SERVICE_NAME}
ENV NODE_ENV=production

# Copy built application (includes proto files copied by webpack)
COPY --from=builder /app/dist/apps/${SERVICE_NAME} ./dist/
COPY --from=builder /app/node_modules ./node_modules/

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/main.js"]
