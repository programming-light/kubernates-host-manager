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
COPY packages/frontend ./packages/frontend

# Install dependencies
RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile

# Build frontend
RUN cd packages/frontend && pnpm build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm

# Copy Next.js build from builder
COPY --from=builder /app/packages/frontend/.next ./.next
COPY --from=builder /app/packages/frontend/public ./public
COPY --from=builder /app/packages/frontend/package.json ./
COPY --from=builder /app/packages/frontend/node_modules ./node_modules

ENV NODE_ENV=production
EXPOSE 3000

CMD ["pnpm", "start"]
