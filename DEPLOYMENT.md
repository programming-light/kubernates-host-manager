# Deployment Guide

This document covers deploying the Kubernetes Hosting Platform to production using Kubernetes.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Internet                            │
└────────────────┬────────────────────────────────────────┘
                 │
        ┌────────▼────────┐
        │   Ingress       │
        │   (NGINX)       │
        └────────┬────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
┌────────┐  ┌────────┐  ┌────────┐
│Backend │  │Frontend│  │ Worker │
│(x2)    │  │(x2)    │  │(x2)    │
└────────┘  └────────┘  └────────┘
    │            │            │
    └────────────┼────────────┘
                 │
        ┌────────▼────────┐
        │  PostgreSQL     │
        │  (Managed)      │
        └─────────────────┘
```

## Prerequisites

### Required Tools
- Docker & Docker Compose (for local development)
- kubectl 1.28+
- Helm 3.12+
- kustomize 5.0+

### Infrastructure Requirements
- Kubernetes cluster 1.28+ (EKS, GKE, AKS, or self-managed)
- PostgreSQL 14+ database (managed service recommended)
- Redis cluster (optional, for caching)
- Container registry (Docker Hub, ECR, GCR, GHCR)

### Access Credentials
- Kubernetes config (kubeconfig)
- Container registry credentials
- Database credentials
- JWT secret key (minimum 32 characters)

## Local Development with Docker Compose

### Quick Start

```bash
# Clone repository
git clone https://github.com/your-org/k8s-platform.git
cd k8s-platform

# Install dependencies
pnpm install

# Start all services
docker-compose up -d

# Run database migrations
docker-compose exec backend pnpm run prisma:migrate:deploy
docker-compose exec backend pnpm run prisma:seed

# Access the platform
# Frontend: http://localhost:3000
# API: http://localhost:3001
# Database: localhost:5432
```

### Docker Compose Services

```yaml
Services:
- frontend: Next.js application (port 3000)
- backend: NestJS API (port 3001)
- worker: Job processor (port 3002)
- postgres: PostgreSQL database (port 5432)
- redis: Redis cache (port 6379)
- adminer: Database UI (port 8080)
```

### Environment Configuration

Create `.env.local` in project root:

```env
# Database
DATABASE_URL=postgresql://user:password@postgres:5432/k8s_platform

# Backend
JWT_SECRET=your-secure-jwt-secret-min-32-chars
JWT_EXPIRATION=15m
NODE_ENV=development

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001

# Redis (optional)
REDIS_URL=redis://redis:6379
```

### Stop Services

```bash
docker-compose down
docker-compose down -v  # Also remove volumes
```

## Kubernetes Deployment

### 1. Prepare Kubernetes Cluster

```bash
# Create namespace
kubectl create namespace k8s-platform

# Label namespace for ingress
kubectl label namespace ingress-nginx name=ingress-nginx

# Verify cluster access
kubectl cluster-info
kubectl get nodes
```

### 2. Build and Push Images

```bash
# Using Docker
docker build -t your-registry/k8s-platform/backend:latest packages/backend
docker build -t your-registry/k8s-platform/frontend:latest packages/frontend
docker build -t your-registry/k8s-platform/worker:latest packages/worker

# Push to registry
docker push your-registry/k8s-platform/backend:latest
docker push your-registry/k8s-platform/frontend:latest
docker push your-registry/k8s-platform/worker:latest

# Or use GitHub Actions (automatically builds and pushes on push to main)
```

### 3. Configure Secrets

```bash
# Create database secret
kubectl create secret generic database-credentials \
  --from-literal=url='postgresql://user:password@db.example.com:5432/k8s_platform' \
  -n k8s-platform

# Create auth secrets
kubectl create secret generic auth-secrets \
  --from-literal=jwt-secret='your-secure-jwt-secret-min-32-chars' \
  -n k8s-platform

# Verify secrets
kubectl get secrets -n k8s-platform
```

### 4. Deploy to Kubernetes

```bash
# Apply manifests in order
kubectl apply -f infra/k8s/00-namespace.yaml
kubectl apply -f infra/k8s/01-configmap.yaml
kubectl apply -f infra/k8s/02-secrets.yaml
kubectl apply -f infra/k8s/03-backend.yaml
kubectl apply -f infra/k8s/04-frontend.yaml
kubectl apply -f infra/k8s/05-worker.yaml
kubectl apply -f infra/k8s/06-ingress.yaml

# Run database migrations
kubectl apply -f infra/k8s/07-database-migration.yaml
kubectl wait --for=condition=complete job/database-migration -n k8s-platform --timeout=300s

# Verify deployment
kubectl get pods -n k8s-platform
kubectl get svc -n k8s-platform
kubectl get ingress -n k8s-platform
```

### 5. Configure Ingress

Edit `infra/k8s/06-ingress.yaml` with your domain names:

```yaml
spec:
  rules:
  - host: api.yourdomain.com
    http:
      paths:
      - path: /
        backend:
          service:
            name: backend
            port: 3000
  - host: app.yourdomain.com
    http:
      paths:
      - path: /
        backend:
          service:
            name: frontend
            port: 3000
```

### 6. Install NGINX Ingress Controller

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer
```

### 7. Install Cert-Manager (for HTTPS)

```bash
helm repo add jetstack https://charts.jetstack.io
helm repo update

helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set installCRDs=true

# Wait for cert-manager to be ready
kubectl wait --for=condition=ready pod \
  -l app.kubernetes.io/instance=cert-manager \
  -n cert-manager \
  --timeout=300s
```

## Monitoring & Logs

### View Logs

```bash
# Backend logs
kubectl logs -f deployment/backend -n k8s-platform

# Frontend logs
kubectl logs -f deployment/frontend -n k8s-platform

# Worker logs
kubectl logs -f deployment/worker -n k8s-platform

# Previous pod logs (if crashed)
kubectl logs deployment/backend -n k8s-platform --previous
```

### Stream All Logs

```bash
# Install stern (log aggregator)
brew install stern

# Stream all logs
stern . -n k8s-platform
```

### Check Pod Status

```bash
# Describe pod for events
kubectl describe pod <pod-name> -n k8s-platform

# Get pod events
kubectl get events -n k8s-platform --sort-by='.lastTimestamp'
```

## Scaling

### Manual Scaling

```bash
# Scale backend to 5 replicas
kubectl scale deployment/backend --replicas=5 -n k8s-platform

# Scale frontend to 3 replicas
kubectl scale deployment/frontend --replicas=3 -n k8s-platform
```

### Auto-Scaling

Horizontal Pod Autoscaler (HPA) is configured in manifests:
- Minimum replicas: 2
- Maximum replicas: 10
- CPU target: 70% utilization
- Memory target: 80% utilization

```bash
# Check HPA status
kubectl get hpa -n k8s-platform
kubectl describe hpa backend-hpa -n k8s-platform

# Monitor scaling
watch kubectl get hpa -n k8s-platform
```

## Database Management

### Prisma Migrations

```bash
# Generate migration
cd packages/backend
pnpm prisma migrate dev --name add_new_feature

# Apply pending migrations
pnpm prisma migrate deploy

# Reset database (development only)
pnpm prisma migrate reset

# Prisma Studio
pnpm prisma studio
```

### Database Backup

```bash
# PostgreSQL backup
pg_dump postgresql://user:password@host:5432/k8s_platform > backup.sql

# Restore from backup
psql postgresql://user:password@host:5432/k8s_platform < backup.sql

# Automated backups (cloud provider specific)
# AWS RDS: Use automated backups
# Google Cloud SQL: Use Cloud SQL backups
# Azure Database: Use automatic backups
```

## CI/CD Pipeline

### GitHub Actions Workflow

The `.github/workflows/deploy.yml` file automates:

1. **Test**: Lint, type-check, and run tests
2. **Build**: Build Docker images for all services
3. **Deploy**: Deploy to production Kubernetes cluster
4. **Rollback**: Automatic rollback on deployment failure

### Deployment Triggers

- **Main branch push**: Deploy to production
- **Pull request**: Run tests only (no deployment)
- **Staging branch push**: Deploy to staging (configure additional branch)

### Secrets Configuration

Add these GitHub secrets for CI/CD:

```
KUBE_CONFIG          # Base64 encoded kubeconfig
DATABASE_URL         # PostgreSQL connection string
JWT_SECRET           # JWT secret key
REDIS_URL            # Redis connection string (optional)
```

### Manual Deployment

```bash
# Trigger deployment via GitHub CLI
gh workflow run deploy.yml --ref main

# View workflow status
gh workflow view deploy.yml --json status
```

## Troubleshooting

### Common Issues

#### Pods failing to start
```bash
# Check pod logs
kubectl logs <pod-name> -n k8s-platform

# Check pod events
kubectl describe pod <pod-name> -n k8s-platform

# Check resource requests
kubectl top pods -n k8s-platform
```

#### Database connection errors
```bash
# Verify secret
kubectl get secret database-credentials -n k8s-platform -o yaml

# Test database connectivity
kubectl run -it --rm debug --image=postgres:15 --restart=Never -- \
  psql $DATABASE_URL -c "SELECT 1"
```

#### Ingress not working
```bash
# Check ingress status
kubectl describe ingress platform-ingress -n k8s-platform

# Check NGINX controller
kubectl get pods -n ingress-nginx
kubectl logs -f -n ingress-nginx deployment/ingress-nginx-controller
```

#### Image pull errors
```bash
# Verify image exists in registry
docker pull your-registry/k8s-platform/backend:latest

# Check image pull secret
kubectl get secret regcred -n k8s-platform

# Create image pull secret
kubectl create secret docker-registry regcred \
  --docker-server=your-registry \
  --docker-username=username \
  --docker-password=password \
  -n k8s-platform
```

## Performance Tuning

### Resource Limits
Adjust in manifest files based on your cluster:

```yaml
resources:
  requests:
    memory: "256Mi"  # Minimum guaranteed
    cpu: "250m"
  limits:
    memory: "512Mi"  # Maximum allowed
    cpu: "500m"
```

### Database Optimization
- Enable query logging: `log_statement = 'all'`
- Monitor slow queries: `log_min_duration_statement = 1000`
- Analyze query plans: `EXPLAIN ANALYZE <query>`

### Caching Strategy
- Use Redis for session storage
- Implement HTTP caching headers
- Leverage CDN for static assets

## Security

### Network Policies
Configured to:
- Allow ingress from NGINX controller only
- Deny pod-to-pod traffic by default
- Allow necessary inter-pod communication

### Pod Security
- Non-root user execution
- Read-only root filesystem
- No privileged containers

### Secrets Management
- Use Kubernetes Secrets (consider external secret management)
- Rotate JWT secrets regularly
- Use strong database passwords
- Enable RBAC for cluster access

## Maintenance

### Regular Tasks
- Review logs daily
- Monitor resource usage
- Check certificate expiration
- Update dependencies monthly

### Updates
```bash
# Update Kubernetes manifests
kubectl apply -k infra/kustomize

# Rolling restart
kubectl rollout restart deployment/backend -n k8s-platform

# Verify rollout
kubectl rollout status deployment/backend -n k8s-platform
```

## Disaster Recovery

### Backup Strategy
- Database: Daily automated backups (7-day retention)
- Code: Git repository with signed commits
- Configuration: Version control all K8s manifests
- Secrets: Backup encrypted in separate location

### Recovery Procedure
1. Restore database from backup
2. Redeploy application from git commit
3. Verify all services are operational
4. Run integration tests

## Production Checklist

Before deploying to production:

- [ ] Database backed up
- [ ] SSL certificates configured
- [ ] Firewall rules configured
- [ ] Monitoring and alerting set up
- [ ] Load testing completed
- [ ] Security audit performed
- [ ] Disaster recovery plan tested
- [ ] Team trained on operations
- [ ] Documentation updated
- [ ] On-call rotation established
