/**
 * @swagger
 * tags:
 *   - name: Kubernetes
 *     description: Kubernetes cluster operations
 */
import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import log from '../../lib/logger.js';
import { k8sConfigManager } from '../../lib/k8s-config.js';
import * as k8s from '@kubernetes/client-node';
const router = Router();
router.get('/status', async (req, res) => {
    try {
        const k8sConfig = await k8sConfigManager.loadConfig();
        if (!k8sConfig.connected) {
            return res.json({
                connected: false,
                version: 'unknown',
                provider: 'none',
                error: 'No Kubernetes cluster detected. Make sure you have k3s, minikube, kind, or docker-desktop running with a valid kubeconfig.'
            });
        }
        let version = 'unknown';
        try {
            const versionApi = k8sConfig.kubeConfig.makeApiClient(k8s.VersionApi);
            const versionInfo = await versionApi.getCode();
            version = versionInfo.body.gitVersion || 'unknown';
        }
        catch (e) {
            log.debug('Could not fetch version:', e);
        }
        res.json({
            connected: true,
            version,
            provider: k8sConfig.provider,
            apiServer: k8sConfig.apiServer,
            namespace: k8sConfig.namespace
        });
    }
    catch (error) {
        log.error('K8s status error:', error);
        res.status(500).json({
            connected: false,
            error: error.message || 'Failed to connect to Kubernetes cluster'
        });
    }
});
router.get('/namespaces', async (req, res) => {
    try {
        const k8sConfig = await k8sConfigManager.loadConfig();
        if (!k8sConfig.connected) {
            return res.status(503).json({ error: 'Service Unavailable', message: 'Not connected to cluster' });
        }
        const coreApi = k8sConfig.kubeConfig.makeApiClient(k8s.CoreV1Api);
        const response = await coreApi.listNamespace();
        const namespaces = response.body.items.map(ns => ({
            name: ns.metadata?.name || 'unknown',
            status: ns.status?.phase || 'Unknown',
            age: calculateAge(ns.metadata?.creationTimestamp),
        }));
        res.json(namespaces);
    }
    catch (error) {
        log.error('K8s namespaces error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.get('/pods', async (req, res) => {
    try {
        const k8sConfig = await k8sConfigManager.loadConfig();
        if (!k8sConfig.connected) {
            return res.status(503).json({ error: 'Service Unavailable', message: 'Not connected to cluster' });
        }
        const namespace = req.query.namespace || 'default';
        const coreApi = k8sConfig.kubeConfig.makeApiClient(k8s.CoreV1Api);
        let pods = [];
        if (namespace && namespace !== 'all') {
            const response = await coreApi.listNamespacedPod(namespace);
            pods = response.body.items;
        }
        else {
            const response = await coreApi.listPodForAllNamespaces();
            pods = response.body.items;
        }
        const podList = pods.map(pod => ({
            name: pod.metadata?.name || 'unknown',
            namespace: pod.metadata?.namespace || 'default',
            status: pod.status?.phase || 'Unknown',
            ready: `${pod.status?.containerStatuses?.filter(c => c.ready).length || 0}/${pod.status?.containerStatuses?.length || 0}`,
            restarts: pod.status?.containerStatuses?.reduce((sum, c) => sum + (c.restartCount || 0), 0) || 0,
            age: calculateAge(pod.metadata?.creationTimestamp),
            nodeName: pod.spec?.nodeName,
            ip: pod.status?.podIP,
        }));
        res.json(podList);
    }
    catch (error) {
        log.error('K8s pods error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.get('/services', async (req, res) => {
    try {
        const k8sConfig = await k8sConfigManager.loadConfig();
        if (!k8sConfig.connected) {
            return res.status(503).json({ error: 'Service Unavailable', message: 'Not connected to cluster' });
        }
        const namespace = req.query.namespace || 'default';
        const coreApi = k8sConfig.kubeConfig.makeApiClient(k8s.CoreV1Api);
        let services = [];
        if (namespace && namespace !== 'all') {
            const response = await coreApi.listNamespacedService(namespace);
            services = response.body.items;
        }
        else {
            const response = await coreApi.listServiceForAllNamespaces();
            services = response.body.items;
        }
        const serviceList = services.map(svc => ({
            name: svc.metadata?.name || 'unknown',
            namespace: svc.metadata?.namespace || 'default',
            type: svc.spec?.type || 'ClusterIP',
            clusterIP: svc.spec?.clusterIP || 'None',
            externalIP: svc.spec?.externalIPs?.join(', ') || svc.spec?.externalName || 'None',
            ports: svc.spec?.ports?.map(p => `${p.port}/${p.protocol}`) || [],
            selector: svc.spec?.selector || null,
        }));
        res.json(serviceList);
    }
    catch (error) {
        log.error('K8s services error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.get('/nodes', async (req, res) => {
    try {
        const k8sConfig = await k8sConfigManager.loadConfig();
        if (!k8sConfig.connected) {
            return res.status(503).json({ error: 'Service Unavailable', message: 'Not connected to cluster' });
        }
        const coreApi = k8sConfig.kubeConfig.makeApiClient(k8s.CoreV1Api);
        const response = await coreApi.listNode();
        const nodes = response.body.items;
        const nodeList = nodes.map(node => {
            const conditions = node.status?.conditions || [];
            const readyCondition = conditions.find(c => c.type === 'Ready');
            const ready = readyCondition?.status === 'True';
            const cpu = node.status?.capacity?.cpu || 'unknown';
            const memory = node.status?.capacity?.memory || 'unknown';
            return {
                name: node.metadata?.name || 'unknown',
                status: ready ? 'Ready' : 'NotReady',
                cpu,
                memory,
                version: node.status?.nodeInfo?.kubeletVersion || 'unknown',
                age: calculateAge(node.metadata?.creationTimestamp),
                roles: getNodeRoles(node.metadata?.labels),
                internalIP: node.status?.addresses?.find(a => a.type === 'InternalIP')?.address,
                externalIP: node.status?.addresses?.find(a => a.type === 'ExternalIP')?.address,
            };
        });
        res.json(nodeList);
    }
    catch (error) {
        log.error('K8s nodes error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.get('/deployments', async (req, res) => {
    try {
        const k8sConfig = await k8sConfigManager.loadConfig();
        if (!k8sConfig.connected) {
            return res.status(503).json({ error: 'Service Unavailable', message: 'Not connected to cluster' });
        }
        const namespace = req.query.namespace || 'default';
        const appsApi = k8sConfig.kubeConfig.makeApiClient(k8s.AppsV1Api);
        let deployments = [];
        if (namespace && namespace !== 'all') {
            const response = await appsApi.listNamespacedDeployment(namespace);
            deployments = response.body.items;
        }
        else {
            const response = await appsApi.listDeploymentForAllNamespaces();
            deployments = response.body.items;
        }
        const deploymentList = deployments.map(dep => ({
            name: dep.metadata?.name || 'unknown',
            namespace: dep.metadata?.namespace || 'default',
            replicas: dep.spec?.replicas || 0,
            readyReplicas: dep.status?.readyReplicas || 0,
            availableReplicas: dep.status?.availableReplicas || 0,
            age: calculateAge(dep.metadata?.creationTimestamp),
            images: dep.spec?.template?.spec?.containers?.map(c => c.image) || [],
            selector: dep.spec?.selector?.matchLabels || null,
        }));
        res.json(deploymentList);
    }
    catch (error) {
        log.error('K8s deployments error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.get('/ingresses', async (req, res) => {
    try {
        const k8sConfig = await k8sConfigManager.loadConfig();
        if (!k8sConfig.connected) {
            return res.status(503).json({ error: 'Service Unavailable', message: 'Not connected to cluster' });
        }
        const namespace = req.query.namespace || 'default';
        const networkingApi = k8sConfig.kubeConfig.makeApiClient(k8s.NetworkingV1Api);
        let ingresses = [];
        if (namespace && namespace !== 'all') {
            const response = await networkingApi.listNamespacedIngress(namespace);
            ingresses = response.body.items;
        }
        else {
            const response = await networkingApi.listIngressForAllNamespaces();
            ingresses = response.body.items;
        }
        const ingressList = ingresses.map(ing => ({
            name: ing.metadata?.name || 'unknown',
            namespace: ing.metadata?.namespace || 'default',
            hosts: ing.spec?.rules?.map(r => r.host) || [],
            age: calculateAge(ing.metadata?.creationTimestamp),
            tls: ing.spec?.tls?.map(t => t.hosts?.join(', ')) || [],
        }));
        res.json(ingressList);
    }
    catch (error) {
        log.error('K8s ingresses error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.post('/create-namespace', authMiddleware, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name)
            return res.status(400).json({ error: 'Bad Request', message: 'Namespace name required' });
        const k8sConfig = await k8sConfigManager.loadConfig();
        if (!k8sConfig.connected)
            return res.status(503).json({ error: 'Service Unavailable' });
        const coreApi = k8sConfig.kubeConfig.makeApiClient(k8s.CoreV1Api);
        await coreApi.createNamespace({ metadata: { name } });
        log.info(`Namespace created: ${name}`);
        res.json({ message: 'Namespace created', name });
    }
    catch (error) {
        log.error('K8s create namespace error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.post('/create-deployment', authMiddleware, async (req, res) => {
    try {
        const { name, image, namespace, replicas, port } = req.body;
        if (!name || !image || !namespace) {
            return res.status(400).json({ error: 'Bad Request', message: 'name, image, and namespace required' });
        }
        const k8sConfig = await k8sConfigManager.loadConfig();
        if (!k8sConfig.connected)
            return res.status(503).json({ error: 'Service Unavailable' });
        const appsApi = k8sConfig.kubeConfig.makeApiClient(k8s.AppsV1Api);
        const deployment = {
            metadata: { name },
            spec: {
                replicas: replicas || 1,
                selector: { matchLabels: { app: name } },
                template: {
                    metadata: { labels: { app: name } },
                    spec: {
                        containers: [{
                                name,
                                image,
                                ports: port ? [{ containerPort: port }] : undefined,
                            }],
                    },
                },
            },
        };
        await appsApi.createNamespacedDeployment(namespace, deployment);
        log.info(`Deployment created: ${name} in ${namespace}`);
        res.json({ message: 'Deployment created', name, namespace });
    }
    catch (error) {
        log.error('K8s create deployment error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.post('/create-service', authMiddleware, async (req, res) => {
    try {
        const { name, namespace, servicePort, targetPort, type } = req.body;
        if (!name || !namespace || !servicePort) {
            return res.status(400).json({ error: 'Bad Request', message: 'name, namespace, and servicePort required' });
        }
        const k8sConfig = await k8sConfigManager.loadConfig();
        if (!k8sConfig.connected)
            return res.status(503).json({ error: 'Service Unavailable' });
        const coreApi = k8sConfig.kubeConfig.makeApiClient(k8s.CoreV1Api);
        const service = {
            metadata: { name },
            spec: {
                type: type || 'ClusterIP',
                selector: { app: name },
                ports: [{
                        port: parseInt(servicePort),
                        targetPort: targetPort ? parseInt(targetPort) : parseInt(servicePort),
                        protocol: 'TCP',
                    }],
            },
        };
        await coreApi.createNamespacedService(namespace, service);
        log.info(`Service created: ${name} in ${namespace}`);
        res.json({ message: 'Service created', name, namespace });
    }
    catch (error) {
        log.error('K8s create service error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.delete('/delete-resource', authMiddleware, async (req, res) => {
    try {
        const { type, name, namespace } = req.query;
        if (!type || !name || !namespace) {
            return res.status(400).json({ error: 'Bad Request', message: 'type, name, and namespace required' });
        }
        const k8sConfig = await k8sConfigManager.loadConfig();
        if (!k8sConfig.connected)
            return res.status(503).json({ error: 'Service Unavailable' });
        const ns = namespace;
        const resourceName = name;
        const resourceType = type;
        switch (resourceType) {
            case 'namespace': {
                const coreApi = k8sConfig.kubeConfig.makeApiClient(k8s.CoreV1Api);
                await coreApi.deleteNamespace(resourceName);
                break;
            }
            case 'deployment': {
                const appsApi = k8sConfig.kubeConfig.makeApiClient(k8s.AppsV1Api);
                await appsApi.deleteNamespacedDeployment(resourceName, ns);
                break;
            }
            case 'service': {
                const coreApi = k8sConfig.kubeConfig.makeApiClient(k8s.CoreV1Api);
                await coreApi.deleteNamespacedService(resourceName, ns);
                break;
            }
            case 'pod': {
                const coreApi = k8sConfig.kubeConfig.makeApiClient(k8s.CoreV1Api);
                await coreApi.deleteNamespacedPod(resourceName, ns);
                break;
            }
            default:
                return res.status(400).json({ error: 'Bad Request', message: 'Unknown resource type' });
        }
        log.info(`${resourceType} deleted: ${resourceName} from ${ns}`);
        res.json({ message: `${resourceType} deleted`, name: resourceName, namespace: ns });
    }
    catch (error) {
        log.error('K8s delete resource error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
function calculateAge(timestamp) {
    if (!timestamp)
        return 'unknown';
    const now = new Date();
    const created = new Date(timestamp);
    const diffMs = now.getTime() - created.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay > 0)
        return `${diffDay}d`;
    if (diffHour > 0)
        return `${diffHour}h`;
    if (diffMin > 0)
        return `${diffMin}m`;
    return `${diffSec}s`;
}
function getNodeRoles(labels) {
    if (!labels)
        return 'worker';
    if (labels['node-role.kubernetes.io/master'] === 'true' ||
        labels['node-role.kubernetes.io/control-plane'] === 'true') {
        return 'master';
    }
    const roles = [];
    for (const [key, value] of Object.entries(labels)) {
        if (key.startsWith('node-role.kubernetes.io/') && value === 'true') {
            roles.push(key.replace('node-role.kubernetes.io/', ''));
        }
    }
    return roles.length > 0 ? roles.join(', ') : 'worker';
}
export default router;
