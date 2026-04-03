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
COPY packages/worker ./packages/worker

# Install dependencies
RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile

# Build shared and worker
RUN cd packages/shared && pnpm build && \
    cd ../worker && pnpm build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm

# Copy from builder
COPY --from=builder /app/packages/worker/dist ./dist
COPY --from=builder /app/packages/worker/node_modules ./node_modules
COPY --from=builder /app/packages/worker/prisma ./prisma

# Copy .env file
COPY packages/worker/.env .env

ENV NODE_ENV=production

CMD ["node", "dist/main.js"]
