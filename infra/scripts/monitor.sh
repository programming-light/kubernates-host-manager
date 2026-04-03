#!/bin/bash

# Colors for output
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

NAMESPACE=${1:-k8s-platform}

echo -e "${YELLOW}=== K8s Platform Monitoring ===${NC}"
echo "Namespace: $NAMESPACE"
echo ""

# Check if stern is installed
if ! command -v stern &> /dev/null; then
    echo -e "${RED}stern not found. Install with: brew install stern${NC}"
    echo ""
    echo "Falling back to kubectl logs..."
    echo ""
fi

# Watch pod status
watch_pods() {
    clear
    echo -e "${YELLOW}=== Pod Status ===${NC}"
    kubectl get pods -n "$NAMESPACE" -o wide
    echo ""
    echo -e "${YELLOW}=== Pod Events ===${NC}"
    kubectl get events -n "$NAMESPACE" --sort-by='.lastTimestamp' | tail -20
}

# Show pod details
show_pod_details() {
    echo -e "${YELLOW}=== Pod Resource Usage ===${NC}"
    kubectl top pods -n "$NAMESPACE" 2>/dev/null || echo "Metrics not available"
    
    echo ""
    echo -e "${YELLOW}=== Node Resource Usage ===${NC}"
    kubectl top nodes 2>/dev/null || echo "Metrics not available"
}

# Show service details
show_services() {
    echo -e "${YELLOW}=== Services ===${NC}"
    kubectl get svc -n "$NAMESPACE"
    
    echo ""
    echo -e "${YELLOW}=== Ingress ===${NC}"
    kubectl get ingress -n "$NAMESPACE"
}

# Show logs
show_logs() {
    if command -v stern &> /dev/null; then
        echo -e "${YELLOW}=== Streaming logs (press Ctrl+C to exit) ===${NC}"
        stern . -n "$NAMESPACE" --tail 50
    else
        echo -e "${YELLOW}=== Backend Logs ===${NC}"
        kubectl logs -f deployment/backend -n "$NAMESPACE" --tail 50 &
        
        echo -e "${YELLOW}=== Frontend Logs ===${NC}"
        kubectl logs -f deployment/frontend -n "$NAMESPACE" --tail 50 &
        
        wait
    fi
}

# Menu
while true; do
    echo -e "${GREEN}Monitoring Menu:${NC}"
    echo "1) Watch pod status"
    echo "2) Show pod details"
    echo "3) Show services"
    echo "4) Show logs"
    echo "5) Shell into pod"
    echo "6) Exit"
    echo ""
    read -p "Select option: " OPTION
    
    case $OPTION in
        1) watch_pods; read -p "Press Enter to continue..." ;;
        2) show_pod_details; read -p "Press Enter to continue..." ;;
        3) show_services; read -p "Press Enter to continue..." ;;
        4) show_logs ;;
        5)
            echo "Available pods:"
            kubectl get pods -n "$NAMESPACE" -o name | cut -d/ -f2
            read -p "Enter pod name: " POD_NAME
            kubectl exec -it "$POD_NAME" -n "$NAMESPACE" -- /bin/bash
            ;;
        6) exit 0 ;;
        *) echo "Invalid option" ;;
    esac
done
