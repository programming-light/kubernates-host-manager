# K8s Hosting Platform

A modern multi-tenant Kubernetes hosting platform.

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Express.js, TypeScript, with Swagger documentation
- **Database**: PostgreSQL with Prisma ORM (optional)

## Quick Start

### 1. Install Dependencies

```bash
npm install
cd client && npm install
cd ../server && npm install
```

### 2. Configure Environment

```bash
# Copy environment files
cp .env.example server/.env

# Edit server/.env with your Kubernetes provider settings
```

### 3. Start Services

```bash
# Start backend (with Swagger docs)
cd server
npm run dev

# In another terminal, start frontend
cd client
npm run dev
```

### 4. Access Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Documentation**: http://localhost:3001/api-docs

## Project Structure

```
k8s-platform/
├── client/                    # Next.js Frontend
│   ├── app/                  # Pages
│   ├── components/           # UI Components
│   └── lib/                  # API Client & Utils
├── server/                   # Express.js Backend
│   ├── src/
│   │   ├── config/          # Swagger configuration
│   │   ├── middleware/      # Auth, error, validation
│   │   ├── routes/          # API routes
│   │   └── lib/             # K8s config manager
│   └── README.md            # API Documentation
├── docker-compose.yml
└── .env.example
```

## API Endpoints

| Category | Endpoint | Description |
|----------|----------|-------------|
| Auth | `/api/auth/*` | Register, login, refresh token |
| Users | `/api/auth/me` | User profile |
| Workspaces | `/api/workspaces/*` | Workspace management |
| Clusters | `/api/clusters/*` | Kubernetes clusters |
| Projects | `/api/projects/*` | Project management |
| Deployments | `/api/deployments/*` | Deployment management |
| Kubernetes | `/api/kubernetes/*` | K8s cluster operations |

## Kubernetes Providers

The backend supports multiple Kubernetes distributions:

| Provider | Provider Value |
|----------|----------------|
| Minikube | `minikube` |
| Kind | `kind` |
| K3S | `k3s` |
| K3D | `k3d` |
| Docker Desktop | `docker-desktop` |
| MicroK8S | `microk8s` |
| Kubeadm (Bare Metal) | `kubeadm` |
| Rancher | `rancher` |
| AWS EKS | `eks` |
| Google GKE | `gke` |
| Azure AKS | `aks` |
| Custom | `custom` |

Set `K8S_PROVIDER` in `.env` to configure your cluster.

## Environment Variables

See `.env.example` for all configuration options.

### Key Variables:

```env
# Server
PORT=3001
CLIENT_URL=http://localhost:3000

# Authentication
JWT_SECRET=your-secret
REFRESH_SECRET=your-refresh-secret

# Kubernetes
K8S_PROVIDER=minikube
DEFAULT_NAMESPACE=default
```
