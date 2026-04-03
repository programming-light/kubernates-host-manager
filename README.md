# K8s Hosting Platform - Multi-Tenant Kubernetes Management

A production-ready, multi-tenant Kubernetes hosting platform combining the best of Vercel and Hostinger. Built with Next.js, NestJS, PostgreSQL, and Redis.

## Overview

This platform allows teams to:
- Host multiple applications on shared Kubernetes clusters
- Deploy via Git integration
- Manage domains and SSL certificates
- Scale applications automatically
- View real-time logs and metrics
- Manage billing and subscriptions
- Audit all system changes

## Architecture

### Monorepo Structure

```
k8s-hosting-platform/
├── packages/
│   ├── frontend/          # Next.js 16 admin dashboard
│   ├── backend/           # NestJS API server
│   ├── worker/            # BullMQ job processor
│   └── shared/            # Shared types, schemas, utilities
├── infra/                 # Docker & Kubernetes configs
├── docker-compose.yml     # Local development environment
├── pnpm-workspace.yaml    # Monorepo workspace config
└── README.md
```

### Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: NestJS, PostgreSQL, TypeScript
- **Jobs**: BullMQ, Redis
- **Database**: PostgreSQL with Prisma ORM
- **Kubernetes**: Official Kubernetes Node.js client
- **Authentication**: JWT (access + refresh tokens)
- **Encryption**: Node.js crypto for credential storage

## Prerequisites

- Node.js 18+ (or install via nvm)
- pnpm 8+ (`npm install -g pnpm`)
- Docker & Docker Compose
- Git

## Local Development Setup

### 1. Clone and Install Dependencies

```bash
# Install pnpm globally
npm install -g pnpm

# Install monorepo dependencies
pnpm install
```

### 2. Start Local Services

```bash
# Start PostgreSQL, Redis, and Adminer in Docker
docker-compose up -d

# Verify services are healthy
docker-compose ps
```

This starts:
- **PostgreSQL**: localhost:5432 (devuser/devpassword)
- **Redis**: localhost:6379
- **Adminer**: http://localhost:8080 (for database management)

### 3. Configure Environment Variables

```bash
# Copy example env file
cp .env.example .env.local

# Edit .env.local with your settings
# Key variables needed:
# - DATABASE_URL: Already set for local dev
# - JWT_SECRET: Generate a random string
# - ENCRYPTION_KEY: 32-character hex string
```

To generate keys:

```bash
# Generate JWT_SECRET (use output)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate ENCRYPTION_KEY (use output)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

### 4. Set up Database

```bash
# Run migrations
pnpm db:migrate

# Seed demo data
pnpm db:seed

# View database with Prisma Studio
pnpm db:studio
```

### 5. Start Development Servers

```bash
# Terminal 1: All services in dev mode
pnpm dev

# Or run individually:
# pnpm -w -r dev

# Terminal 2 (if separate): Frontend only
cd packages/frontend && pnpm dev

# Terminal 3 (if separate): Backend only
cd packages/backend && pnpm dev

# Terminal 4 (if separate): Worker only
cd packages/worker && pnpm dev
```

Access the application:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001/api
- **Database Admin**: http://localhost:8080

## Project Structure

### Packages

#### `packages/shared`
Shared types, interfaces, and validation schemas used across frontend and backend.

**Key exports:**
- `User`, `Tenant`, `Plan`, `Cluster`, `Project`, `Deployment` types
- `RegisterSchema`, `LoginSchema`, `CreateProjectSchema` validation schemas
- Role and status enums

#### `packages/backend`
NestJS REST API with complete business logic.

**Modules:**
- **Auth**: Registration, login, token refresh
- **Users**: User CRUD, profile management
- **Tenants**: Workspace/organization management
- **Billing**: Plan management, subscription lifecycle
- **Clusters**: Kubernetes cluster integration
- **Projects**: Git-based project management
- **Deployments**: Build and deployment orchestration
- **Admin**: Admin-only endpoints for system management

**Features:**
- JWT authentication with refresh tokens
- Role-based access control (RBAC)
- Request validation and sanitization
- Rate limiting on auth endpoints
- Comprehensive error handling
- Request/response logging

#### `packages/frontend`
Next.js admin dashboard for managing the platform.

**Pages:**
- `/` - Landing page
- `/login`, `/register` - Authentication
- `/dashboard` - Overview and stats
- `/projects` - Project management
- `/projects/[id]/deployments` - Deployment history
- `/projects/[id]/settings` - Project configuration
- `/billing` - Plan selection and invoices
- `/admin` - Admin panel (role-gated)

**Features:**
- Protected routes with role-based access
- API client with error handling
- Real-time deployment status
- Form validation
- Toast notifications
- Responsive design

#### `packages/worker`
BullMQ-based job processor for async operations.

**Jobs:**
- Deployment builds and K8s deployments
- SSL certificate provisioning
- Autoscaling triggers
- Health checks
- Cleanup operations
- Email notifications

**Features:**
- Retry logic with exponential backoff
- Dead-letter queue for failed jobs
- Job progress tracking
- Comprehensive logging

### Infrastructure

#### `docker-compose.yml`
Local development environment with PostgreSQL, Redis, and Adminer.

#### Database Schema (Prisma)
13+ tables covering:
- User management and authentication
- Multi-tenant workspace isolation
- Billing and subscriptions
- Kubernetes cluster integration
- Project and deployment tracking
- Domain and SSL management
- Audit logging

## API Documentation

### Authentication

```bash
# Register
POST /api/auth/register
Body: { email, password, name }

# Login
POST /api/auth/login
Body: { email, password }
Response: { accessToken, refreshToken, expiresIn }

# Refresh Token
POST /api/auth/refresh
Body: { refreshToken }
Response: { accessToken, expiresIn }
```

### Projects

```bash
# List projects
GET /api/projects

# Create project
POST /api/projects
Body: { name, description, gitUrl, clusterId }

# Get project
GET /api/projects/:id

# Update project
PATCH /api/projects/:id
Body: { name, description, status }

# Delete project
DELETE /api/projects/:id
```

### Deployments

```bash
# Trigger deployment
POST /api/projects/:id/deployments
Body: { commitSha, commitMessage }

# Get deployment logs
GET /api/deployments/:id/logs

# Restart service
POST /api/deployments/:id/restart

# Rollback deployment
POST /api/deployments/:id/rollback
```

### Billing

```bash
# Get available plans
GET /api/plans

# Get current subscription
GET /api/subscriptions

# Create subscription
POST /api/subscriptions
Body: { planId }

# Cancel subscription
DELETE /api/subscriptions/:id
```

## Database Migrations

### Create New Migration

```bash
cd packages/backend

# Make schema changes in prisma/schema.prisma

# Create migration
pnpm prisma migrate dev --name description_of_changes

# Apply in production
pnpm prisma migrate deploy
```

### Reset Database (Development Only)

```bash
cd packages/backend
pnpm prisma migrate reset
```

## Security Considerations

### Credentials
- Cluster credentials encrypted at rest using AES-256
- Keys stored separately from credentials
- Never exposed to frontend

### Multi-tenancy
- Database-level tenant isolation
- Namespace scoping for Kubernetes resources
- API endpoints validate tenant ownership
- Row-level security in PostgreSQL

### Authentication
- JWT with short-lived access tokens (15 minutes default)
- Refresh tokens for longer sessions (7 days default)
- Secure cookie storage for tokens
- Password hashing with bcrypt

### Audit Trail
- Every action logged with user, timestamp, changes
- Immutable audit log
- Searchable by tenant, user, resource type

## Environment Variables

See `.env.example` for complete list. Key variables:

```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=<32-char-hex>
JWT_REFRESH_SECRET=<32-char-hex>
ENCRYPTION_KEY=<32-char-hex>
```

## Deployment

### Docker Build

Each package has a Dockerfile:

```bash
# Build backend image
cd packages/backend
docker build -t k8s-platform-backend:latest .

# Build frontend image
cd packages/frontend
docker build -t k8s-platform-frontend:latest .

# Build worker image
cd packages/worker
docker build -t k8s-platform-worker:latest .
```

### Kubernetes Manifests

See `infra/k8s/` for example deployments covering:
- Backend API deployment
- Frontend static hosting
- Worker job processor
- Service definitions
- Ingress configuration
- ConfigMaps and Secrets

### Environment-Specific Config

Production deployments should use:
- Separate `.env.production` file
- Database replicas and backups
- Redis cluster with persistence
- JWT secrets from secure vault
- HTTPS/TLS enforcement
- Rate limiting configured per environment

## Troubleshooting

### Port Already in Use

```bash
# Find process on port
lsof -i :3000  # frontend
lsof -i :3001  # backend
lsof -i :3002  # worker

# Kill process
kill -9 <PID>
```

### Database Connection Failed

```bash
# Check PostgreSQL is running
docker-compose ps

# View logs
docker-compose logs postgres

# Restart services
docker-compose restart
```

### Migrations Not Applied

```bash
# View migration status
cd packages/backend
pnpm prisma migrate status

# Reset and re-apply (dev only)
pnpm prisma migrate reset
```

## Contributing

1. Create feature branch: `git checkout -b feature/feature-name`
2. Make changes
3. Run linter: `pnpm lint`
4. Commit: `git commit -am 'Add feature'`
5. Push: `git push origin feature/feature-name`
6. Create pull request

## License

Private - All rights reserved

## Support

For issues or questions, open an issue in the repository.
