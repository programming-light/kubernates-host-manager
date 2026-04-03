# Cluster Integration Developer Tutorial

This tutorial walks you through connecting your Kubernetes cluster to the platform in 15 minutes.

## Prerequisites

- Kubernetes cluster (Minikube, Docker Desktop, kind, k3d, or production)
- `kubectl` installed and configured
- `curl` or Postman for API testing
- Platform running locally or accessible via network

## Quick Start (5 minutes)

### 1. Start Your Cluster

#### Option A: Minikube
```bash
minikube start
# or with more resources
minikube start --cpus=4 --memory=8192
```

#### Option B: Docker Desktop
- Open Docker Desktop
- Go to Settings → Kubernetes → Enable Kubernetes
- Click "Apply & Restart"

#### Option C: kind
```bash
kind create cluster --name local
```

#### Option D: k3d
```bash
k3d cluster create local
```

### 2. Get Your Credentials

For simplicity, we'll use **Kubeconfig Mode**.

**On Linux/macOS**:
```bash
# Get kubeconfig and base64 encode it
KUBECONFIG_B64=$(cat ~/.kube/config | base64 | tr -d '\n')
echo "KUBECONFIG_BASE64=$KUBECONFIG_B64"
```

**On Windows (PowerShell)**:
```powershell
$content = Get-Content $env:KUBECONFIG -Raw
$bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
$base64 = [Convert]::ToBase64String($bytes)
Write-Host "KUBECONFIG_BASE64=$base64"
```

### 3. Create Cluster via API

```bash
# Variables
WORKSPACE_ID="your-workspace-id"  # From your platform workspace
JWT_TOKEN="your-jwt-token"        # From /auth/login
API_URL="http://localhost:3001/api"

# Create cluster
curl -X POST "$API_URL/workspaces/$WORKSPACE_ID/clusters/kubeconfig" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d "{
    \"name\": \"local-cluster\",
    \"description\": \"My local development cluster\",
    \"provider\": \"MINIKUBE\",
    \"region\": \"local\",
    \"environment\": \"LOCAL\",
    \"kubeconfigBase64\": \"$KUBECONFIG_B64\"
  }"
```

**Response**:
```json
{
  "id": "cluster_abc123",
  "name": "local-cluster",
  "provider": "MINIKUBE",
  "status": "ACTIVE",
  "kubernetesVersion": "1.27.0",
  "nodeCount": 1,
  "createdAt": "2024-03-12T10:00:00Z"
}
```

### 4. Verify Connectivity

```bash
# Test connection
curl -X POST "$API_URL/workspaces/$WORKSPACE_ID/clusters/cluster_abc123/test" \
  -H "Authorization: Bearer $JWT_TOKEN"

# Response:
{
  "healthy": true,
  "message": "Cluster is reachable and healthy"
}
```

Done! You now have a connected Kubernetes cluster.

## Production Setup (15 minutes)

### 1. Create Namespace and Service Account

```bash
# Apply RBAC configuration from the repository
kubectl apply -f infra/rbac/platform-deployer-rbac.yaml

# Verify
kubectl get sa -n platform-system
kubectl get clusterrole platform-deployer
```

### 2. Get Cluster Details

```bash
# API endpoint
KUBE_API=$(kubectl cluster-info | grep 'Kubernetes master' | cut -d' ' -f7)
echo "API Endpoint: $KUBE_API"

# CA certificate (base64 encoded)
CA_CERT=$(kubectl config view --raw --flatten | \
  grep certificate-authority-data | awk '{print $2}')
echo "CA Certificate (base64): $CA_CERT"

# Create token (Kubernetes 1.24+)
TOKEN=$(kubectl create token platform-deployer -n platform-system --duration=87600h)
echo "Token: $TOKEN"
```

### 3. Create Cluster via Token Mode

```bash
curl -X POST "$API_URL/workspaces/$WORKSPACE_ID/clusters/token" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d "{
    \"name\": \"production-cluster\",
    \"description\": \"Production EKS cluster\",
    \"provider\": \"EKS\",
    \"region\": \"us-west-2\",
    \"environment\": \"PRODUCTION\",
    \"apiEndpoint\": \"$KUBE_API\",
    \"caCertificateBase64\": \"$CA_CERT\",
    \"token\": \"$TOKEN\"
  }"
```

### 4. Get Cluster Information

```bash
# Get cluster details
curl -X GET "$API_URL/workspaces/$WORKSPACE_ID/clusters/cluster_abc123" \
  -H "Authorization: Bearer $JWT_TOKEN" | jq

# Get namespaces
curl -X GET "$API_URL/workspaces/$WORKSPACE_ID/clusters/cluster_abc123/namespaces" \
  -H "Authorization: Bearer $JWT_TOKEN" | jq

# Get nodes
curl -X GET "$API_URL/workspaces/$WORKSPACE_ID/clusters/cluster_abc123/nodes" \
  -H "Authorization: Bearer $JWT_TOKEN" | jq

# Get storage classes
curl -X GET "$API_URL/workspaces/$WORKSPACE_ID/clusters/cluster_abc123/storage-classes" \
  -H "Authorization: Bearer $JWT_TOKEN" | jq
```

## Common Workflows

### Testing a New Cluster

```bash
#!/bin/bash

WORKSPACE_ID=$1
CLUSTER_ID=$2
JWT_TOKEN=$3
API_URL="http://localhost:3001/api"

echo "Testing cluster $CLUSTER_ID..."

# 1. Test connectivity
echo "1. Testing connection..."
curl -s -X POST "$API_URL/workspaces/$WORKSPACE_ID/clusters/$CLUSTER_ID/test" \
  -H "Authorization: Bearer $JWT_TOKEN" | jq .

# 2. Health check
echo "2. Checking health..."
curl -s -X POST "$API_URL/workspaces/$WORKSPACE_ID/clusters/$CLUSTER_ID/health" \
  -H "Authorization: Bearer $JWT_TOKEN" | jq .

# 3. List namespaces
echo "3. Getting namespaces..."
curl -s -X GET "$API_URL/workspaces/$WORKSPACE_ID/clusters/$CLUSTER_ID/namespaces" \
  -H "Authorization: Bearer $JWT_TOKEN" | jq .

# 4. List nodes
echo "4. Getting nodes..."
curl -s -X GET "$API_URL/workspaces/$WORKSPACE_ID/clusters/$CLUSTER_ID/nodes" \
  -H "Authorization: Bearer $JWT_TOKEN" | jq .

echo "Cluster test complete!"
```

### Listing All Clusters

```bash
curl -s -X GET "$API_URL/workspaces/$WORKSPACE_ID/clusters" \
  -H "Authorization: Bearer $JWT_TOKEN" | jq '.[] | {id, name, provider, status, nodeCount}'
```

### Updating Cluster Credentials

```bash
# Get new token
NEW_TOKEN=$(kubectl create token platform-deployer -n platform-system --duration=87600h)

# Update cluster
curl -X PUT "$API_URL/workspaces/$WORKSPACE_ID/clusters/cluster_abc123" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d "{
    \"token\": \"$NEW_TOKEN\"
  }"
```

### Deleting a Cluster

```bash
curl -X DELETE "$API_URL/workspaces/$WORKSPACE_ID/clusters/cluster_abc123" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

## Development Tips

### Enable Debug Logging

Set environment variable before starting the backend:

```bash
export DEBUG=kubernetes-cluster-*
npm run dev
```

### Testing with Postman

1. Create a Postman collection
2. Set variables:
   - `api_url`: http://localhost:3001/api
   - `workspace_id`: your-workspace-id
   - `jwt_token`: your-token
   - `cluster_id`: cluster-id-from-create

3. Create requests:
   - POST: `{{api_url}}/workspaces/{{workspace_id}}/clusters/token`
   - GET: `{{api_url}}/workspaces/{{workspace_id}}/clusters`
   - POST: `{{api_url}}/workspaces/{{workspace_id}}/clusters/{{cluster_id}}/test`

### Debugging Connection Issues

```typescript
// In your code
import { ClustersService } from './modules/clusters/clusters.service';

// Add debug logging
const credentials = {
  apiEndpoint: 'https://...',
  caCertificateBase64: '...',
  token: '...',
};

console.log('[DEBUG] Testing credentials:');
console.log('[DEBUG] Endpoint:', credentials.apiEndpoint);
console.log('[DEBUG] CA Cert length:', credentials.caCertificateBase64.length);
console.log('[DEBUG] Token length:', credentials.token.length);

// Test
const result = await this.k8sClient.testConnection(credentials);
console.log('[DEBUG] Connection result:', result);
```

### Monitoring Audit Logs

```bash
# Get all cluster-related audit logs
curl -s -X GET "$API_URL/workspaces/$WORKSPACE_ID/audit-logs?resource=cluster" \
  -H "Authorization: Bearer $JWT_TOKEN" | jq '.[] | {action, result, createdAt}'
```

## Troubleshooting

### "Failed to connect to cluster"

1. Verify credentials are correct:
```bash
# Test with kubectl
kubectl --token=$TOKEN --server=$API_ENDPOINT get nodes
```

2. Check API endpoint is accessible:
```bash
curl -v --cacert ca.crt https://$API_ENDPOINT/api/v1/nodes
```

3. Verify token has permissions:
```bash
kubectl auth can-i list nodes --as=system:serviceaccount:platform-system:platform-deployer
```

### "Certificate signed by unknown authority"

Ensure CA certificate is properly base64 encoded:
```bash
# Verify
echo "$CA_CERT" | base64 -d | openssl x509 -text -noout | head -20

# Should show certificate details, not errors
```

### Cluster shows "INACTIVE"

The cluster becomes inactive after health check failures. To reactivate:

1. Fix the underlying issue
2. Call the health check endpoint:
```bash
curl -X POST "$API_URL/workspaces/$WORKSPACE_ID/clusters/$CLUSTER_ID/health" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

The cluster status will update to ACTIVE if healthy.

## Next Steps

Once you have a cluster connected:

1. **Deploy Applications**: Use the cluster for deploying apps
2. **Set up Monitoring**: Configure health checks and alerts
3. **Multiple Clusters**: Add production, staging, and dev clusters
4. **Automation**: Integrate with CI/CD pipelines
5. **Security**: Rotate tokens, review RBAC policies

See the main documentation in `docs/kubernetes-cluster-integration.md` for more details on each topic.

## Getting Help

### Check Logs

```bash
# Backend logs (development)
tail -f logs/backend.log

# Cluster audit logs
curl -s "$API_URL/workspaces/$WORKSPACE_ID/audit-logs?resource=cluster&action=test_connection" \
  -H "Authorization: Bearer $JWT_TOKEN" | jq

# Kubernetes event logs
kubectl get events -n platform-system
```

### Common Questions

**Q: How often are health checks run?**
A: Health checks are only run on demand via the API. For continuous monitoring, set up a scheduler that calls the endpoint periodically.

**Q: Can I use the same service account for multiple clusters?**
A: Yes, the service account works across clusters. However, for security, use separate service accounts per integration.

**Q: How do I rotate tokens?**
A: Create a new token, update the cluster via PUT endpoint, then delete the old service account.

**Q: What happens if credentials expire?**
A: The cluster will show ERROR status. Update the credentials via PUT to reconnect.

**Q: Can I use a kubeconfig file from a managed provider?**
A: Yes! All providers (EKS, GKE, AKS, DigitalOcean, etc.) generate kubeconfig files that work with this integration.
