/**
 * @swagger
 * tags:
 *   - name: Kubernetes
 *     description: Kubernetes cluster operations
 */

/**
 * @swagger
 * /api/kubernetes/status:
 *   get:
 *     tags: [Kubernetes]
 *     summary: Get cluster connection status
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cluster connection status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 connected:
 *                   type: boolean
 *                 provider:
 *                   type: string
 *                 apiServer:
 *                   type: string
 *                 namespace:
 *                   type: string
 */

/**
 * @swagger
 * /api/kubernetes/namespaces:
 *   get:
 *     tags: [Kubernetes]
 *     summary: List namespaces
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of namespaces
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Namespace'
 */

/**
 * @swagger
 * /api/kubernetes/pods:
 *   get:
 *     tags: [Kubernetes]
 *     summary: List pods
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: namespace
 *         schema:
 *           type: string
 *           default: default
 *       - in: query
 *         name: allNamespaces
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: List of pods
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Pod'
 */

/**
 * @swagger
 * /api/kubernetes/services:
 *   get:
 *     tags: [Kubernetes]
 *     summary: List services
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: namespace
 *         schema:
 *           type: string
 *           default: default
 *     responses:
 *       200:
 *         description: List of services
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Service'
 */

/**
 * @swagger
 * /api/kubernetes/nodes:
 *   get:
 *     tags: [Kubernetes]
 *     summary: List nodes
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of nodes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Node'
 */

/**
 * @swagger
 * /api/kubernetes/deployments:
 *   get:
 *     tags: [Kubernetes]
 *     summary: List deployments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: namespace
 *         schema:
 *           type: string
 *           default: default
 *     responses:
 *       200:
 *         description: List of deployments
 */

/**
 * @swagger
 * /api/kubernetes/create-namespace:
 *   post:
 *     tags: [Kubernetes]
 *     summary: Create namespace
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               labels:
 *                 type: object
 *     responses:
 *       201:
 *         description: Namespace created
 */

/**
 * @swagger
 * /api/kubernetes/create-deployment:
 *   post:
 *     tags: [Kubernetes]
 *     summary: Create deployment
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - image
 *               - namespace
 *             properties:
 *               name:
 *                 type: string
 *               image:
 *                 type: string
 *               namespace:
 *                 type: string
 *               replicas:
 *                 type: number
 *               port:
 *                 type: number
 *     responses:
 *       201:
 *         description: Deployment created
 */

/**
 * @swagger
 * /api/kubernetes/create-service:
 *   post:
 *     tags: [Kubernetes]
 *     summary: Create service
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - namespace
 *               - selector
 *               - port
 *             properties:
 *               name:
 *                 type: string
 *               namespace:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [ClusterIP, NodePort, LoadBalancer]
 *                 default: ClusterIP
 *               selector:
 *                 type: object
 *               port:
 *                 type: number
 *               targetPort:
 *                 type: number
 *     responses:
 *       201:
 *         description: Service created
 */

/**
 * @swagger
 * /api/kubernetes/delete-resource:
 *   delete:
 *     tags: [Kubernetes]
 *     summary: Delete resource
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [namespace, deployment, service, pod]
 *       - in: query
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: namespace
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Resource deleted
 */
import { Router } from 'express';
import { CoreV1Api, AppsV1Api, NetworkingV1Api } from '@kubernetes/client-node';
import { k8sConfigManager } from '../lib/k8s-config.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/status', async (req: AuthRequest, res) => {
  try {
    const config = await k8sConfigManager.loadConfig();
    res.json({
      connected: config.connected,
      provider: config.provider,
      apiServer: config.apiServer,
      namespace: config.namespace,
    });
  } catch (error: any) {
    res.json({ connected: false, error: error.message });
  }
});

router.get('/namespaces', async (req: AuthRequest, res) => {
  try {
    const config = await k8sConfigManager.loadConfig();
    const k8sApi = config.kubeConfig.makeApiClient(CoreV1Api);
    const response = await k8sApi.listNamespace();
    
    const namespaces = response.body.items.map((ns) => ({
      name: ns.metadata?.name,
      status: ns.status?.phase,
      labels: ns.metadata?.labels || {},
      createdAt: ns.metadata?.creationTimestamp,
    }));
    
    res.json(namespaces);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/pods', async (req: AuthRequest, res) => {
  try {
    const config = await k8sConfigManager.loadConfig();
    const { namespace, allNamespaces } = req.query;
    const k8sApi = config.kubeConfig.makeApiClient(CoreV1Api);
    
    let response;
    if (allNamespaces === 'true') {
      response = await k8sApi.listPodForAllNamespaces();
    } else {
      response = await k8sApi.listNamespacedPod((namespace as string) || config.namespace);
    }
    
    const pods = response.body.items.map((pod) => {
      const containers = pod.spec?.containers || [];
      const ready = containers.filter((c) => {
        const status = pod.status?.containerStatuses?.find((cs) => cs.name === c.name);
        return status?.ready;
      }).length;
      
      return {
        name: pod.metadata?.name,
        namespace: pod.metadata?.namespace,
        status: pod.status?.phase,
        ready: `${ready}/${containers.length}`,
        restarts: pod.status?.containerStatuses?.reduce((sum, cs) => sum + (cs.restartCount || 0), 0) || 0,
        age: getAge(pod.metadata?.creationTimestamp),
        containers: containers.map((c) => c.name),
        node: pod.spec?.nodeName,
      };
    });
    
    res.json(pods);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/services', async (req: AuthRequest, res) => {
  try {
    const config = await k8sConfigManager.loadConfig();
    const { namespace } = req.query;
    const k8sApi = config.kubeConfig.makeApiClient(CoreV1Api);
    const response = await k8sApi.listNamespacedService((namespace as string) || config.namespace);
    
    const services = response.body.items.map((svc) => ({
      name: svc.metadata?.name,
      namespace: svc.metadata?.namespace,
      type: svc.spec?.type,
      clusterIP: svc.spec?.clusterIP,
      externalIP: svc.spec?.externalIPs || [],
      ports: svc.spec?.ports?.map((p) => `${p.port}:${p.nodePort || p.targetPort}/${p.protocol}`),
      selector: svc.spec?.selector || {},
    }));
    
    res.json(services);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/nodes', async (req: AuthRequest, res) => {
  try {
    const config = await k8sConfigManager.loadConfig();
    const k8sApi = config.kubeConfig.makeApiClient(CoreV1Api);
    const response = await k8sApi.listNode();
    
    const nodes = response.body.items.map((node) => {
      const readyStatus = node.status?.conditions?.find((c) => c.type === 'Ready');
      
      return {
        name: node.metadata?.name,
        status: readyStatus?.status === 'True' ? 'Ready' : 'NotReady',
        roles: Object.keys(node.metadata?.labels || {})
          .filter((l) => l.startsWith('node-role/'))
          .map((l) => l.replace('node-role/', '')),
        cpu: node.status?.capacity?.cpu,
        memory: node.status?.capacity?.memory,
        pods: node.status?.capacity?.pods,
        age: getAge(node.metadata?.creationTimestamp),
        version: node.status?.nodeInfo?.kubeletVersion,
      };
    });
    
    res.json(nodes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/deployments', async (req: AuthRequest, res) => {
  try {
    const config = await k8sConfigManager.loadConfig();
    const { namespace } = req.query;
    const k8sApi = config.kubeConfig.makeApiClient(AppsV1Api);
    const response = await k8sApi.listNamespacedDeployment((namespace as string) || config.namespace);
    
    const deployments = response.body.items.map((dep) => ({
      name: dep.metadata?.name,
      namespace: dep.metadata?.namespace,
      replicas: dep.spec?.replicas,
      readyReplicas: dep.status?.readyReplicas,
      availableReplicas: dep.status?.availableReplicas,
      age: getAge(dep.metadata?.creationTimestamp),
      images: dep.spec?.template?.spec?.containers?.map((c) => c.image),
    }));
    
    res.json(deployments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/ingresses', async (req: AuthRequest, res) => {
  try {
    const config = await k8sConfigManager.loadConfig();
    const { namespace } = req.query;
    const networkingApi = config.kubeConfig.makeApiClient(NetworkingV1Api);
    const response = await networkingApi.listNamespacedIngress((namespace as string) || config.namespace);
    
    const ingresses = response.body.items.map((ing) => ({
      name: ing.metadata?.name,
      namespace: ing.metadata?.namespace,
      hosts: ing.spec?.rules?.map((r) => r.host),
      tls: ing.spec?.tls?.map((t) => t.hosts),
      age: getAge(ing.metadata?.creationTimestamp),
    }));
    
    res.json(ingresses);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/create-namespace', async (req: AuthRequest, res) => {
  try {
    const config = await k8sConfigManager.loadConfig();
    const { name, labels } = req.body;
    const k8sApi = config.kubeConfig.makeApiClient(CoreV1Api);
    
    const namespace = {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name,
        labels,
      },
    };
    
    const response = await k8sApi.createNamespace(namespace);
    res.status(201).json({
      name: response.body.metadata?.name,
      status: response.body.status?.phase,
      createdAt: response.body.metadata?.creationTimestamp,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/create-deployment', async (req: AuthRequest, res) => {
  try {
    const config = await k8sConfigManager.loadConfig();
    const { name, image, namespace, replicas = 1, port = 80 } = req.body;
    const k8sApi = config.kubeConfig.makeApiClient(AppsV1Api);
    
    const deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name },
      spec: {
        replicas,
        selector: { matchLabels: { app: name } },
        template: {
          metadata: { labels: { app: name } },
          spec: {
            containers: [{
              name,
              image,
              ports: [{ containerPort: port }],
              resources: {
                requests: { cpu: '100m', memory: '128Mi' },
                limits: { cpu: '500m', memory: '512Mi' },
              },
            }],
          },
        },
      },
    };
    
    const response = await k8sApi.createNamespacedDeployment(namespace || config.namespace, deployment);
    res.status(201).json({
      name: response.body.metadata?.name,
      namespace: response.body.metadata?.namespace,
      replicas: response.body.spec?.replicas,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/create-service', async (req: AuthRequest, res) => {
  try {
    const config = await k8sConfigManager.loadConfig();
    const { name, namespace, type = 'ClusterIP', selector, port, targetPort } = req.body;
    const k8sApi = config.kubeConfig.makeApiClient(CoreV1Api);
    
    const service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: { name },
      spec: {
        type,
        selector,
        ports: [{ port, targetPort, protocol: 'TCP' }],
      },
    };
    
    const response = await k8sApi.createNamespacedService(namespace || config.namespace, service);
    res.status(201).json({
      name: response.body.metadata?.name,
      namespace: response.body.metadata?.namespace,
      type: response.body.spec?.type,
      clusterIP: response.body.spec?.clusterIP,
      ports: response.body.spec?.ports?.map((p) => `${p.port}:${p.targetPort}`),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/delete-resource', async (req: AuthRequest, res) => {
  try {
    const config = await k8sConfigManager.loadConfig();
    const { type, name, namespace } = req.query;
    const ns = (namespace as string) || config.namespace;
    
    switch (type) {
      case 'namespace':
        await config.kubeConfig.makeApiClient(CoreV1Api).deleteNamespace(name as string);
        break;
      case 'deployment':
        await config.kubeConfig.makeApiClient(AppsV1Api).deleteNamespacedDeployment(name as string, ns);
        break;
      case 'service':
        await config.kubeConfig.makeApiClient(CoreV1Api).deleteNamespacedService(name as string, ns);
        break;
      case 'pod':
        await config.kubeConfig.makeApiClient(CoreV1Api).deleteNamespacedPod(name as string, ns);
        break;
      default:
        return res.status(400).json({ error: 'Invalid resource type' });
    }
    
    res.json({ success: true, message: `${type} ${name} deleted` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

function getAge(timestamp: Date | string | undefined): string {
  if (!timestamp) return '-';
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default router;
