# Kubernetes Host Manager

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen?style=for-the-badge&logo=vercel)](https://k8s-host-manager.vercel.app)

A modern platform for hosting containerized applications on Kubernetes with CI/CD integration, real-time monitoring, and team collaboration.

## Architecture Overview

```
kubernates-host-manager/
├── server/              # Backend API (Express + Prisma + Socket.IO)
│   └── src/
│       ├── controllers/ # Separated controllers (auth, projects, etc.)
│       ├── models/      # Type definitions and schemas
│       ├── routes/      # API routes
│       ├── lib/         # Utilities (k8s-deploy, socket, etc.)
│       └── index.ts     # Optimized server entry point
│
├── client/             # Protected Dashboard (Next.js)
│   └── app/
│       ├── dashboard/   # Protected routes (Auth required)
│       ├── auth/        # Public auth pages (login, register)
│       └── components/  # Reusable UI components
│
├── public-client/       # Public Pages (Next.js with ISR/SSG)
│   └── app/
│       ├── page.tsx     # Home page (revalidates every 1hr)
│       ├── pricing/     # Pricing page (revalidates every 1hr)
│       ├── services/    # Services page (revalidates every 24hrs)
│       ├── products/    # Products page (revalidates every 24hrs)
│       └── contact/     # Contact page (revalidates every 24hrs)
│
└── k8s/               # Kubernetes deployment configs
```

## Key Features

### 1. **Separated Controllers & Models**
- All routes use dedicated controllers for better separation of concerns
- Type definitions in `server/src/models/`
- Controllers: `auth`, `projects`, `workspaces`, `users`, `clusters`, `kubernetes`, `cicd`, `payments`, `plans`

### 2. **Kubernetes-Native Env Vars**
- Environment variables stored in K8s ConfigMaps (non-secret) and Secrets (secret)
- No env vars in database - uses labels like `app-{slug}` for projects
- `k8sDeployManager.getEnvVarsFromK8s()` / `setEnvVarsToK8s()` in `server/src/lib/k8s-deploy.ts`

### 3. **Public-Client with ISR/SSG**
- Separate Next.js app for public pages (`public-client/`)
- Pages are statically generated at build time
- Incremental Static Regeneration (ISR) for periodic revalidation
- No server calls on every request - pages are cached as static HTML
- Revalidation times:
  - Home: 1 hour
  - Pricing: 1 hour
  - Services/Products/Contact: 24 hours

### 4. **Frontend Optimization**
- Lazy loading with `React.lazy()` + `Suspense`
- Separated components in `client/components/`:
  - `dashboard/` - StatCards, QuickActions, RecentWorkspaces, RecentProjects
  - `kubernetes/` - PodsList, ServicesList, DeploymentsList, etc.
  - `projects/`, `clusters/`, `deployments/` - Reusable card components

### 5. **Public vs Protected Routes**
- **Public pages** (public-client): Home, Pricing, Services, Products, Contact
- **Auth pages** (client): Login, Register
- **Protected pages** (client): Dashboard, Projects, Deployments, Kubernetes, etc.
- Dashboard layout wraps with `AuthProvider` + `SocketProvider`

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL
- Docker (for Kubernetes integration)
- Kubernetes cluster (for production)

### Installation

1. **Install dependencies:**
```bash
# Server
cd server && npm install

# Protected client (dashboard)
cd client && npm install

# Public client (static pages)
cd public-client && npm install
```

2. **Set up environment variables:**

Create `.env` in `server/`:
```
DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/k8s_platform?schema=public"
JWT_SECRET="your-super-secret-jwt-key"
PORT=3001
```

3. **Run database migrations:**
```bash
cd server
npx prisma migrate dev
npx prisma generate
```

4. **Start development servers:**

```bash
# Terminal 1: Server (API)
cd server && npm run dev

# Terminal 2: Protected client (Dashboard)
cd client && npm run dev  # Runs on :3000

# Terminal 3: Public client (Static pages)
cd public-client && npm run dev  # Runs on :3002
```

## Deployment

### Using Docker Compose:
```bash
docker-compose up -d
```

This starts:
- PostgreSQL on port 5432
- Server (API) on port 3001
- Protected client (Dashboard) on port 3000
- Public client (Static pages) on port 3002

### Kubernetes Deployment:
```bash
kubectl apply -f k8s/postgres-deployment.yaml
kubectl apply -f k8s/server-deployment.yaml
kubectl apply -f k8s/app-secrets.yaml
kubectl apply -f k8s/k8s-configmap.yaml
```

## Environment Variables Handling

**Important**: Env vars are NO LONGER stored in the database. They are now stored in Kubernetes:

- **ConfigMaps** (non-secret): `kubectl get configmap app-{slug}-config -n {namespace}`
- **Secrets** (secret): `kubectl get secret app-{slug}-secret -n {namespace}`

To set env vars for a project:
```typescript
await k8sDeployManager.setEnvVarsToK8s(namespace, 'app-{slug}', envVars);
```

To get env vars:
```typescript
const envVars = await k8sDeployManager.getEnvVarsFromK8s(namespace, 'app-{slug}');
```

## API Endpoints

### Auth
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `GET /api/v1/auth/me` - Get current user

### Projects
- `GET /api/v1/projects` - List projects
- `POST /api/v1/projects` - Create project
- `GET /api/v1/projects/:id` - Get project details
- `PUT /api/v1/projects/:id` - Update project
- `DELETE /api/v1/projects/:id` - Delete project

### Kubernetes
- `GET /api/v1/kubernetes/status` - Get cluster status
- `GET /api/v1/kubernetes/pods` - List pods
- `GET /api/v1/kubernetes/services` - List services
- `POST /api/v1/kubernetes/create-deployment` - Create deployment
- `POST /api/v1/kubernetes/create-service` - Create service
- `DELETE /api/v1/kubernetes/delete-resource` - Delete resource

## License

MIT
