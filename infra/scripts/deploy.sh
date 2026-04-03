#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

echo -e "${YELLOW}=== K8s Platform Deployment ===${NC}"
echo "Environment: $ENVIRONMENT"
echo "Project root: $PROJECT_ROOT"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(production|staging|development)$ ]]; then
    echo -e "${RED}Error: Environment must be production, staging, or development${NC}"
    exit 1
fi

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}kubectl not found. Please install kubectl.${NC}"
    exit 1
fi

if ! command -v kustomize &> /dev/null; then
    echo -e "${RED}kustomize not found. Please install kustomize.${NC}"
    exit 1
fi

# Verify kubeconfig
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}Cannot connect to Kubernetes cluster. Check your kubeconfig.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites check passed${NC}"

# Get current context
CURRENT_CONTEXT=$(kubectl config current-context)
echo "Current Kubernetes context: $CURRENT_CONTEXT"

# Confirm deployment
echo -e "${YELLOW}About to deploy to environment: $ENVIRONMENT${NC}"
echo "Kubernetes context: $CURRENT_CONTEXT"
read -p "Continue with deployment? (yes/no): " CONFIRM

if [[ "$CONFIRM" != "yes" ]]; then
    echo "Deployment cancelled."
    exit 0
fi

# Build images (optional)
read -p "Build Docker images? (yes/no): " BUILD_IMAGES

if [[ "$BUILD_IMAGES" == "yes" ]]; then
    echo -e "${YELLOW}Building Docker images...${NC}"
    
    REGISTRY=${REGISTRY:-ghcr.io/your-org}
    
    for service in backend frontend worker; do
        echo "Building $service..."
        docker build -t "$REGISTRY/k8s-platform/$service:latest" "$PROJECT_ROOT/packages/$service"
        docker push "$REGISTRY/k8s-platform/$service:latest"
    done
    
    echo -e "${GREEN}✓ Images built and pushed${NC}"
fi

# Create namespace if it doesn't exist
NAMESPACE="k8s-platform"
if [[ "$ENVIRONMENT" == "staging" ]]; then
    NAMESPACE="k8s-platform-staging"
fi

echo -e "${YELLOW}Creating namespace: $NAMESPACE${NC}"
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

# Apply kustomize configuration
echo -e "${YELLOW}Deploying to $ENVIRONMENT...${NC}"

KUSTOMIZE_PATH="$PROJECT_ROOT/infra/kustomize/overlays/$ENVIRONMENT"

if [[ ! -d "$KUSTOMIZE_PATH" ]]; then
    echo -e "${RED}Kustomize overlay not found: $KUSTOMIZE_PATH${NC}"
    exit 1
fi

# Apply manifests
kustomize build "$KUSTOMIZE_PATH" | kubectl apply -f -

echo -e "${GREEN}✓ Manifests applied${NC}"

# Wait for database migration
echo -e "${YELLOW}Waiting for database migration to complete...${NC}"
if kubectl wait --for=condition=complete job/database-migration -n "$NAMESPACE" --timeout=300s &>/dev/null; then
    echo -e "${GREEN}✓ Database migration completed${NC}"
else
    echo -e "${YELLOW}Database migration job not found or still running${NC}"
fi

# Wait for deployments
echo -e "${YELLOW}Waiting for deployments to roll out...${NC}"

for deployment in backend frontend worker; do
    echo "Rolling out $deployment..."
    kubectl rollout status deployment/$deployment -n "$NAMESPACE" --timeout=300s || {
        echo -e "${RED}✗ Rollout failed for $deployment${NC}"
        echo "Checking pod status..."
        kubectl describe deployment/$deployment -n "$NAMESPACE"
        exit 1
    }
done

echo -e "${GREEN}✓ All deployments rolled out${NC}"

# Verify deployment
echo -e "${YELLOW}Verifying deployment...${NC}"

echo "Pods:"
kubectl get pods -n "$NAMESPACE"

echo ""
echo "Services:"
kubectl get svc -n "$NAMESPACE"

echo ""
echo "Ingress:"
kubectl get ingress -n "$NAMESPACE"

# Print access information
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo "Environment: $ENVIRONMENT"
echo "Namespace: $NAMESPACE"
echo ""
echo "Check logs with:"
echo "  kubectl logs -f deployment/backend -n $NAMESPACE"
echo "  kubectl logs -f deployment/frontend -n $NAMESPACE"
echo "  kubectl logs -f deployment/worker -n $NAMESPACE"
echo ""
echo "Stream all logs with:"
echo "  stern . -n $NAMESPACE"
echo ""
echo "Get shell access with:"
echo "  kubectl exec -it <pod-name> -n $NAMESPACE -- /bin/bash"
