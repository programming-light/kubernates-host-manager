# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy monorepo files
COPY pnpm-lock.yaml ./
COPY package.json ./
COPY pnpm-workspace.yaml ./
COPY tsconfig.json ./

# Copy packages
COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend

# Install dependencies
RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile

# Build shared and backend
RUN cd packages/shared && pnpm build && \
    cd ../backend && pnpm build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm

# Copy from builder
COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=builder /app/packages/backend/node_modules ./node_modules
COPY --from=builder /app/packages/backend/prisma ./prisma

# Copy .env file (will be overridden at runtime)
COPY packages/backend/.env .env

# Run migrations and start
ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "dist/main.js"]
