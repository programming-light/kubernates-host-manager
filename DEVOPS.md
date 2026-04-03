# DevOps & Infrastructure Documentation

Complete guide for operating the Kubernetes Hosting Platform in production.

## Table of Contents

1. [Infrastructure Overview](#infrastructure-overview)
2. [Kubernetes Architecture](#kubernetes-architecture)
3. [Docker Images](#docker-images)
4. [Deployment Automation](#deployment-automation)
5. [Infrastructure as Code](#infrastructure-as-code)
6. [Monitoring & Logging](#monitoring--logging)
7. [Health Checks](#health-checks)
8. [Security](#security)
9. [Disaster Recovery](#disaster-recovery)
10. [Operational Procedures](#operational-procedures)

## Infrastructure Overview

### Architecture Layers

```
┌─────────────────────────────────────────────────────┐
│            Application Layer                         │
│  Backend (NestJS) │ Frontend (Next.js) │ Worker    │
└────────────┬──────────────────────────┬─────────────┘
             │                          │
┌────────────▼──────────────────────────▼─────────────┐
│        Kubernetes Orchestration (K8s 1.28+)         │
│  Services │ Deployments │ StatefulSets │ Jobs      │
└────────────┬──────────────────────────┬─────────────┘
             │                          │
┌────────────▼──────────────────────────▼─────────────┐
│          Infrastructure Services                     │
│  PostgreSQL │ Redis │ Ingress │ DNS │ TLS         │
└─────────────────────────────────────────────────────┘
```

### Cloud Providers

Supported Kubernetes platforms:
- **EKS** (Amazon Elastic Kubernetes Service)
- **GKE** (Google Kubernetes Engine)
- **AKS** (Azure Kubernetes Service)
- **DigitalOcean** Kubernetes
- **Self-managed** Kubernetes clusters

## Kubernetes Architecture

### Namespace Structure

```yaml
k8s-platform:
  - Deployments: backend, frontend, worker
  - Services: backend, frontend, worker
  - ConfigMaps: application configuration
  - Secrets: database credentials, JWT tokens
  - Ingress: external access routing
  - Jobs: database migrations
  - StatefulSets: (future) stateful components

ingress-nginx:
  - Ingress controller
  - Load balancer

cert-manager:
  - SSL certificate management
  - Let's Encrypt integration
```

### Resource Management

#### CPU & Memory Allocation

```yaml
Backend:
  requests: CPU 250m, Memory 256Mi
  limits: CPU 500m, Memory 512Mi

Frontend:
  requests: CPU 250m, Memory 256Mi
  limits: CPU 500m, Memory 512Mi

Worker:
  requests: CPU 250m, Memory 256Mi
  limits: CPU 500m, Memory 512Mi
```

#### Scaling Policies

```yaml
HorizontalPodAutoscaler:
  min replicas: 2
  max replicas: 10
  CPU target: 70%
  Memory target: 80%
```

### Pod Scheduling

- **Pod Anti-Affinity**: Pods spread across different nodes
- **Resource Requests**: Kube-scheduler respects minimum resource needs
- **Node Selectors**: Optional node labels for specific workload placement

## Docker Images

### Building Images

```bash
# Build all images
docker build -t registry/k8s-platform/backend:latest packages/backend
docker build -t registry/k8s-platform/frontend:latest packages/frontend
docker build -t registry/k8s-platform/worker:latest packages/worker

# Push to registry
docker push registry/k8s-platform/backend:latest
docker push registry/k8s-platform/frontend:latest
docker push registry/k8s-platform/worker:latest
```

### Image Specifications

#### Backend Image
- Base: Node 20-alpine
- Size: ~400MB
- Port: 3000
- Health Check: GET /health

#### Frontend Image
- Base: Node 20-alpine
- Size: ~350MB
- Port: 3000
- Static content: /app/.next

#### Worker Image
- Base: Node 20-alpine
- Size: ~350MB
- Port: 3001 (metrics)
- No exposed API port

### Image Registry Options

**GitHub Container Registry (GHCR)**
```bash
docker login ghcr.io
docker tag my-image ghcr.io/myorg/k8s-platform/backend:latest
docker push ghcr.io/myorg/k8s-platform/backend:latest
```

**Amazon ECR**
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com
docker tag my-image 123456789.dkr.ecr.us-east-1.amazonaws.com/k8s-platform/backend:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/k8s-platform/backend:latest
```

**Google Container Registry (GCR)**
```bash
gcloud auth configure-docker
docker tag my-image gcr.io/my-project/k8s-platform/backend:latest
docker push gcr.io/my-project/k8s-platform/backend:latest
```

## Deployment Automation

### GitHub Actions Workflow

Located in `.github/workflows/deploy.yml`

**Triggers:**
- Push to `main` branch → Deploy to production
- Push to `staging` branch → Deploy to staging
- Pull requests → Run tests only

**Stages:**

1. **Test Stage**
   - Lint code
   - Type checking
   - Run unit tests
   - Generate coverage reports

2. **Build Stage**
   - Build Docker images
   - Push to container registry
   - Create build artifacts

3. **Deploy Stage**
   - Update Kubernetes secrets
   - Apply manifests
   - Run database migrations
   - Monitor rollout
   - Verify deployment

4. **Rollback Stage** (on failure)
   - Revert to previous deployment
   - Create issue for failed deployment

### Manual Deployment

```bash
# Using deploy script
cd infra/scripts
./deploy.sh production

# Using kustomize directly
kustomize build infra/kustomize/overlays/production | kubectl apply -f -

# Using kubectl
kubectl apply -f infra/k8s/
```

## Infrastructure as Code

### Kustomize Structure

```
infra/kustomize/
├── base/                      # Base configurations
│   └── kustomization.yaml
└── overlays/
    ├── production/            # Production-specific overrides
    │   └── kustomization.yaml
    └── staging/               # Staging-specific overrides
        └── kustomization.yaml
```

### Kustomize Benefits

- **DRY Principle**: Base configs reused, overlays customize
- **Multi-environment**: Easy management of prod/staging/dev
- **Parameterization**: Environment variables and secrets
- **No templating**: YAML-only approach for clarity

### Deployment with Kustomize

```bash
# Preview changes (dry-run)
kustomize build infra/kustomize/overlays/production | kubectl diff -f -

# Apply changes
kustomize build infra/kustomize/overlays/production | kubectl apply -f -

# Specific resource
kustomize build infra/kustomize/overlays/production | kubectl apply -f - -k deployments
```

## Monitoring & Logging

### Available Tools

#### Logs
- **kubectl logs**: Built-in command
- **stern**: Log aggregator (multi-pod, multi-container)
- **ELK Stack**: Elasticsearch, Logstash, Kibana
- **CloudWatch**: AWS log service
- **Stackdriver**: Google Cloud logging

#### Metrics
- **Prometheus**: Time-series metrics database
- **Grafana**: Metrics visualization
- **Kubernetes Metrics Server**: Native resource metrics
- **Datadog**: Monitoring and APM

#### Tracing
- **Jaeger**: Distributed tracing
- **Zipkin**: Request tracing
- **Datadog APM**: Application performance monitoring

### Quick Commands

```bash
# View logs
kubectl logs -f deployment/backend -n k8s-platform

# Stream multiple pods
stern . -n k8s-platform

# View metrics
kubectl top nodes
kubectl top pods -n k8s-platform

# Get events
kubectl get events -n k8s-platform --sort-by='.lastTimestamp'

# Describe resource
kubectl describe pod <pod-name> -n k8s-platform
```

### Monitoring Script

```bash
cd infra/scripts
chmod +x monitor.sh
./monitor.sh k8s-platform
```

## Health Checks

### Liveness Probes

Restart pod if unresponsive:
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

### Readiness Probes

Remove pod from load balancer if not ready:
```yaml
readinessProbe:
  httpGet:
    path: /ready
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 2
```

### Health Endpoints

Implement in your application:

```typescript
// GET /health
// Returns 200 OK if service is alive
// Used by liveness probe

// GET /ready
// Returns 200 OK if service is ready for traffic
// Used by readiness probe
```

## Security

### Network Policies

Configured to:
- Allow ingress from NGINX controller only
- Deny pod-to-pod traffic by default
- Allow necessary database connections

```yaml
NetworkPolicy:
  - Ingress only from ingress-nginx namespace
  - Egress to database and external APIs
  - No pod-to-pod communication by default
```

### Pod Security Policies

```yaml
SecurityContext:
  runAsNonRoot: true
  runAsUser: 1000
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true (where possible)
  capabilities:
    drop: ["ALL"]
```

### Secrets Management

**Best Practices:**
1. Use Kubernetes Secrets (consider external vaults)
2. Rotate secrets regularly
3. Never commit secrets to git
4. Use RBAC for secret access
5. Enable encryption at rest

**Secret Rotation:**
```bash
# Update secret
kubectl create secret generic database-credentials \
  --from-literal=url='new-connection-string' \
  -n k8s-platform \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart pods to use new secret
kubectl rollout restart deployment/backend -n k8s-platform
```

### RBAC Configuration

```yaml
ServiceAccount:
  - One per deployment
  - Minimal permissions needed

Role:
  - Access only required resources
  - Specific API groups and verbs

RoleBinding:
  - Bind role to service account
  - Namespace-scoped
```

## Disaster Recovery

### Backup Strategy

**Database:**
- Daily automated backups (7-day retention)
- Point-in-time recovery enabled
- Backups stored in separate region

**Configuration:**
- Version control all K8s manifests
- Git history preserved
- Signed commits for compliance

**Secrets:**
- Encrypted backup of secrets
- Stored separately from code
- Recovery procedure documented

### Recovery Procedures

**Database Recovery:**
```bash
# Restore from backup
pg_restore -d k8s_platform backup.sql

# Verify data
psql -d k8s_platform -c "SELECT COUNT(*) FROM users;"
```

**Application Recovery:**
```bash
# Reapply manifests from git
git checkout <commit>
kubectl apply -f infra/k8s/

# Verify rollout
kubectl rollout status deployment/backend -n k8s-platform
```

**Complete Cluster Recovery:**
1. Restore database from backup
2. Restore configuration from git
3. Rebuild container images
4. Deploy to new cluster
5. Run integration tests

### Recovery Time Objectives (RTO)

- Database: 1 hour
- Application: 30 minutes
- Cluster: 4 hours

### Recovery Point Objectives (RPO)

- Database: 1 hour (daily backups)
- Configuration: Real-time (git commits)
- Secrets: 1 hour (encrypted backups)

## Operational Procedures

### Daily Tasks

- [ ] Monitor logs for errors
- [ ] Check resource usage (CPU, memory)
- [ ] Review Kubernetes events
- [ ] Monitor application metrics

### Weekly Tasks

- [ ] Review deployment history
- [ ] Test backup restoration
- [ ] Update dependency vulnerabilities
- [ ] Analyze performance metrics

### Monthly Tasks

- [ ] Security audit
- [ ] Capacity planning
- [ ] Cost analysis
- [ ] Documentation review

### Incident Response

**Process:**
1. Detect issue (automated alert or report)
2. Acknowledge incident
3. Investigate root cause
4. Implement fix
5. Verify solution
6. Document incident
7. Post-mortem analysis

**Escalation:**
- Level 1: Automated alerts
- Level 2: On-call team
- Level 3: Engineering lead
- Level 4: CTO/VP Eng

### Change Management

**Process:**
1. Propose change (feature/bugfix)
2. Code review
3. Merge to develop
4. Deploy to staging
5. Test in staging
6. Schedule production deployment
7. Deploy during maintenance window
8. Verify in production
9. Monitor for issues

### Rollback Procedures

```bash
# Automatic rollback (if deployment fails)
kubectl rollout undo deployment/backend -n k8s-platform

# Manual rollback to specific revision
kubectl rollout history deployment/backend -n k8s-platform
kubectl rollout undo deployment/backend --to-revision=5 -n k8s-platform

# Verify rollback
kubectl rollout status deployment/backend -n k8s-platform
```

### Capacity Planning

Monitor and adjust:
- **CPU requests/limits**: Based on actual usage
- **Memory requests/limits**: Based on actual usage
- **Pod replicas**: Based on load patterns
- **Database size**: Monitor growth
- **Storage**: Monitor disk usage

### Cost Optimization

- Use spot instances for non-critical workloads
- Implement resource quotas per namespace
- Monitor unused resources
- Consolidate services where possible
- Use node affinity for cost-effective scheduling

## Troubleshooting Guide

### Pod Won't Start

```bash
# Check pod status
kubectl describe pod <pod-name> -n k8s-platform

# Common issues:
# - ImagePullBackOff: Image not found or registry auth issue
# - CrashLoopBackOff: Application crashing on startup
# - Pending: Insufficient resources or node selector mismatch
```

### High CPU/Memory Usage

```bash
# Check resource usage
kubectl top pods -n k8s-platform

# Check for memory leaks
kubectl logs -f deployment/backend -n k8s-platform | grep -i "memory"

# Scale deployment if needed
kubectl scale deployment/backend --replicas=5 -n k8s-platform
```

### Database Connection Issues

```bash
# Test connectivity
kubectl run -it --rm debug --image=postgres:15 --restart=Never -- \
  psql $DATABASE_URL -c "SELECT 1;"

# Check secret
kubectl get secret database-credentials -n k8s-platform -o yaml

# Verify environment variables
kubectl exec <pod-name> -n k8s-platform -- env | grep DATABASE
```

### Ingress Not Working

```bash
# Check ingress
kubectl describe ingress platform-ingress -n k8s-platform

# Check NGINX controller
kubectl get pods -n ingress-nginx
kubectl logs -f -n ingress-nginx deployment/ingress-nginx-controller

# Test endpoint
curl -H "Host: api.example.com" http://<ingress-ip>/
```

---

For more detailed information, see:
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment procedures
- [AUTHENTICATION.md](./AUTHENTICATION.md) - Auth system documentation
- [README.md](./README.md) - Project overview
