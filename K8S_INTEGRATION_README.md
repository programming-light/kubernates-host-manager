# Kubernetes Cluster Integration Module

A production-ready, secure Kubernetes cluster integration for multi-tenant hosting platforms. Supports local development (Minikube, Docker Desktop, kind, k3d) and production environments (EKS, GKE, AKS, managed, bare metal, VPS).

## ✨ What This Module Does

- **Connect Kubernetes Clusters**: Register local or remote clusters via token or kubeconfig
- **Secure Credentials**: Encrypt and store cluster credentials with AES-256-GCM
- **Multi-Tenant Isolation**: Workspace-scoped access control and audit logging
- **Discover Resources**: Automatically fetch namespaces, nodes, ingress classes, storage classes
- **Health Monitoring**: Test connectivity and perform full health checks on demand
- **Audit Trail**: Complete tracking of all cluster operations for compliance
- **REST API**: 12 RESTful endpoints for cluster management

Perfect for:
- SaaS platforms deploying to Kubernetes
- Internal tools managing multiple clusters
- CI/CD systems integrating with Kubernetes
- Multi-tenant application hosting

## 🚀 Quick Start

### 1. Prerequisites
```bash
# PostgreSQL running
# Node.js 16+ installed
# kubectl configured (for local testing)
```

### 2. Generate Encryption Key
```bash
ENCRYPTION_KEY=$(openssl rand -hex 32)
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY" >> packages/backend/.env
```

### 3. Run Database Migration
```bash
cd packages/backend
npx prisma migrate dev --name add_kubernetes_cluster_integration
```

### 4. Install Dependencies
```bash
npm install @kubernetes/client-node
```

### 5. Apply RBAC to Your Cluster
```bash
kubectl apply -f infra/rbac/platform-deployer-rbac.yaml
```

### 6. Start Backend
```bash
npm run dev
```

Done! The cluster integration is ready to use.

## 📚 Documentation

| Document | Purpose | Time |
|----------|---------|------|
| [QUICK-REFERENCE.md](docs/QUICK-REFERENCE.md) | Fast lookup and commands | 5 min |
| [cluster-integration-tutorial.md](docs/cluster-integration-tutorial.md) | Hands-on walkthrough | 15 min |
| [kubernetes-cluster-integration.md](docs/kubernetes-cluster-integration.md) | Complete guide | 60 min |
| [MIGRATION-GUIDE.md](docs/MIGRATION-GUIDE.md) | Database deployment | 30 min |
| [CLUSTER-INTEGRATION-SUMMARY.md](docs/CLUSTER-INTEGRATION-SUMMARY.md) | Architecture overview | 10 min |

**Start here**: [Quick Reference](docs/QUICK-REFERENCE.md)

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│  REST API (12 Endpoints)                │
│  /workspaces/{id}/clusters/...          │
└──────────────┬──────────────────────────┘
               │
       ┌───────▼────────────────┐
       │  ClustersController    │
       │  ClustersService       │
       └───────┬────────────────┘
               │
       ┌───────┴──────────┬──────────────┬─────────────────┐
       │                  │              │                 │
┌──────▼──────┐  ┌────────▼────────┐  ┌─▼─────────┐  ┌───▼──────────┐
│Encryption   │  │K8s Client       │  │Prisma     │  │JWT Auth      │
│Service      │  │Service          │  │Service    │  │              │
│AES-256-GCM  │  │@kubernetes/     │  │PostgreSQL │  │              │
└─────────────┘  │client-node      │  └───────────┘  └──────────────┘
                 └─────────────────┘
```

## 📡 API Endpoints

All endpoints require JWT authentication and workspace context.

```bash
# Create cluster (token mode)
POST   /workspaces/{id}/clusters/token

# Create cluster (kubeconfig mode)
POST   /workspaces/{id}/clusters/kubeconfig

# List clusters in workspace
GET    /workspaces/{id}/clusters

# Get cluster details
GET    /workspaces/{id}/clusters/{clusterId}

# Update cluster (credentials/metadata)
PUT    /workspaces/{id}/clusters/{clusterId}

# Test cluster connectivity
POST   /workspaces/{id}/clusters/{clusterId}/test

# Health check cluster
POST   /workspaces/{id}/clusters/{clusterId}/health

# Get cluster namespaces
GET    /workspaces/{id}/clusters/{clusterId}/namespaces

# Get cluster nodes
GET    /workspaces/{id}/clusters/{clusterId}/nodes

# Get ingress classes
GET    /workspaces/{id}/clusters/{clusterId}/ingress-classes

# Get storage classes
GET    /workspaces/{id}/clusters/{clusterId}/storage-classes

# Delete cluster
DELETE /workspaces/{id}/clusters/{clusterId}
```

See [API Reference](docs/kubernetes-cluster-integration.md#api-reference) for examples.

## 🔐 Security Features

1. **Encryption**: AES-256-GCM encryption for all stored credentials
2. **Audit Logging**: Every operation tracked with user, time, action, result
3. **Workspace Isolation**: Multi-tenant access control enforced
4. **RBAC**: Limited service account (not cluster-admin)
5. **Response Sanitization**: No credentials exposed in API responses
6. **Validation**: Input validation on all endpoints
7. **JWT Auth**: Token-based authentication required
8. **Credential Rotation**: Built-in support for updating credentials

**Audit Trail Includes**:
- Create, update, delete operations
- Connectivity tests and health checks
- User ID and timestamp
- Success/error status with details

## 📦 Database Models

### Cluster
Stores cluster configuration and cached information:
- Connection mode (TOKEN or KUBECONFIG)
- Credentials (encrypted)
- Kubernetes version and node count
- Health check status
- Environment classification

### ClusterCredential
Backup and rotation management:
- Multiple credentials per cluster
- Named credentials (primary, backup)
- Rotation support

### ClusterAuditLog
Compliance and debugging:
- All operations logged
- User tracking
- Error details
- Compliance audit trail

## 🛠️ Supported Cluster Types

**Local Development**:
- ✅ Minikube
- ✅ Docker Desktop Kubernetes
- ✅ kind
- ✅ k3d

**Managed Kubernetes**:
- ✅ AWS EKS
- ✅ Google GKE
- ✅ Azure AKS
- ✅ DigitalOcean
- ✅ Civo
- ✅ Linode
- ✅ Vultr

**Self-Hosted**:
- ✅ Bare metal
- ✅ VPS-hosted
- ✅ Private datacenters
- ✅ Custom setups

## 🔄 Connection Modes

### Token Mode (Production)
Use API server endpoint + CA certificate + bearer token

**Best for**: Production, multi-user, fine-grained RBAC
**Security**: Limited service account with specific permissions
**Example**:
```bash
curl -X POST /clusters/token \
  -d '{
    "apiEndpoint": "https://api.example.com:6443",
    "caCertificateBase64": "...",
    "token": "..."
  }'
```

### Kubeconfig Mode (Development)
Use entire kubeconfig file (base64 encoded)

**Best for**: Local development, testing, single-user
**Security**: Depends on kubeconfig setup
**Example**:
```bash
curl -X POST /clusters/kubeconfig \
  -d '{
    "kubeconfigBase64": "..."
  }'
```

## 📊 Implementation Stats

| Component | Count | Lines |
|-----------|-------|-------|
| Services | 3 | 1,084 |
| Controller | 1 | 180 |
| DTOs | 7 | 192 |
| Database Models | 3 | 89 |
| Documentation | 5 | 2,200+ |
| RBAC YAML | 1 | 167 |
| **Total** | - | **3,900+** |

## ✅ Deployment Checklist

- [ ] Generate ENCRYPTION_KEY: `openssl rand -hex 32`
- [ ] Set ENCRYPTION_KEY in environment
- [ ] Run database migration: `prisma migrate deploy`
- [ ] Install @kubernetes/client-node: `npm install`
- [ ] Apply RBAC YAML: `kubectl apply -f infra/rbac/platform-deployer-rbac.yaml`
- [ ] Test with `/clusters/test` endpoint
- [ ] Review audit logs in database
- [ ] Set up health check monitoring (optional)
- [ ] Configure alerting (optional)
- [ ] Document custom RBAC policies (optional)

## 🎯 Common Tasks

### Create a Cluster
```bash
# Get your credentials first (see QUICK-REFERENCE or tutorial)
KUBECONFIG_B64=$(cat ~/.kube/config | base64 | tr -d '\n')

# Create cluster
curl -X POST http://localhost:3001/api/workspaces/$WS_ID/clusters/kubeconfig \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d "{
    \"name\": \"my-cluster\",
    \"provider\": \"MINIKUBE\",
    \"region\": \"local\",
    \"kubeconfigBase64\": \"$KUBECONFIG_B64\"
  }"
```

### Test Cluster Connectivity
```bash
curl -X POST http://localhost:3001/api/workspaces/$WS_ID/clusters/$CLUSTER_ID/test \
  -H "Authorization: Bearer $JWT_TOKEN"

# Response: { "healthy": true, "message": "Cluster is reachable..." }
```

### List Cluster Nodes
```bash
curl http://localhost:3001/api/workspaces/$WS_ID/clusters/$CLUSTER_ID/nodes \
  -H "Authorization: Bearer $JWT_TOKEN" | jq

# Response: { "nodes": [ { "name": "...", "status": "Ready", ... } ] }
```

See [QUICK-REFERENCE.md](docs/QUICK-REFERENCE.md) for more commands.

## 🔍 Troubleshooting

### "Failed to connect to cluster"
1. Verify credentials: `kubectl get nodes --token=$TOKEN --server=$API`
2. Check API endpoint: `curl -v https://$API`
3. Check permissions: `kubectl auth can-i list nodes --as=system:serviceaccount:platform-system:platform-deployer`

### "Certificate signed by unknown authority"
1. Verify CA cert is valid base64: `echo $CA | base64 -d | openssl x509 -text -noout`
2. Remove newlines: `echo $CA | tr -d '\n'`

### Cluster stuck in ERROR status
1. Call health check: `POST /clusters/{id}/health`
2. Fix underlying issue
3. Status updates when healthy

See [kubernetes-cluster-integration.md](docs/kubernetes-cluster-integration.md#common-errors-and-fixes) for detailed troubleshooting.

## 📖 Learning Resources

**New to the module?**
1. Read [QUICK-REFERENCE.md](docs/QUICK-REFERENCE.md) (5 min)
2. Follow [cluster-integration-tutorial.md](docs/cluster-integration-tutorial.md) (15 min)
3. Test with curl examples provided

**Setting up production?**
1. Review [MIGRATION-GUIDE.md](docs/MIGRATION-GUIDE.md)
2. Read [RBAC setup](infra/rbac/platform-deployer-rbac.yaml)
3. Check [security best practices](docs/kubernetes-cluster-integration.md#security-best-practices)

**Need complete reference?**
- [kubernetes-cluster-integration.md](docs/kubernetes-cluster-integration.md) - 800+ lines, covers everything
- [CLUSTER-INTEGRATION-SUMMARY.md](docs/CLUSTER-INTEGRATION-SUMMARY.md) - Architecture and overview

## 🚀 Future Enhancements

The architecture supports:
- **Deployments**: Deploy apps to clusters via API
- **Databases**: Manage databases within clusters
- **CI/CD**: GitHub Actions, GitLab CI integration
- **Monitoring**: Pod metrics, log aggregation
- **Multi-cluster**: Failover, federation, distribution

See [kubernetes-cluster-integration.md](docs/kubernetes-cluster-integration.md#future-extension-points) for details.

## 💻 Technology Stack

- **Language**: TypeScript
- **Framework**: NestJS
- **Database**: PostgreSQL + Prisma ORM
- **Kubernetes**: @kubernetes/client-node
- **Encryption**: Node.js crypto (AES-256-GCM)
- **Authentication**: JWT
- **API**: REST

## 📁 File Structure

```
project-root/
├── packages/backend/src/modules/clusters/
│   ├── clusters.controller.ts              # REST API endpoints
│   ├── clusters.service.ts                 # Business logic
│   ├── clusters.module.ts                  # Module setup
│   ├── cluster-encryption.service.ts       # AES-256-GCM encryption
│   ├── kubernetes-client.service.ts        # K8s API client
│   └── dto/cluster.dto.ts                  # Request/response DTOs
├── packages/backend/prisma/
│   └── schema.prisma                       # Database models
├── infra/rbac/
│   └── platform-deployer-rbac.yaml         # Kubernetes RBAC setup
└── docs/
    ├── kubernetes-cluster-integration.md   # Complete guide (798 lines)
    ├── cluster-integration-tutorial.md     # Tutorial (385 lines)
    ├── MIGRATION-GUIDE.md                  # Migration (436 lines)
    ├── CLUSTER-INTEGRATION-SUMMARY.md      # Summary (350 lines)
    └── QUICK-REFERENCE.md                  # Quick lookup (402 lines)
```

## 🤝 Contributing

This module is designed to be extended. Key extension points:
1. **KubernetesClientService**: Add new K8s resource types
2. **ClustersService**: Add new cluster operations
3. **Controller**: Add new API endpoints
4. **DTOs**: Add new request/response types

Follow existing patterns for consistency.

## 📝 License

This implementation is created for your multi-tenant Kubernetes platform.

## 🆘 Support

### Documentation
- 📖 [kubernetes-cluster-integration.md](docs/kubernetes-cluster-integration.md) - Complete reference
- 🎓 [cluster-integration-tutorial.md](docs/cluster-integration-tutorial.md) - Step-by-step guide
- ⚡ [QUICK-REFERENCE.md](docs/QUICK-REFERENCE.md) - Fast lookup
- 🔧 [MIGRATION-GUIDE.md](docs/MIGRATION-GUIDE.md) - Deployment guide

### Getting Help
1. Check documentation for your question
2. Review [troubleshooting section](docs/kubernetes-cluster-integration.md#common-errors-and-fixes)
3. Check audit logs for operation details
4. Test with `/test` and `/health` endpoints

## 📊 Status

✅ **Production Ready**

- [x] Encryption implemented
- [x] Multi-tenant isolation
- [x] Audit logging
- [x] Error handling
- [x] Input validation
- [x] RBAC configuration
- [x] Comprehensive documentation
- [x] Migration guide
- [x] Security best practices

## 🎉 You're All Set!

Your Kubernetes cluster integration is ready to use. Start with:

1. **Quick Start**: Follow prerequisites and setup above
2. **First Cluster**: Use [QUICK-REFERENCE.md](docs/QUICK-REFERENCE.md) to create a test cluster
3. **Production**: Follow [MIGRATION-GUIDE.md](docs/MIGRATION-GUIDE.md) for production deployment
4. **Learn More**: Explore documentation as needed

Happy clustering! 🚀
