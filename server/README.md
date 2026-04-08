# K8s Platform API

RESTful API for Kubernetes Hosting Platform with Swagger documentation.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm run build
npm start
```

## API Documentation

Once the server is running, access the Swagger documentation at:
- **URL**: http://localhost:3001/api-docs

## Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <your-access-token>
```

### Auth Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/me` | Update current user |

### Workspace Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workspaces` | List workspaces |
| POST | `/api/workspaces` | Create workspace |
| GET | `/api/workspaces/:id` | Get workspace |
| PUT | `/api/workspaces/:id` | Update workspace |
| DELETE | `/api/workspaces/:id` | Delete workspace |

### Cluster Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/clusters` | List clusters |
| POST | `/api/clusters` | Add cluster |
| GET | `/api/clusters/:id` | Get cluster |
| PUT | `/api/clusters/:id` | Update cluster |
| DELETE | `/api/clusters/:id` | Delete cluster |

### Project Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List projects |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/:id` | Get project |
| PUT | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |

### Deployment Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/deployments` | List deployments |
| POST | `/api/deployments` | Create deployment |
| GET | `/api/deployments/:id` | Get deployment |
| POST | `/api/deployments/:id/restart` | Restart deployment |
| POST | `/api/deployments/:id/rollback` | Rollback deployment |
| GET | `/api/deployments/:id/logs` | Get deployment logs |

### Kubernetes Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/kubernetes/status` | Get cluster status |
| GET | `/api/kubernetes/namespaces` | List namespaces |
| GET | `/api/kubernetes/pods` | List pods |
| GET | `/api/kubernetes/services` | List services |
| GET | `/api/kubernetes/nodes` | List nodes |
| GET | `/api/kubernetes/deployments` | List K8s deployments |
| GET | `/api/kubernetes/ingresses` | List ingresses |
| POST | `/api/kubernetes/create-namespace` | Create namespace |
| POST | `/api/kubernetes/create-deployment` | Create deployment |
| POST | `/api/kubernetes/create-service` | Create service |
| DELETE | `/api/kubernetes/delete-resource` | Delete resource |

## Environment Variables

### Server Configuration
```env
PORT=3001
NODE_ENV=development
CLIENT_URL=http://localhost:3000
```

### Authentication
```env
JWT_SECRET=your-jwt-secret-key
REFRESH_SECRET=your-refresh-secret-key
```

### Kubernetes Provider
```env
K8S_PROVIDER=minikube  # minikube, kind, k3s, k3d, docker-desktop, eks, gke, aks, custom
```

### Provider-Specific Variables

**Minikube:**
```env
MINIKUBE_IP=192.168.49.2
MINIKUBE_PORT=8443
MINIKUBE_TOKEN=
```

**K3S:**
```env
K3S_URL=https://localhost:6443
K3S_TOKEN=
```

**Kubeadm (Bare Metal):**
```env
KUBEADM_API_SERVER=https://your-server:6443
KUBEADM_TOKEN=<bootstrap-token>
KUBEADM_CA_CERT=<base64-ca-cert>
```

**Custom Cluster:**
```env
CUSTOM_K8S_API_SERVER=https://your-cluster:6443
CUSTOM_K8S_TOKEN=<token>
CUSTOM_K8S_CA_CERT=<base64-ca>
```

### Kubernetes Settings
```env
DEFAULT_NAMESPACE=default
K8S_REQUEST_TIMEOUT=30000
K8S_CONNECT_TIMEOUT=10000
K8S_SKIP_TLS_VERIFY=false
```

## Example Requests

### Register
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123","name":"John Doe"}'
```

### Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

### Create Project
```bash
curl -X POST http://localhost:3001/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"my-app","clusterId":"cluster-id","namespace":"production"}'
```

### Create Kubernetes Deployment
```bash
curl -X POST http://localhost:3001/api/kubernetes/create-deployment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"nginx","image":"nginx:latest","namespace":"default","replicas":2}'
```

## Response Format

### Success Response
```json
{
  "id": "...",
  "name": "...",
  ...
}
```

### Error Response
```json
{
  "error": "Error Type",
  "message": "Detailed error message"
}
```

## Database

The server uses in-memory storage for development. To use PostgreSQL:

1. Install PostgreSQL
2. Update DATABASE_URL in .env
3. Run migrations: `npm run db:push`
