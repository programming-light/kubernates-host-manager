import * as k8s from '@kubernetes/client-node';
import * as fs from 'fs';
import * as path from 'path';
import log from './logger.js';
class KubernetesConfigManager {
    kc = null;
    async loadConfig() {
        const provider = (process.env.K8S_PROVIDER || 'minikube');
        this.kc = new k8s.KubeConfig();
        try {
            switch (provider) {
                case 'minikube':
                    this.loadMinikubeConfig();
                    break;
                case 'kind':
                    this.loadKindConfig();
                    break;
                case 'k3s':
                    this.loadK3sConfig();
                    break;
                case 'k3d':
                    this.loadK3dConfig();
                    break;
                case 'docker-desktop':
                    this.loadDockerDesktopConfig();
                    break;
                case 'microk8s':
                    this.loadMicroK8sConfig();
                    break;
                case 'kubeadm':
                    this.loadKubeadmConfig();
                    break;
                case 'rancher':
                    this.loadRancherConfig();
                    break;
                case 'eks':
                    this.loadEKSConfig();
                    break;
                case 'gke':
                    this.loadGKEConfig();
                    break;
                case 'aks':
                    this.loadAKSConfig();
                    break;
                case 'custom':
                    this.loadCustomConfig();
                    break;
                default:
                    this.loadMinikubeConfig();
            }
            const cluster = this.kc.getCurrentCluster();
            return {
                provider,
                kubeConfig: this.kc,
                apiServer: cluster?.server || '',
                namespace: process.env.DEFAULT_NAMESPACE || 'default',
                connected: true,
            };
        }
        catch (error) {
            log.error(`Failed to load ${provider} config:`, error);
            return {
                provider,
                kubeConfig: this.kc,
                apiServer: '',
                namespace: 'default',
                connected: false,
            };
        }
    }
    expandPath(p) {
        if (p.startsWith('~')) {
            return path.join(process.env.HOME || '', p.slice(1));
        }
        return p;
    }
    loadKubeConfigFile(filePath) {
        const expandedPath = this.expandPath(filePath);
        if (fs.existsSync(expandedPath)) {
            this.kc.loadFromFile(expandedPath);
        }
        else {
            this.kc.loadFromDefault();
        }
    }
    loadMinikubeConfig() {
        const ip = process.env.MINIKUBE_IP || '192.168.49.2';
        const port = process.env.MINIKUBE_PORT || '8443';
        const token = process.env.MINIKUBE_TOKEN;
        const caCert = process.env.MINIKUBE_CA_CERT;
        const skipTls = process.env.K8S_SKIP_TLS_VERIFY === 'true';
        if (token) {
            this.kc.loadFromOptions({
                clusters: [{
                        name: 'minikube',
                        server: `https://${ip}:${port}`,
                        caData: caCert,
                        skipTLSVerify: skipTls,
                    }],
                users: [{
                        name: 'minikube-user',
                        token: token,
                    }],
                contexts: [{
                        name: 'minikube',
                        cluster: 'minikube',
                        user: 'minikube-user',
                    }],
                currentContext: 'minikube',
            });
        }
        else {
            this.loadKubeConfigFile('~/.kube/config');
        }
    }
    loadKindConfig() {
        const kubeConfigPath = process.env.KIND_KUBECONFIG || '~/.kube/config';
        const clusterName = process.env.KIND_CLUSTER_NAME || 'kind';
        const skipTls = process.env.K8S_SKIP_TLS_VERIFY === 'true';
        const expandedPath = this.expandPath(kubeConfigPath);
        if (fs.existsSync(expandedPath)) {
            this.kc.loadFromFile(expandedPath);
            if (skipTls) {
                const cluster = this.kc.getCurrentCluster();
                if (cluster) {
                    cluster.skipTLSVerify = true;
                }
            }
        }
        else {
            this.kc.loadFromOptions({
                clusters: [{
                        name: clusterName,
                        server: 'https://localhost:6443',
                        skipTLSVerify: skipTls,
                    }],
                users: [{
                        name: 'kind-user',
                        exec: {
                            command: 'kind',
                            args: ['get', 'kubeconfig', '--name', clusterName],
                            apiVersion: 'client.authentication.k8s.io/v1beta1',
                        },
                    }],
                contexts: [{
                        name: clusterName,
                        cluster: clusterName,
                        user: 'kind-user',
                    }],
                currentContext: clusterName,
            });
        }
    }
    loadK3sConfig() {
        const k3sUrl = process.env.K3S_URL || 'https://localhost:6443';
        const k3sToken = process.env.K3S_TOKEN;
        const k3sCaCert = process.env.K3S_CA_CERT;
        const skipTls = process.env.K8S_SKIP_TLS_VERIFY === 'true';
        if (k3sToken) {
            this.kc.loadFromOptions({
                clusters: [{
                        name: 'k3s',
                        server: k3sUrl,
                        caData: k3sCaCert,
                        skipTLSVerify: skipTls,
                    }],
                users: [{
                        name: 'k3s-user',
                        token: k3sToken,
                    }],
                contexts: [{
                        name: 'k3s',
                        cluster: 'k3s',
                        user: 'k3s-user',
                    }],
                currentContext: 'k3s',
            });
        }
        else {
            this.loadKubeConfigFile(process.env.K3S_KUBECONFIG || '~/.kube/config');
        }
    }
    loadK3dConfig() {
        const kubeConfigPath = process.env.K3D_KUBECONFIG || '~/.kube/config';
        const clusterName = process.env.K3D_CLUSTER_NAME || 'k3s-default';
        const skipTls = process.env.K8S_SKIP_TLS_VERIFY === 'true';
        const expandedPath = this.expandPath(kubeConfigPath);
        if (fs.existsSync(expandedPath)) {
            this.kc.loadFromFile(expandedPath);
            if (skipTls) {
                const cluster = this.kc.getCurrentCluster();
                if (cluster)
                    cluster.skipTLSVerify = true;
            }
        }
        else {
            this.kc.loadFromOptions({
                clusters: [{
                        name: clusterName,
                        server: 'https://localhost:6443',
                        skipTLSVerify: skipTls,
                    }],
                users: [{
                        name: 'k3d-user',
                        exec: {
                            command: 'k3d',
                            args: ['kubeconfig', 'get', clusterName],
                            apiVersion: 'client.authentication.k8s.io/v1beta1',
                        },
                    }],
                contexts: [{
                        name: clusterName,
                        cluster: clusterName,
                        user: 'k3d-user',
                    }],
                currentContext: clusterName,
            });
        }
    }
    loadDockerDesktopConfig() {
        const kubeConfigPath = process.env.DOCKER_DESKTOP_KUBECONFIG || '~/.kube/config';
        const skipTls = process.env.K8S_SKIP_TLS_VERIFY === 'true';
        const expandedPath = this.expandPath(kubeConfigPath);
        if (fs.existsSync(expandedPath)) {
            this.kc.loadFromFile(expandedPath);
            if (skipTls) {
                const cluster = this.kc.getCurrentCluster();
                if (cluster)
                    cluster.skipTLSVerify = true;
            }
        }
        else {
            this.kc.loadFromDefault();
        }
    }
    loadMicroK8sConfig() {
        const kubeConfigPath = process.env.MICROK8S_KUBECONFIG || '~/.kube/config';
        const skipTls = process.env.K8S_SKIP_TLS_VERIFY === 'true';
        const expandedPath = this.expandPath(kubeConfigPath);
        if (fs.existsSync(expandedPath)) {
            this.kc.loadFromFile(expandedPath);
            if (skipTls) {
                const cluster = this.kc.getCurrentCluster();
                if (cluster)
                    cluster.skipTLSVerify = true;
            }
        }
        else {
            this.kc.loadFromOptions({
                clusters: [{
                        name: 'microk8s',
                        server: 'https://localhost:16443',
                        skipTLSVerify: skipTls,
                    }],
                users: [{
                        name: 'microk8s-user',
                        exec: {
                            command: 'microk8s',
                            args: ['kubectl', 'config', 'view', '--raw'],
                            apiVersion: 'client.authentication.k8s.io/v1beta1',
                        },
                    }],
                contexts: [{
                        name: 'microk8s',
                        cluster: 'microk8s',
                        user: 'microk8s-user',
                    }],
                currentContext: 'microk8s',
            });
        }
    }
    loadKubeadmConfig() {
        const apiServer = process.env.KUBEADM_API_SERVER;
        const caCert = process.env.KUBEADM_CA_CERT;
        const token = process.env.KUBEADM_TOKEN;
        const nodeName = process.env.KUBEADM_NODE_NAME || 'kubeadm-node';
        const skipTls = process.env.K8S_SKIP_TLS_VERIFY === 'true';
        if (apiServer && token) {
            this.kc.loadFromOptions({
                clusters: [{
                        name: 'kubeadm',
                        server: apiServer,
                        caData: caCert,
                        skipTLSVerify: skipTls,
                    }],
                users: [{
                        name: nodeName,
                        token: token,
                    }],
                contexts: [{
                        name: 'kubeadm',
                        cluster: 'kubeadm',
                        user: nodeName,
                        namespace: process.env.DEFAULT_NAMESPACE || 'default',
                    }],
                currentContext: 'kubeadm',
            });
        }
        else {
            this.kc.loadFromDefault();
        }
    }
    loadRancherConfig() {
        const rancherUrl = process.env.RANCHER_URL;
        const rancherToken = process.env.RANCHER_TOKEN;
        const clusterId = process.env.RANCHER_CLUSTER_ID;
        if (rancherUrl && rancherToken) {
            this.kc.loadFromOptions({
                clusters: [{
                        name: 'rancher',
                        server: rancherUrl,
                        skipTLSVerify: false,
                    }],
                users: [{
                        name: 'rancher-user',
                        token: rancherToken,
                    }],
                contexts: [{
                        name: clusterId || 'default',
                        cluster: 'rancher',
                        user: 'rancher-user',
                    }],
                currentContext: clusterId || 'default',
            });
        }
        else {
            this.kc.loadFromDefault();
        }
    }
    loadEKSConfig() {
        const region = process.env.AWS_REGION || 'us-east-1';
        const clusterName = process.env.EKS_CLUSTER_NAME;
        const skipTls = process.env.K8S_SKIP_TLS_VERIFY === 'true';
        if (clusterName) {
            this.kc.loadFromOptions({
                clusters: [{
                        name: clusterName,
                        server: `https://${clusterName}.eks.${region}.amazonaws.com`,
                        skipTLSVerify: skipTls,
                    }],
                users: [{
                        name: 'eks-user',
                        exec: {
                            command: 'aws',
                            args: ['eks', 'get-token', '--cluster-name', clusterName, '--region', region],
                            apiVersion: 'client.authentication.k8s.io/v1beta1',
                        },
                    }],
                contexts: [{
                        name: 'eks',
                        cluster: clusterName,
                        user: 'eks-user',
                    }],
                currentContext: 'eks',
            });
        }
        else {
            this.loadKubeConfigFile(process.env.EKS_KUBECONFIG || '~/.kube/config');
        }
    }
    loadGKEConfig() {
        const projectId = process.env.GCP_PROJECT_ID;
        const location = process.env.GCP_REGION || 'us-central1';
        const clusterName = process.env.GKE_CLUSTER_NAME;
        const skipTls = process.env.K8S_SKIP_TLS_VERIFY === 'true';
        if (projectId && clusterName) {
            this.kc.loadFromOptions({
                clusters: [{
                        name: clusterName,
                        server: `https://${location}/projects/${projectId}/locations/${location}/clusters/${clusterName}`,
                        skipTLSVerify: skipTls,
                    }],
                users: [{
                        name: 'gke-user',
                        exec: {
                            command: 'gcloud',
                            args: ['container', 'clusters', 'get-credentials', clusterName, `--region=${location}`, `--project=${projectId}`],
                            apiVersion: 'client.authentication.k8s.io/v1beta1',
                        },
                    }],
                contexts: [{
                        name: 'gke',
                        cluster: clusterName,
                        user: 'gke-user',
                    }],
                currentContext: 'gke',
            });
        }
        else {
            this.kc.loadFromDefault();
        }
    }
    loadAKSConfig() {
        const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
        const resourceGroup = process.env.AZURE_RESOURCE_GROUP;
        const clusterName = process.env.AKS_CLUSTER_NAME;
        const skipTls = process.env.K8S_SKIP_TLS_VERIFY === 'true';
        if (subscriptionId && resourceGroup && clusterName) {
            this.kc.loadFromOptions({
                clusters: [{
                        name: clusterName,
                        server: `https://${clusterName}.${resourceGroup}.azmk8s.io`,
                        skipTLSVerify: skipTls,
                    }],
                users: [{
                        name: 'aks-user',
                        exec: {
                            command: 'az',
                            args: ['aks', 'get-credentials', '--resource-group', resourceGroup, '--name', clusterName, '--admin'],
                            apiVersion: 'client.authentication.k8s.io/v1beta1',
                        },
                    }],
                contexts: [{
                        name: clusterName,
                        cluster: clusterName,
                        user: 'aks-user',
                    }],
                currentContext: clusterName,
            });
        }
        else {
            this.kc.loadFromDefault();
        }
    }
    loadCustomConfig() {
        const apiServer = process.env.CUSTOM_K8S_API_SERVER;
        const caCert = process.env.CUSTOM_K8S_CA_CERT;
        const clientCert = process.env.CUSTOM_K8S_CLIENT_CERT;
        const clientKey = process.env.CUSTOM_K8S_CLIENT_KEY;
        const token = process.env.CUSTOM_K8S_TOKEN;
        const namespace = process.env.CUSTOM_K8S_NAMESPACE || 'default';
        const skipTls = process.env.K8S_SKIP_TLS_VERIFY === 'true';
        if (apiServer) {
            if (clientCert && clientKey) {
                this.kc.loadFromOptions({
                    clusters: [{
                            name: 'custom',
                            server: apiServer,
                            caData: caCert,
                            skipTLSVerify: skipTls,
                        }],
                    users: [{
                            name: 'custom-user',
                            certData: clientCert,
                            keyData: clientKey,
                        }],
                    contexts: [{
                            name: 'custom',
                            cluster: 'custom',
                            user: 'custom-user',
                            namespace: namespace,
                        }],
                    currentContext: 'custom',
                });
            }
            else if (token) {
                this.kc.loadFromOptions({
                    clusters: [{
                            name: 'custom',
                            server: apiServer,
                            caData: caCert,
                            skipTLSVerify: skipTls,
                        }],
                    users: [{
                            name: 'custom-user',
                            token: token,
                        }],
                    contexts: [{
                            name: 'custom',
                            cluster: 'custom',
                            user: 'custom-user',
                            namespace: namespace,
                        }],
                    currentContext: 'custom',
                });
            }
            else {
                this.kc.loadFromDefault();
            }
        }
        else {
            this.kc.loadFromDefault();
        }
    }
    getConfig() {
        return this.kc;
    }
}
export const k8sConfigManager = new KubernetesConfigManager();
