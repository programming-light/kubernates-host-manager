# Kubernetes Cluster Integration Guide

## Overview

This module provides a secure, production-ready way to connect your multi-tenant platform to Kubernetes clusters. It supports both local development environments (Minikube, Docker Desktop, kind, k3d) and production-grade clusters (managed Kubernetes, bare metal, VPS-hosted, private datacenters).

### Key Features

- **Dual Connection Modes**: Token-based (API server + CA cert + token) or kubeconfig-based
- **Encrypted Credentials**: All secrets encrypted with AES-256-GCM before database storage
- **Multi-Workspace Isolation**: Each workspace manages its own cluster credentials
- **Health Monitoring**: Regular connectivity and health checks with status tracking
- **Audit Logging**: Complete audit trail of all cluster operations
- **Cluster Discovery**: Automatically fetch namespaces, nodes, ingress classes, and storage classes
- **Future-Ready**: Designed to support deployment of various workload types

## Supported Connection Modes

### 1. Token Mode (Recommended for Production)

**Best for**: Production managed Kubernetes (EKS, GKE, AKS), VPS-hosted clusters, private datacenters

**What you need**:
- Kubernetes API server endpoint (e.g., `https://api.example.com:6443`)
- CA certificate (base64 encoded)
- Bearer token

**Benefits**:
- Fine-grained RBAC control
- Doesn't expose entire cluster config
- Works across different kubeconfig versions

**When to use**:
- Production environments
- Multiple users need different permissions
- Integration with CI/CD systems
- Strict security requirements

### 2. Kubeconfig Mode (Recommended for Development)

**Best for**: Local development (Minikube, Docker Desktop, kind, k3d), testing, single-user setups

**What you need**:
- Kubeconfig file (base64 encoded)

**Benefits**:
- Simpler for local development
- Works with all kubectl tools
- Less manual configuration

**When to use**:
- Local development environments
- Automated cluster setup scripts
- Testing and CI/CD environments

## Getting Started by Environment

### Minikube

#### Option 1: Kubeconfig Mode (Easiest)

```bash
# Start Minikube
minikube start

# Get the kubeconfig (usually at ~/.kube/config)
cat ~/.kube/config | base64 | tr -d '\n'
```

Then use the `/workspaces/{id}/clusters/kubeconfig` API endpoint.

#### Option 2: Token Mode

```bash
# Get API endpoint
KUBE_API=$(minikube ip)
echo "API: https://$KUBE_API:8443"

# Get CA certificate
minikube ssh "cat /var/lib/minikube/certs/ca.crt" | base64

# Get token (create a service account)
kubectl create serviceaccount minikube-admin -n default
kubectl create clusterrolebinding minikube-admin --clusterrole=cluster-admin \
  --serviceaccount=default:minikube-admin

# Get the token
KUBE_TOKEN=$(kubectl get secret $(kubectl get secret -n default \
  -o jsonpath='{.items[?(@.metadata.annotations.kubernetes\.io/service-account\.name=="minikube-admin")].metadata.name}') \
  -n default -o jsonpath='{.data.token}' | base64 --decode)
echo $KUBE_TOKEN
```

### Docker Desktop Kubernetes

#### Option 1: Kubeconfig Mode (Easiest)

```bash
# Enable Kubernetes in Docker Desktop settings
# Then get the kubeconfig
cat ~/.kube/config | base64 | tr -d '\n'
```

#### Option 2: Token Mode

```bash
# Get API endpoint
KUBE_API="https://kubernetes.docker.internal:6443"

# Get CA certificate from kubeconfig
kubectl config view --raw --flatten | grep certificate-authority-data | \
  awk '{print $2}' | base64 -d | base64 | tr -d '\n'

# Create service account and get token (same as Minikube above)
```

### kind (Kubernetes in Docker)

#### Recommended: Kubeconfig Mode

```bash
# Create cluster
kind create cluster --name my-cluster

# Get kubeconfig
kubectl config view --raw --flatten | base64 | tr -d '\n'
```

### k3d

#### Option 1: Kubeconfig Mode (Easiest)

```bash
# Create cluster
k3d cluster create my-cluster

# Get kubeconfig
k3d kubeconfig get my-cluster | base64 | tr -d '\n'
```

### Production Cluster (EKS/GKE/AKS)

#### Option 1: Token Mode (Recommended)

**For EKS**:
```bash
# Get API endpoint
aws eks describe-cluster --name my-cluster --region us-west-2 \
  --query 'cluster.endpoint' --output text

# Get CA certificate
aws eks describe-cluster --name my-cluster --region us-west-2 \
  --query 'cluster.certificateAuthority.data' --output text | base64

# Create service account with limited permissions
kubectl create serviceaccount platform-deployer -n kube-system
kubectl create clusterrole platform-deployer --verb=get,list,watch,create,update,patch,delete \
  --resource=deployments,services,ingresses,configmaps,secrets
kubectl create clusterrolebinding platform-deployer \
  --clusterrole=platform-deployer --serviceaccount=kube-system:platform-deployer

# Get token
kubectl get secret -n kube-system \
  -l app.kubernetes.io/name=platform-deployer \
  -o jsonpath='{.items[0].data.token}' | base64 --decode
```

**For GKE**:
```bash
# Get API endpoint
gcloud container clusters describe my-cluster --zone us-central1-a \
  --format='value(endpoint)'

# Get CA certificate
gcloud container clusters describe my-cluster --zone us-central1-a \
  --format='value(masterAuth.clusterCaCertificate)'

# Create service account (same as EKS above)
```

**For AKS**:
```bash
# Get API endpoint
az aks show --name my-cluster --resource-group my-rg \
  --query 'fqdn' --output tsv

# Get CA certificate
az aks get-credentials --name my-cluster --resource-group my-rg \
  --file - | grep certificate-authority-data | awk '{print $2}'

# Create service account (same as EKS above)
```

#### Option 2: Kubeconfig Mode

```bash
# For any provider, get kubeconfig
KUBECONFIG_PATH=$(echo $KUBECONFIG | cut -d: -f1)
cat $KUBECONFIG_PATH | base64 | tr -d '\n'
```

## Creating a Limited Service Account

**Why**: Never use cluster-admin credentials. Follow least-privilege principle.

```bash
# 1. Create namespace
kubectl create namespace platform-system

# 2. Create service account
kubectl create serviceaccount platform-deployer -n platform-system

# 3. Create role with specific permissions
kubectl apply -f - <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: platform-deployer
rules:
- apiGroups: ["apps"]
  resources: ["deployments", "statefulsets", "daemonsets"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
- apiGroups: [""]
  resources: ["services", "configmaps", "secrets", "persistentvolumeclaims"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
- apiGroups: ["networking.k8s.io"]
  resources: ["ingresses"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
- apiGroups: [""]
  resources: ["pods", "pods/logs"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["namespaces"]
  verbs: ["get", "list", "watch"]
EOF

# 4. Bind role to service account
kubectl create clusterrolebinding platform-deployer \
  --clusterrole=platform-deployer --serviceaccount=platform-system:platform-deployer

# 5. Get token (see below)
```

## Fetching Token and CA Certificate

### Get Token

```bash
# Method 1: Kubernetes 1.24+ (newer token format)
kubectl create token platform-deployer -n platform-system --duration=87600h

# Method 2: Kubernetes < 1.24 (secret-based)
kubectl get secret -n platform-system \
  -l app.kubernetes.io/name=platform-deployer \
  -o jsonpath='{.items[0].data.token}' | base64 --decode

# For debugging, list all secrets
kubectl get secrets -n platform-system
```

### Get CA Certificate

```bash
# From kubeconfig
kubectl config view --raw --flatten | grep certificate-authority-data | \
  awk '{print $2}'

# Or from the API server pod (if needed)
kubectl get secret -n default $(kubectl get secret -n default \
  -o name | grep default-token) \
  -o jsonpath='{.data.ca\.crt}'
```

## Base64 Encoding Files Safely

### Linux/macOS

```bash
# Simple encoding (with newline - REMOVE IT!)
cat kubeconfig.yaml | base64
# Result: abc123...XYZ\n
# ❌ WRONG - has newline!

# Correct encoding (no newlines)
cat kubeconfig.yaml | base64 | tr -d '\n'
# Result: abc123...XYZ
# ✓ CORRECT - no newlines!

# In a shell script
KUBE_CONFIG_B64=$(cat kubeconfig.yaml | base64 | tr -d '\n')
echo $KUBE_CONFIG_B64
```

### Windows (PowerShell)

```powershell
# Read file and convert to base64
$content = Get-Content kubeconfig.yaml -Raw
$bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
$base64 = [Convert]::ToBase64String($bytes)
Write-Host $base64
```

### Verify Encoding

```bash
# Decode to verify
echo "your-base64-string" | base64 -d

# Should output the original file content
cat kubeconfig.yaml
```

## Filling Environment Variables

### 1. Generate Encryption Key

```bash
# Linux/macOS
ENCRYPTION_KEY=$(openssl rand -hex 32)
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"

# Windows PowerShell
$encKey = -join((1..32 | ForEach-Object { Get-Random -Maximum 16 }).ForEach({"{0:x}" -f $_}))
Write-Host "ENCRYPTION_KEY=$encKey"
```

### 2. Add to `.env`

```bash
# .env
ENCRYPTION_KEY=your-64-character-hex-key-from-above
```

### 3. Add Optional K8s Credentials

If you want a default cluster (optional):

```bash
# Token mode
K8S_API_SERVER=https://api.example.com:6443
K8S_TOKEN=your-bearer-token
K8S_CA_CERT_BASE64=your-ca-cert-in-base64
K8S_DEFAULT_NAMESPACE=default

# OR kubeconfig mode
KUBECONFIG_BASE64=your-kubeconfig-in-base64
```

## Testing Connectivity

### Via API Endpoint

**Test connection** (returns minimal info, no secrets):

```bash
curl -X POST http://localhost:3001/api/workspaces/{workspaceId}/clusters/{clusterId}/test \
  -H "Authorization: Bearer $JWT_TOKEN"

# Response:
{
  "healthy": true,
  "message": "Cluster is reachable and healthy"
}
```

**Health check** (returns cluster version and node count):

```bash
curl -X POST http://localhost:3001/api/workspaces/{workspaceId}/clusters/{clusterId}/health \
  -H "Authorization: Bearer $JWT_TOKEN"

# Response:
{
  "healthy": true,
  "kubernetesVersion": "1.27.0",
  "nodeCount": 3
}
```

### Via kubectl

```bash
# If using kubeconfig mode, test directly
kubectl get nodes

# If using token mode, test via API server
curl -H "Authorization: Bearer $TOKEN" \
  --cacert ca.crt \
  https://api.example.com:6443/api/v1/nodes
```

### In Node.js

```typescript
import axios from 'axios';

// Test the cluster connectivity endpoint
async function testCluster(clusterId: string, workspaceId: string, token: string) {
  try {
    const response = await axios.post(
      `http://localhost:3001/api/workspaces/${workspaceId}/clusters/${clusterId}/test`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log('Cluster healthy:', response.data.healthy);
  } catch (error) {
    console.error('Connection failed:', error.response?.data?.message);
  }
}
```

## Common Errors and Fixes

### Error: "Failed to connect to cluster: x509: certificate signed by unknown authority"

**Cause**: CA certificate is incorrect or not base64 encoded properly.

**Fix**:
```bash
# Verify CA cert is valid base64
echo "your-ca-cert" | base64 -d | openssl x509 -text -noout

# Ensure no newlines in base64
echo "your-ca-cert" | tr -d '\n'
```

### Error: "Failed to connect to cluster: Unauthorized"

**Cause**: Token is invalid, expired, or doesn't have permissions.

**Fix**:
```bash
# Verify token is valid
kubectl get secret -n kube-system <secret-name> -o jsonpath='{.data.token}' | base64 -d

# Test with kubectl
kubectl --token=$TOKEN --server=$API_ENDPOINT get nodes
```

### Error: "Failed to connect to cluster: connection refused"

**Cause**: API server endpoint is incorrect or unreachable.

**Fix**:
```bash
# Verify endpoint is correct
curl -v https://your-api-endpoint:6443/api/v1/nodes

# Check firewall/network access
ping your-api-endpoint
# or use telnet
telnet your-api-endpoint 6443
```

### Error: "kubeconfig: invalid kubeconfig"

**Cause**: Kubeconfig is not valid YAML or not properly base64 encoded.

**Fix**:
```bash
# Decode and validate
echo "your-base64" | base64 -d > kubeconfig.yaml
kubectl --kubeconfig=kubeconfig.yaml get nodes

# Check for common issues
file kubeconfig.yaml
head kubeconfig.yaml
```

### Error: "Cluster not found" or "Workspace not found"

**Cause**: Wrong workspace ID or cluster ID.

**Fix**:
```bash
# List available workspaces and clusters
curl http://localhost:3001/api/auth/profile \
  -H "Authorization: Bearer $JWT_TOKEN"

# Should show your workspaces
curl http://localhost:3001/api/workspaces/{id}/clusters \
  -H "Authorization: Bearer $JWT_TOKEN"
```

## Security Best Practices

### 1. Never Use Cluster-Admin

```bash
# ❌ DON'T
kubectl create clusterrolebinding admin --clusterrole=cluster-admin \
  --serviceaccount=default:deployer

# ✓ DO - Create specific role
kubectl apply -f role.yaml
kubectl create clusterrolebinding deployer \
  --clusterrole=platform-deployer \
  --serviceaccount=default:deployer
```

### 2. Use Separate Service Accounts per Integration

```bash
# ✓ DO
kubectl create serviceaccount platform-deployer -n kube-system
kubectl create serviceaccount ci-cd-deployer -n kube-system
kubectl create serviceaccount monitoring -n kube-system

# Each gets own role with specific permissions
```

### 3. Rotate Tokens Regularly

```bash
# Create new token
kubectl create token platform-deployer -n kube-system --duration=87600h

# Update in platform
# Then delete old service account
kubectl delete serviceaccount old-deployer -n kube-system
```

### 4. Encrypt All Secrets

- All credentials are encrypted with AES-256-GCM before storage
- Encryption key is stored separately in environment variables
- Keys are never logged or exposed in API responses

### 5. Use RBAC Namespaces

```bash
# Create isolated namespaces for multi-tenancy
kubectl create namespace tenant-a
kubectl create namespace tenant-b

# Assign service accounts per namespace
kubectl create rolebinding deployer-a \
  --clusterrole=platform-deployer \
  --serviceaccount=kube-system:platform-deployer \
  -n tenant-a
```

### 6. Network Policies

```bash
# Restrict traffic between namespaces
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-cross-namespace
  namespace: tenant-a
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: tenant-a
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: tenant-a
  - to:
    - namespaceSelector: {}
      ports:
      - protocol: TCP
        port: 53 # DNS only
EOF
```

## Why Not Raw Cluster-Admin Credentials?

### Security Risks

1. **Lateral Movement**: Compromised token allows access to all cluster resources
2. **Data Exposure**: Can read secrets, config maps, and sensitive data
3. **Destructive Power**: Can delete entire cluster and data
4. **Audit Trail**: Hard to track which operations came from which client
5. **Compliance**: Violates least-privilege principle required by security standards

### Using Limited Service Accounts

```bash
# Specific permissions only
- Create/update deployments
- Manage services and ingresses
- Read logs and pod status
- Cannot delete persistent volumes
- Cannot access cluster secrets
- Cannot modify RBAC policies
```

## Future Extension Points

### Deployment Management

When adding deployment support, the cluster integration will:

1. **Deploy Applications**
   - Support multiple workload types (Deployments, StatefulSets, DaemonSets, Jobs)
   - Manage configurations (ConfigMaps, Secrets)
   - Handle ingress and network policies

2. **Manage Resources**
   - Scale replicas up/down
   - Update image versions
   - Apply resource limits (CPU, memory)
   - Auto-scaling policies

3. **Monitor Health**
   - Pod status and readiness
   - Resource usage (CPU, memory, network)
   - Event logs and error tracking
   - Health check integration

### Database and Cache Support

- PostgreSQL deployments
- Redis instances
- Elasticsearch clusters
- MongoDB sets

### CI/CD Integration

- GitHub Actions workflow generation
- GitLab CI configuration
- Automated deployments on push
- Rollback on failure

### Multi-Cluster Orchestration

- Application distribution across clusters
- Failover management
- Resource federation
- Cost optimization

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Platform Frontend                         │
│                  (Next.js React App)                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    JWT Token Exchange
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                 Clusters API Module                          │
├──────────────────────────────────────────────────────────────┤
│ ClustersController                                           │
│  - POST /create (token/kubeconfig)                           │
│  - GET /{id} details                                         │
│  - POST /{id}/test (connectivity)                            │
│  - GET /{id}/namespaces, nodes, etc.                        │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
       ┌───────▼──────────┐        ┌──────────▼──────────┐
       │ ClusterService   │        │ K8sClientService   │
       ├──────────────────┤        ├────────────────────┤
       │ - CRUD           │        │ - List namespaces  │
       │ - Audit logging  │        │ - Get nodes info   │
       │ - Validation     │        │ - Get ingress cls  │
       └───────┬──────────┘        │ - Get storage cls  │
               │                   │ - Test connection  │
               │                   │ - Health checks    │
       ┌───────▼──────────────┐    └────────┬───────────┘
       │ Cluster Encryption   │             │
       ├──────────────────────┤             │
       │ AES-256-GCM encrypt  │ ┌───────────▼──────────────┐
       │ Decrypt credentials  │ │ @kubernetes/client-node  │
       │ Base64 encode/decode │ │                          │
       └──────────────────────┘ │ - KubeConfig parser      │
               │                 │ - API client library     │
       ┌───────▼──────────────┐  │ - REST/gRPC calls       │
       │  PostgreSQL Database │  └───────────┬──────────────┘
       ├──────────────────────┤              │
       │ Cluster model        │ ┌────────────▼──────────────┐
       │ (credentials         │ │  Kubernetes API Server   │
       │  encrypted)          │ │                          │
       │                      │ │ - Authentication         │
       │ AuditLog model       │ │ - Authorization (RBAC)   │
       │ (all operations)     │ │ - Cluster resources      │
       └──────────────────────┘ └──────────────────────────┘
```

## API Reference

### Create Cluster (Token Mode)

```bash
POST /workspaces/{workspaceId}/clusters/token

{
  "name": "production-cluster",
  "description": "Main production cluster",
  "provider": "EKS",
  "region": "us-west-2",
  "environment": "PRODUCTION",
  "apiEndpoint": "https://api.example.com:6443",
  "caCertificateBase64": "LS0tLS1CRUdJTi...",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}

Response: 201 Created
{
  "id": "cluster_123",
  "name": "production-cluster",
  "provider": "EKS",
  "status": "ACTIVE",
  "kubernetesVersion": "1.27.0",
  "nodeCount": 5,
  ...
}
```

### Get Cluster Details

```bash
GET /workspaces/{workspaceId}/clusters/{clusterId}

Response: 200 OK
{
  "id": "cluster_123",
  "name": "production-cluster",
  "provider": "EKS",
  "region": "us-west-2",
  "environment": "PRODUCTION",
  "status": "ACTIVE",
  "connectionMode": "TOKEN",
  "kubernetesVersion": "1.27.0",
  "nodeCount": 5,
  "lastHealthCheckAt": "2024-03-12T10:30:00Z",
  "lastHealthCheckStatus": "HEALTHY",
  "createdAt": "2024-03-01T15:00:00Z"
}
```

### Test Connectivity

```bash
POST /workspaces/{workspaceId}/clusters/{clusterId}/test

Response: 200 OK
{
  "healthy": true,
  "message": "Cluster is reachable and healthy"
}
```

### Get Cluster Nodes

```bash
GET /workspaces/{workspaceId}/clusters/{clusterId}/nodes

Response: 200 OK
{
  "nodes": [
    {
      "name": "node-1",
      "status": "Ready",
      "roles": ["control-plane"],
      "cpuCapacity": "4",
      "memoryCapacity": "8Gi",
      "kubeletVersion": "v1.27.0"
    }
  ]
}
```

### Delete Cluster

```bash
DELETE /workspaces/{workspaceId}/clusters/{clusterId}

Response: 200 OK
{
  "message": "Cluster deleted successfully"
}
```

## Support and Troubleshooting

For issues with cluster connectivity:

1. Check cluster health: `POST /clusters/{id}/test`
2. Review audit logs: `GET /workspaces/{id}/audit-logs?resource=cluster`
3. Verify credentials are correctly base64 encoded
4. Ensure service account has required RBAC permissions
5. Check network connectivity between platform and cluster

For detailed logs, check application error logs with the audit log ID provided in error responses.
