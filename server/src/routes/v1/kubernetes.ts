import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { kubernetes as schemas } from '../../schemas/index.js';
import { 
  getK8sStatus,
  getNamespaces,
  getPods,
  getServices,
  getNodes,
  getDeployments,
  getIngresses,
  createNamespace,
  createDeployment,
  createService,
  deleteResource,
  getTraefikStatus,
} from '../../controllers/kubernetes.controller.js';

export default async function(router: FastifyInstance) {
  router.get('/status', { schema: { tags: ['Kubernetes'], description: 'Get K8s connection status' } }, getK8sStatus);
  router.get('/namespaces', { preHandler: [authMiddleware], schema: schemas.getNamespaces }, getNamespaces);
  router.get('/pods', { preHandler: [authMiddleware], schema: schemas.getPods }, getPods);
  router.get('/services', { preHandler: [authMiddleware], schema: schemas.getServices }, getServices);
  router.get('/nodes', { preHandler: [authMiddleware], schema: schemas.getNodes }, getNodes);
  router.get('/deployments', { preHandler: [authMiddleware], schema: schemas.getDeployments }, getDeployments);
  router.get('/ingresses', { preHandler: [authMiddleware] }, getIngresses);
  router.get('/traefik', { preHandler: [authMiddleware] }, getTraefikStatus);
  router.post('/create-namespace', { preHandler: [authMiddleware] }, createNamespace);
  router.post('/create-deployment', { preHandler: [authMiddleware] }, createDeployment);
  router.post('/create-service', { preHandler: [authMiddleware] }, createService);
  router.delete('/delete-resource', { preHandler: [authMiddleware] }, deleteResource);
}
