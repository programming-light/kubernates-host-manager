# Architecture Overview

## Separated Apps Architecture

```
kubernates-host-manager/
├── server/              # Backend API (Express + Prisma + Socket.IO)
│   └── src/
│       ├── controllers/   # Separated controllers (auth, projects, etc.)
│       ├── models/        # Type definitions (env-var, user, workspace, project)
│       ├── routes/        # API routes using controllers
│       ├── lib/           # Utilities (k8s-deploy, socket, etc.)
│       └── index.ts       # Optimized server entry (v3)
│
├── client/              # Protected Dashboard (Next.js) - Port 3000
│   └── app/
│       ├── dashboard/      # Protected routes (Auth required)
│       │   ├── page.tsx
│       │   ├── projects/
│       │   ├── deployments/
│       │   ├── kubernetes/
│       │   ├── clusters/
│       │   └── components/  # Lazy-loaded components
│       ├── auth/           # Public auth pages (login, register)
│       └── components/     # Reusable UI components
│
├── public-client/       # Public Pages (Next.js with ISR/SSG) - Port 3002
│   └── app/
│       ├── page.tsx        # Home (revalidate: 1hr)
│       ├── pricing/        # Pricing (revalidate: 1hr)
│       ├── services/       # Services (revalidate: 24hrs)
│       ├── products/       # Products (revalidate: 24hrs)
│       └── contact/        # Contact (revalidate: 24hrs)
│
└── k8s/                # Kubernetes deployment configs
```

## Key Changes Made

### 1. Backend - Controllers & Models Separated
- **Before**: All logic in routes files
- **After**: Logic separated into controllers
  - `server/src/controllers/auth.controller.ts`
  - `server/src/controllers/projects.controller.ts`
  - `server/src/controllers/workspaces.controller.ts`
  - `server/src/controllers/users.controller.ts`
  - `server/src/controllers/clusters.controller.ts`
  - `server/src/controllers/kubernetes.controller.ts`
  - `server/src/controllers/cicd.controller.ts`
  - `server/src/controllers/payments.controller.ts`
  - `server/src/controllers/plans.controller.ts`

### 2. Environment Variables - K8s Native
- **Before**: Env vars stored in database (`environmentVariable` table)
- **After**: Env vars stored in Kubernetes ConfigMaps/Secrets
  - `k8sDeployManager.getEnvVarsFromK8s(namespace, appLabel)` - reads from K8s
  - `k8sDeployManager.setEnvVarsToK8s(namespace, appLabel, envVars)` - writes to K8s
  - Uses labels: `app-{slug}` for projects, `workspace-{id}` for workspace-level env

### 3. Frontend - Lazy Loading
- **Before**: All components loaded upfront
- **After**: Components lazy-loaded with `React.lazy()` + `Suspense`
  - `DashboardClient.tsx` - dynamically imports StatCards, QuickActions, etc.
  - `kubernetes/page.tsx` - uses separated PodsList, ServicesList, etc.
  - `projects/page.tsx` - uses ProjectCards component
  - `clusters/page.tsx` - uses ClusterCards component
  - `deployments/page.tsx` - uses DeploymentCards component

### 4. Public Pages - Static with ISR
- **Before**: Public pages mixed with dashboard
- **After**: Separate `public-client/` app with ISR
  - Pages pre-rendered at build time (SSG)
  - Periodic revalidation (ISR) when data changes
  - No server calls on every request - served as static HTML
  - Revalidation times:
    - Home, Pricing: 1 hour
    - Services, Products, Contact: 24 hours

### 5. Public vs Protected Routes
- **Public pages** (public-client:3002): Home, Pricing, Services, Products, Contact
- **Auth pages** (client:3000): /auth/login, /auth/register
- **Protected pages** (client:3000): /dashboard/* (requires AuthProvider + SocketProvider)

## How ISR Works

1. **Build time**: Pages are pre-rendered to static HTML
2. **First request**: User gets the static HTML (no server call)
3. **After revalidate period**: Next request triggers background regeneration
4. **New static page**: Once regenerated, subsequent users get the new version

Example from `public-client/app/pricing/page.tsx`:
```typescript
export const revalidate = 3600; // Revalidate every hour

export default async function PricingPage() {
  const plans = await fetchPricingPlans(); // Called at build time + every hour
  return <div>...</div>;
}
```

## Deployment Options

### Option 1: Separate Services (Recommended)
```bash
# Start all services
docker-compose up -d

# Access:
# - Public pages: http://localhost:3002 (static, fast)
# - Dashboard: http://localhost:3000 (protected)
# - API: http://localhost:3001
```

### Option 2: Nginx Reverse Proxy
Use `nginx.conf` to route:
- `/` → public-client:3002 (static pages)
- `/dashboard` → client:3000 (dashboard)
- `/api` → server:3001 (API)

## Benefits of This Architecture

1. **Performance**: Public pages are static HTML - no server rendering on each request
2. **Scalability**: Static pages can be cached at CDN level
3. **Security**: Clear separation of public and protected routes
4. **Maintainability**: Controllers separate business logic from routes
5. **K8s Native**: Env vars managed by Kubernetes, not database
6. **Code Splitting**: Lazy loading reduces initial bundle size
