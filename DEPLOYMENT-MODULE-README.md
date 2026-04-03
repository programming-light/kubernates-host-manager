# Docker Container Deployment Module

Production-ready deployment module for a Kubernetes-based hosting platform supporting ANY Docker image.

## Overview

This module allows tenants to deploy and manage containerized applications on Kubernetes without framework restrictions. Users can deploy any valid Docker image from public/private registries or build from Git repositories.

## Architecture

### Core Components

1. **Deployment Orchestration Service** - Manages project creation, configuration, and deployment lifecycle
2. **Worker Processor** - BullMQ-based async job processing for deployment operations
3. **Kubernetes Client** - Abstracts K8s API interactions (Deployment, Service, ConfigMap, Ingress, etc.)
4. **Plan Limit Service** - Enforces plan-based resource quotas (decoupled from deployment logic)

### Database Models

- **Project** - Container application definition with resource configs
- **Deployment** - Specific deployment revision with status tracking
- **DeploymentRevision** - Configuration snapshots for rollback
- **DeploymentEvent** - Audit trail of deployment operations
- **DeploymentJob** - Individual task tracking (build, deploy, health check)
- **ProjectEnvironmentVariable** - Container environment variables
- **ProjectAddon** - Associated services (databases, caches)
- **RuntimeTemplate** - Pre-configured deployment templates
- **DomainMapping** - Custom domain routing

## Key Features

### Framework-Agnostic Deployment

Deploy ANY Docker image without framework knowledge:

```bash
# Node.js/Express
docker pull node:18-alpine
docker push myregistry/myapp:latest

# Python/FastAPI
docker pull python:3.11-slim
docker push myregistry/myapp:latest

# Go
docker pull golang:1.21-alpine
docker push myregistry/myapp:latest

# Java
docker pull openjdk:17-slim
docker push myregistry/myapp:latest
```

### Deployment Sources

1. **Docker Registry** - Pre-built images from Docker Hub, GHCR, private registries
2. **Git Repository** - Automatic builds from Dockerfile
3. **Template Marketplace** - Pre-configured runtime stacks
4. **Uploaded Archives** - TAR/ZIP upload support

### Resource Management

```typescript
// CPU in cores, memory in MB
const project = await createProject({
  cpuRequest: 0.1,      // Minimum CPU
  cpuLimit: 0.5,        // Maximum CPU
  memoryRequest: 128,   // Minimum RAM
  memoryLimit: 512,     // Maximum RAM
  storageGb: 10,        // Persistent storage
});
```

### Scaling & Autoscaling

```typescript
// Manual scaling
await scaleDeployment(projectId, 5); // 5 replicas

// Autoscaling configuration
const project = await updateProject({
  autoscale: true,
  minReplicas: 1,
  maxReplicas: 10,
  cpuThreshold: 70,  // Scale when CPU > 70%
});
```

### Environment Variables

```typescript
// Set encrypted environment variables
await setEnvironmentVariables(projectId, [
  { key: 'DATABASE_URL', value: 'postgres://...', isSecret: true },
  { key: 'API_KEY', value: 'sk_...', isSecret: true },
  { key: 'DEBUG', value: 'true', isSecret: false },
]);
```

### Deployment Operations

```typescript
// Deploy from Docker image
await deployFromDockerImage(projectId, {
  imageUrl: 'docker.io/nginx:latest',
});

// Deploy from Git (builds automatically)
await deployFromGit(projectId, {
  gitUrl: 'https://github.com/user/repo',
  gitBranch: 'main',
  buildCommand: 'docker build -t {image} .',
});

// Restart running deployment
await restartDeployment(projectId);

// Stop deployment
await stopDeployment(projectId);

// Delete project
await deleteProject(projectId);
```

### Deployment Lifecycle States

```
PENDING
  ↓
QUEUED
  ↓
BUILDING (if building from git)
  ├→ PACKAGING
  ├→ DEPLOYING
  └→ PROVISIONING
  ↓
RUNNING ← successful
  ├→ UNHEALTHY ← health check failed
  ├→ FAILED ← deployment error
  ├→ STOPPED ← user stopped
  └→ ROLLBACK_PENDING → ROLLED_BACK
```

### Audit & History

```typescript
// Get deployment history
const deployments = await getDeploymentHistory(projectId, limit: 10);

// Each deployment includes:
// - revision number
// - image URL and build info
// - deployed by user
// - status timeline
// - events and logs
// - rollback capability
```

## API Endpoints

### Projects

```
POST   /workspaces/{id}/projects                  Create project
GET    /workspaces/{id}/projects                  List projects
GET    /workspaces/{id}/projects/{id}             Get project
PUT    /workspaces/{id}/projects/{id}             Update project
DELETE /workspaces/{id}/projects/{id}             Delete project
```

### Deployments

```
POST   /workspaces/{id}/projects/{id}/deployments/docker    Deploy from image
POST   /workspaces/{id}/projects/{id}/deployments/git       Deploy from git
GET    /workspaces/{id}/projects/{id}/deployments           History
GET    /workspaces/{id}/projects/{id}/deployments/{id}      Get deployment

POST   /workspaces/{id}/projects/{id}/restart               Restart
POST   /workspaces/{id}/projects/{id}/scale                 Scale
POST   /workspaces/{id}/projects/{id}/stop                  Stop
```

### Configuration

```
POST   /workspaces/{id}/projects/{id}/env                   Set variables
GET    /workspaces/{id}/projects/{id}/env                   Get variables
PUT    /workspaces/{id}/projects/{id}/resources             Update limits
GET    /workspaces/{id}/projects/{id}/resources/usage       Get usage

POST   /workspaces/{id}/projects/{id}/domains               Add domain
GET    /workspaces/{id}/projects/{id}/domains               List domains
DELETE /workspaces/{id}/projects/{id}/domains/{id}          Remove domain
```

## Frontend Components

### CreateProjectForm

```tsx
<CreateProjectForm 
  workspaceId={workspaceId}
  clusterId={clusterId}
/>
```

Features:
- Choose deployment source (Docker image or Git repo)
- Configure container settings
- Set resource limits
- Support for private registries

### ProjectDashboard

```tsx
<ProjectDashboard 
  workspaceId={workspaceId}
  projectId={projectId}
/>
```

Features:
- Real-time deployment status
- Resource usage monitoring
- Scaling controls
- Deployment history
- Restart/rollback actions

## Worker Processors

### Deployment Pipeline

1. **deploy-docker-image** - Deploy pre-built container
   - Validate image
   - Create K8s Deployment
   - Create Service
   - Create ConfigMap for env vars
   - Wait for pod readiness
   - Verify health checks

2. **deploy-from-git** - Build and deploy
   - Clone repository
   - Build Docker image
   - Push to registry
   - Create K8s resources
   - Monitor deployment

3. **restart-deployment** - Restart running pods
   - Trigger rollout restart
   - Wait for new pods

4. **scale-deployment** - Change replica count
   - Update Deployment replicas
   - Monitor scaling

5. **stop-deployment** - Graceful shutdown
   - Delete K8s Deployment
   - Retain ConfigMaps for restart

6. **delete-project** - Complete cleanup
   - Delete K8s Namespace
   - Cascade delete all resources

7. **redeploy-with-env** - Restart after config changes
   - Pick up new environment variables
   - Maintain current image

## Runtime Templates

Pre-configured templates for quick setup:

**Frontends:** Next.js, React, Vue, Angular, Svelte
**Backends:** Node.js/Express, Python/Flask/Django/FastAPI, Go, Rust, Java/Spring, .NET, PHP/Laravel, Ruby/Rails
**Databases:** PostgreSQL, MySQL, MongoDB
**Caches:** Redis, Memcached
**Queues:** RabbitMQ, Kafka
**Utilities:** Nginx, Traefik

Each template includes:
- Base Docker image
- Default port
- Start command
- Build command
- Resource recommendations

## Kubernetes Best Practices

### Resource Requests & Limits

```yaml
resources:
  requests:
    cpu: 100m        # Minimum CPU
    memory: 128Mi     # Minimum memory
  limits:
    cpu: 500m        # Maximum CPU
    memory: 512Mi     # Maximum memory
```

### Health Checks

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 5

readinessProbe:
  httpGet:
    path: /ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
```

### Networking

- Service for pod-to-pod communication
- Ingress for external access
- ConfigMaps for environment variables
- Secrets for sensitive data (encrypted)

### Isolation

- Namespace per workspace/project
- RBAC for cluster access
- Network policies for security

## Plan Enforcement

The PlanLimitService enforces plan-based limits:

```typescript
const limits = await planLimitService.getWorkspacePlanLimits(workspaceId);

// Check limits
if (projectCount >= limits.maxApps) {
  throw new Error('Max projects exceeded');
}

if (!limits.autoscalingEnabled && projectData.autoscale) {
  throw new Error('Autoscaling not available in your plan');
}
```

## Error Handling

All deployment operations are retryable:

```typescript
await deploymentQueue.add('deploy', data, {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
});
```

Failed deployments trigger alerts and store error details for debugging.

## Monitoring & Logging

- Deployment events logged to database
- Build logs captured and accessible
- Deployment logs streamed from K8s
- Metrics available from K8s (CPU, memory, network)

## Security

- Credentials encrypted at rest
- Image pull secrets for private registries
- RBAC isolation per workspace
- Input validation on all endpoints
- No exposure of secret values in responses

## Extensibility

Design supports future features:

- Multi-cluster deployments
- Blue-green deployments
- Canary releases
- Custom ingress rules
- Persistent volume management
- Service mesh integration
- CI/CD pipeline integration

## Running Locally

```bash
# Create project
curl -X POST http://localhost:3000/api/workspaces/ws1/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My App",
    "slug": "my-app",
    "clusterId": "cluster1",
    "imageUrl": "docker.io/nginx:latest"
  }'

# Deploy Docker image
curl -X POST http://localhost:3000/api/workspaces/ws1/projects/proj1/deployments/docker \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "docker.io/nginx:latest"
  }'

# Check deployment history
curl http://localhost:3000/api/workspaces/ws1/projects/proj1/deployments

# Scale
curl -X POST http://localhost:3000/api/workspaces/ws1/projects/proj1/scale \
  -H "Content-Type: application/json" \
  -d '{"replicas": 3}'
```

## Supported Docker Images

Any valid Docker image works, including:

```
# Public registries
docker.io/nginx:latest
ghcr.io/user/repo:v1.0
quay.io/org/image:latest

# Private registries
registry.company.com/internal/app:v1.0
gcr.io/project/image:v1.0
acr.azurecr.io/image:latest

# Custom bases
myregistry.azurecr.io/python:3.11-custom
registry.internal/go:1.21-optimized
```

The platform treats all images identically—it doesn't need to understand the application framework.
