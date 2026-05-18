import { authMiddleware } from '../../middleware/auth.js';
import { clusters as schemas } from '../../schemas/index.js';
import { getClusters, createCluster, getClusterById, deleteCluster, getClusterResources } from '../../controllers/clusters.controller.js';
export default async function (router) {
    router.get('/', { preHandler: [authMiddleware], schema: schemas.list }, getClusters);
    router.post('/', { preHandler: [authMiddleware], schema: schemas.create }, createCluster);
    router.get('/:id', { preHandler: [authMiddleware], schema: schemas.getById }, getClusterById);
    router.delete('/:id', { preHandler: [authMiddleware], schema: schemas.remove }, deleteCluster);
    router.get('/:id/resources', { preHandler: [authMiddleware] }, getClusterResources);
}
