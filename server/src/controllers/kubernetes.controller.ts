import { FastifyRequest, FastifyReply } from 'fastify';
import log from '../lib/logger.js';
import { k8sConfigManager } from '../lib/k8s-config.js';
import { emitK8sEvent } from '../lib/socket.js';
import * as k8s from '@kubernetes/client-node';
import prisma from '../lib/prisma.js';

function emailToNamespace(email: string): string {
  return email.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').substring(0, 63).replace(/^-|-$/g, '');
}

async function getUserAccessInfo(userId: string): Promise<{ role: string; isSuperAdmin: boolean; namespace: string; workspaceIds: string[]; accessibleNamespaces: string[] }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { role: 'VIEWER', isSuperAdmin: false, namespace: 'default', workspaceIds: [], accessibleNamespaces: ['default'] };

  const userWorkspaceIds = await prisma.workspace.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
      ],
    },
    select: { id: true },
  });

  const workspaceIds = userWorkspaceIds.map((ws) => ws.id);

  if (user.role === 'ADMIN') {
    return { role: 'ADMIN', isSuperAdmin: true, namespace: 'all', workspaceIds, accessibleNamespaces: ['all'] };
  }

  const isOwner = await prisma.workspace.findFirst({
    where: { ownerId: userId },
  });

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
  });

  const role = isOwner ? 'OWNER' : (membership?.role || user.role);

  const personalNs = emailToNamespace(user.email);

  const managedNs = await prisma.managedNamespace.findMany({
    where: {
      project: { userId },
    },
    select: { name: true },
  });

  const accessibleNamespaces = [
    personalNs,
    ...managedNs.map(n => n.name),
    'default',
    'kube-system',
  ];

  return { role, isSuperAdmin: false, namespace: personalNs, workspaceIds, accessibleNamespaces };
}

function calculateAge(timestamp?: Date): string {
  if (!timestamp) return 'unknown';
  
  const now = new Date();
  const created = new Date(timestamp);
  const diffMs = now.getTime() - created.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 0) return `${diffDay}d`;
  if (diffHour > 0) return `${diffHour}h`;
  if (diffMin > 0) return `${diffMin}m`;
  return `${diffSec}s`;
}

function getNodeRoles(labels?: { [key: string]: string }): string {
  if (!labels) return 'worker';
  
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

export async function getK8sStatus(request: FastifyRequest, reply: FastifyReply) {
  try {
    const k8sConfig = await k8sConfigManager.loadConfig();
    if (!k8sConfig.connected) {
      reply.send({ 
        connected: false, 
        version: 'unknown', 
        provider: 'none',
        error: 'No Kubernetes cluster detected. Make sure you have k3s, minikube, kind, or docker-desktop running with a valid kubeconfig.'
      }); return;;
    }

    let version = 'unknown';
    try {
      const versionApi = k8sConfigManager.versionApi;
      const versionInfo = await versionApi.getCode();
      version = (versionInfo as any).gitVersion || 'unknown';
    } catch (e) {
      log.debug('Could not fetch version:', e);
    }

    reply.send({ 
      connected: true, 
      version, 
      provider: k8sConfig.provider,
      apiServer: k8sConfig.apiServer,
      namespace: k8sConfig.namespace
    });
  } catch (error: any) {
    log.error('K8s status error:', error);
    reply.status(500).send({ 
      connected: false,
      error: error.message || 'Failed to connect to Kubernetes cluster'
    });
  }
}

export async function getNamespaces(request: FastifyRequest, reply: FastifyReply) {
  try {
    const k8sConfig = await k8sConfigManager.loadConfig();
    if (!k8sConfig.connected) {
      reply.status(503).send({ error: 'Service Unavailable', message: 'Not connected to cluster' });
    }

    const accessInfo = await getUserAccessInfo((request as any).userId!);
    const coreApi = k8sConfigManager.coreApi;
    const response = await coreApi.listNamespace();
    
    let namespaces = response.body.items.map(ns => ({
      name: ns.metadata?.name || 'unknown',
      status: ns.status?.phase || 'Unknown',
      age: calculateAge(ns.metadata?.creationTimestamp),
      labels: ns.metadata?.labels || {},
    }));

    if (!accessInfo.isSuperAdmin && accessInfo.role !== 'ADMIN') {
      const allowedSet = new Set(accessInfo.accessibleNamespaces);
      namespaces = namespaces.filter(ns => allowedSet.has(ns.name));
    }

    reply.send(namespaces);
  } catch (error) {
    log.error('K8s namespaces error:', error);
    reply.status(500).send({ error: 'Internal Server Error' });
  }
}

export async function getPods(request: FastifyRequest, reply: FastifyReply) {
  try {
    const k8sConfig = await k8sConfigManager.loadConfig();
    if (!k8sConfig.connected) {
      reply.status(503).send({ error: 'Service Unavailable', message: 'Not connected to cluster' });
    }

    const accessInfo = await getUserAccessInfo((request as any).userId!);
    let namespace = (request.query as any).namespace || '';

    if (!namespace || namespace === 'all') {
      namespace = 'all';
    } else if (!accessInfo.isSuperAdmin && accessInfo.role !== 'ADMIN') {
      const allowedSet = new Set(accessInfo.accessibleNamespaces);
      if (!allowedSet.has(namespace)) {
        reply.status(403).send({ error: 'Forbidden', message: 'Access denied to this namespace' }); return;
      }
    }

    const coreApi = k8sConfigManager.coreApi;
    
    let pods = [];
    if (namespace !== 'all') {
      const response = await coreApi.listNamespacedPod(namespace);
      pods = response.body.items;
    } else {
      const response = await coreApi.listPodForAllNamespaces();
      pods = response.body.items;
    }

    if (!accessInfo.isSuperAdmin && accessInfo.role !== 'ADMIN' && namespace === 'all') {
      const allowedSet = new Set(accessInfo.accessibleNamespaces);
      pods = pods.filter(pod => allowedSet.has(pod.metadata?.namespace || ''));
    }

    const podList = pods.map(pod => ({
      name: pod.metadata?.name || 'unknown',
      namespace: pod.metadata?.namespace || 'default',
      status: pod.status?.phase || 'Unknown',
      ready: `${pod.status?.containerStatuses?.filter((c: any) => c.ready).length || 0}/${pod.status?.containerStatuses?.length || 0}`,
      restarts: pod.status?.containerStatuses?.reduce((sum: number, c: any) => sum + (c.restartCount || 0), 0) || 0,
      age: calculateAge(pod.metadata?.creationTimestamp),
      nodeName: pod.spec?.nodeName,
      ip: pod.status?.podIP,
    }));

    reply.send(podList);
  } catch (error) {
    log.error('K8s pods error:', error);
    reply.status(500).send({ error: 'Internal Server Error' });
  }
}

export async function getServices(request: FastifyRequest, reply: FastifyReply) {
  try {
    const k8sConfig = await k8sConfigManager.loadConfig();
    if (!k8sConfig.connected) {
      reply.status(503).send({ error: 'Service Unavailable', message: 'Not connected to cluster' });
    }

    const accessInfo = await getUserAccessInfo((request as any).userId!);
    let namespace = (request.query as any).namespace || '';

    if (!namespace || namespace === 'all') {
      namespace = 'all';
    } else if (!accessInfo.isSuperAdmin && accessInfo.role !== 'ADMIN') {
      const allowedSet = new Set(accessInfo.accessibleNamespaces);
      if (!allowedSet.has(namespace)) {
        reply.status(403).send({ error: 'Forbidden', message: 'Access denied to this namespace' }); return;
      }
    }

    const coreApi = k8sConfigManager.coreApi;
    
    let services = [];
    if (namespace !== 'all') {
      const response = await coreApi.listNamespacedService(namespace);
      services = response.body.items;
    } else {
      const response = await coreApi.listServiceForAllNamespaces();
      services = response.body.items;
    }

    if (!accessInfo.isSuperAdmin && accessInfo.role !== 'ADMIN' && namespace === 'all') {
      const allowedSet = new Set(accessInfo.accessibleNamespaces);
      services = services.filter(svc => allowedSet.has(svc.metadata?.namespace || ''));
    }

    const serviceList = services.map(svc => ({
      name: svc.metadata?.name || 'unknown',
      namespace: svc.metadata?.namespace || 'default',
      type: svc.spec?.type || 'ClusterIP',
      clusterIP: svc.spec?.clusterIP || 'None',
      externalIP: svc.spec?.externalIPs?.join(', ') || svc.spec?.externalName || 'None',
      ports: svc.spec?.ports?.map((p: any) => `${p.port}/${p.protocol}`) || [],
      selector: svc.spec?.selector || null,
    }));

    reply.send(serviceList);
  } catch (error) {
    log.error('K8s services error:', error);
    reply.status(500).send({ error: 'Internal Server Error' });
  }
}

export async function getNodes(request: FastifyRequest, reply: FastifyReply) {
  try {
    const k8sConfig = await k8sConfigManager.loadConfig();
    if (!k8sConfig.connected) {
      reply.status(503).send({ error: 'Service Unavailable', message: 'Not connected to cluster' });
    }

    const accessInfo = await getUserAccessInfo((request as any).userId!);
    
    if (!accessInfo.isSuperAdmin && accessInfo.role !== 'ADMIN') {
      reply.send([]); return;;
    }

    const coreApi = k8sConfigManager.coreApi;
    const response = await coreApi.listNode();
    const nodes = response.body.items;

    const nodeList = nodes.map(node => {
      const conditions = node.status?.conditions || [];
      const readyCondition = conditions.find((c: any) => c.type === 'Ready');
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
        internalIP: node.status?.addresses?.find((a: any) => a.type === 'InternalIP')?.address,
        externalIP: node.status?.addresses?.find((a: any) => a.type === 'ExternalIP')?.address,
      };
    });

    reply.send(nodeList);
  } catch (error) {
    log.error('K8s nodes error:', error);
    reply.status(500).send({ error: 'Internal Server Error' });
  }
}

export async function getDeployments(request: FastifyRequest, reply: FastifyReply) {
  try {
    const k8sConfig = await k8sConfigManager.loadConfig();
    if (!k8sConfig.connected) {
      reply.status(503).send({ error: 'Service Unavailable', message: 'Not connected to cluster' });
    }

    const accessInfo = await getUserAccessInfo((request as any).userId!);
    let namespace = (request.query as any).namespace || '';

    if (!namespace || namespace === 'all') {
      namespace = 'all';
    } else if (!accessInfo.isSuperAdmin && accessInfo.role !== 'ADMIN') {
      const allowedSet = new Set(accessInfo.accessibleNamespaces);
      if (!allowedSet.has(namespace)) {
        reply.status(403).send({ error: 'Forbidden', message: 'Access denied to this namespace' }); return;
      }
    }

    const appsApi = k8sConfigManager.appsApi;
    
    let deployments = [];
    if (namespace !== 'all') {
      const response = await appsApi.listNamespacedDeployment(namespace);
      deployments = response.body.items;
    } else {
      const response = await appsApi.listDeploymentForAllNamespaces();
      deployments = response.body.items;
    }

    if (!accessInfo.isSuperAdmin && accessInfo.role !== 'ADMIN' && namespace === 'all') {
      const allowedSet = new Set(accessInfo.accessibleNamespaces);
      deployments = deployments.filter(dep => allowedSet.has(dep.metadata?.namespace || ''));
    }

    const deploymentList = deployments.map(dep => ({
      name: dep.metadata?.name || 'unknown',
      namespace: dep.metadata?.namespace || 'default',
      replicas: dep.spec?.replicas || 0,
      readyReplicas: dep.status?.readyReplicas || 0,
      availableReplicas: dep.status?.availableReplicas || 0,
      age: calculateAge(dep.metadata?.creationTimestamp),
      images: dep.spec?.template?.spec?.containers?.map((c: any) => c.image) || [],
      selector: dep.spec?.selector?.matchLabels || null,
    }));

    reply.send(deploymentList);
  } catch (error) {
    log.error('K8s deployments error:', error);
    reply.status(500).send({ error: 'Internal Server Error' });
  }
}

export async function getIngresses(request: FastifyRequest, reply: FastifyReply) {
  try {
    const k8sConfig = await k8sConfigManager.loadConfig();
    if (!k8sConfig.connected) {
      reply.status(503).send({ error: 'Service Unavailable', message: 'Not connected to cluster' });
    }

    const accessInfo = await getUserAccessInfo((request as any).userId!);
    let namespace = (request.query as any).namespace || '';

    if (!namespace || namespace === 'all') {
      namespace = 'all';
    } else if (!accessInfo.isSuperAdmin && accessInfo.role !== 'ADMIN') {
      const allowedSet = new Set(accessInfo.accessibleNamespaces);
      if (!allowedSet.has(namespace)) {
        reply.status(403).send({ error: 'Forbidden', message: 'Access denied to this namespace' }); return;
      }
    }

    const networkingApi = k8sConfigManager.networkingApi;
    
    let ingresses = [];
    if (namespace !== 'all') {
      const response = await networkingApi.listNamespacedIngress(namespace);
      ingresses = response.body.items;
    } else {
      const response = await networkingApi.listIngressForAllNamespaces();
      ingresses = response.body.items;
    }

    if (!accessInfo.isSuperAdmin && accessInfo.role !== 'ADMIN' && namespace === 'all') {
      const allowedSet = new Set(accessInfo.accessibleNamespaces);
      ingresses = ingresses.filter(ing => allowedSet.has(ing.metadata?.namespace || ''));
    }

    const ingressList = ingresses.map(ing => ({
      name: ing.metadata?.name || 'unknown',
      namespace: ing.metadata?.namespace || 'default',
      hosts: ing.spec?.rules?.map((r: any) => r.host) || [],
      age: calculateAge(ing.metadata?.creationTimestamp),
      tls: ing.spec?.tls?.map((t: any) => t.hosts?.join(', ')) || [],
    }));

    reply.send(ingressList);
  } catch (error) {
    log.error('K8s ingresses error:', error);
    reply.status(500).send({ error: 'Internal Server Error' });
  }
}

export async function createNamespace(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { name } = request.body as any;
    if (!name) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Namespace name required' });
    }

    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name) || name.length > 63) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Invalid namespace name. Must be lowercase alphanumeric, max 63 chars.' });
    }

    const accessInfo = await getUserAccessInfo((request as any).userId!);
    if (!accessInfo.isSuperAdmin && accessInfo.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only admins can create namespaces' });
    }

    const k8sConfig = await k8sConfigManager.loadConfig();
    if (!k8sConfig.connected) {
      return reply.status(503).send({ error: 'Service Unavailable', message: 'Kubernetes not connected' });
    }

    const coreApi = k8sConfigManager.coreApi;
    const result = await coreApi.createNamespace({
      metadata: { name },
    });
    
    const namespace = {
      name: result.body.metadata?.name || name,
      status: result.body.status?.phase || 'Active',
      age: '0s',
    };
    
    log.info(`Namespace created: ${name}`);
    emitK8sEvent('k8s:namespace:created', namespace);
    reply.send({ message: 'Namespace created', name });
  } catch (error) {
    log.error('K8s create namespace error:', error);
    reply.status(500).send({ error: 'Internal Server Error' });
  }
}

export async function createDeployment(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { name, image, namespace, replicas, port } = request.body as any;
    if (!name || !image) {
      reply.status(400).send({ error: 'Bad Request', message: 'name and image required' });
    }

    const accessInfo = await getUserAccessInfo((request as any).userId!);
    const targetNamespace = namespace || accessInfo.namespace;

    if (!accessInfo.isSuperAdmin && accessInfo.role !== 'ADMIN') {
      const allowedSet = new Set(accessInfo.accessibleNamespaces);
      if (!allowedSet.has(targetNamespace)) {
        reply.status(403).send({ error: 'Forbidden', message: 'Access denied to this namespace' }); return;
      }
    }

    const k8sConfig = await k8sConfigManager.loadConfig();
    if (!k8sConfig.connected) reply.status(503).send({ error: 'Service Unavailable' });

    const appsApi = k8sConfigManager.appsApi;
    
    const userId = (request as any).userId!;
    const deployment = {
      metadata: { name, labels: { 'user-id': userId } },
      spec: {
        replicas: replicas || 1,
        selector: { matchLabels: { app: name } },
        template: {
          metadata: { labels: { app: name, 'user-id': userId } },
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

    await appsApi.createNamespacedDeployment(targetNamespace, deployment);
    
    const deploymentData = {
      name,
      namespace: targetNamespace,
      replicas: replicas || 1,
      readyReplicas: 0,
      availableReplicas: 0,
      age: '0s',
      images: [image],
    };
    
    log.info(`Deployment created: ${name} in ${targetNamespace}`);
    emitK8sEvent('k8s:deployment:created', deploymentData, targetNamespace);
    reply.send({ message: 'Deployment created', name, namespace: targetNamespace });
  } catch (error) {
    log.error('K8s create deployment error:', error);
    reply.status(500).send({ error: 'Internal Server Error' });
  }
}

export async function createService(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { name, namespace, servicePort, targetPort, type } = request.body as any;
    if (!name || !servicePort) {
      reply.status(400).send({ error: 'Bad Request', message: 'name and servicePort required' });
    }

    const accessInfo = await getUserAccessInfo((request as any).userId!);
    const targetNamespace = namespace || accessInfo.namespace;

    const k8sConfig = await k8sConfigManager.loadConfig();
    if (!k8sConfig.connected) reply.status(503).send({ error: 'Service Unavailable' });

    const coreApi = k8sConfigManager.coreApi;

    const userId = (request as any).userId!;
    const service = {
      metadata: { name, labels: { 'user-id': userId } },
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

    await coreApi.createNamespacedService(targetNamespace, service);
    
    const serviceData = {
      name,
      namespace: targetNamespace,
      type: type || 'ClusterIP',
      clusterIP: 'None',
      externalIP: 'None',
      ports: [`${servicePort}/TCP`],
      selector: { app: name },
    };
    
    log.info(`Service created: ${name} in ${targetNamespace}`);
    emitK8sEvent('k8s:service:created', serviceData, targetNamespace);
    reply.send({ message: 'Service created', name, namespace: targetNamespace });
  } catch (error) {
    log.error('K8s create service error:', error);
    reply.status(500).send({ error: 'Internal Server Error' });
  }
}

export async function deleteResource(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { type, name, namespace } = request.query as any;
    if (!type || !name || !namespace) {
      reply.status(400).send({ error: 'Bad Request', message: 'type, name, and namespace required' });
    }

    const accessInfo = await getUserAccessInfo((request as any).userId!);
    const targetNamespace = namespace as string;

    if (!accessInfo.isSuperAdmin && accessInfo.role !== 'ADMIN') {
      if (targetNamespace !== accessInfo.namespace) {
        reply.status(403).send({ error: 'Forbidden', message: 'You can only delete resources in your namespace' });
      }
    }

    const k8sConfig = await k8sConfigManager.loadConfig();
    if (!k8sConfig.connected) reply.status(503).send({ error: 'Service Unavailable' });

    const resourceName = name as string;
    const resourceType = type as string;

    switch (resourceType) {
      case 'namespace': {
        if (!accessInfo.isSuperAdmin && accessInfo.role !== 'ADMIN') {
          reply.status(403).send({ error: 'Forbidden', message: 'Only admins can delete namespaces' });
        }
        const coreApi = k8sConfigManager.coreApi;
        await coreApi.deleteNamespace(resourceName);
        emitK8sEvent('k8s:namespace:deleted', { name: resourceName });
        break;
      }
      case 'deployment': {
        const appsApi = k8sConfigManager.appsApi;
        await appsApi.deleteNamespacedDeployment(resourceName, targetNamespace);
        emitK8sEvent('k8s:deployment:deleted', { name: resourceName, namespace: targetNamespace }, targetNamespace);
        break;
      }
      case 'service': {
        const coreApi = k8sConfigManager.coreApi;
        await coreApi.deleteNamespacedService(resourceName, targetNamespace);
        emitK8sEvent('k8s:service:deleted', { name: resourceName, namespace: targetNamespace }, targetNamespace);
        break;
      }
      case 'pod': {
        const coreApi = k8sConfigManager.coreApi;
        await coreApi.deleteNamespacedPod(resourceName, targetNamespace);
        emitK8sEvent('k8s:pod:deleted', { name: resourceName, namespace: targetNamespace }, targetNamespace);
        break;
      }
      default:
        reply.status(400).send({ error: 'Bad Request', message: 'Unknown resource type' });
    }

    log.info(`${resourceType} deleted: ${resourceName} from ${targetNamespace}`);
    reply.send({ message: `${resourceType} deleted`, name: resourceName, namespace: targetNamespace });
  } catch (error) {
    log.error('K8s delete resource error:', error);
    reply.status(500).send({ error: 'Internal Server Error' });
  }
}

export async function getTraefikStatus(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { traefikManager } = await import('../lib/k8s-traefik.js');
    const [dashboardUrl] = await Promise.all([traefikManager.getDashboardUrl()]);
    let installed = false;
    try {
      const { k8sConfigManager } = await import('../lib/k8s-config.js');
      await k8sConfigManager.coreApi.readNamespacedService('traefik', 'traefik-system');
      installed = true;
    } catch (error) { log.warn(`[kubernetes.controller] Traefik service check failed: ${(error as Error).message}`); }
    reply.send({ installed, dashboardUrl });
  } catch (error: any) {
    reply.send({ installed: false, dashboardUrl: null, error: error.message });
  }
}
