import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import {
  detectBuildConfig,
  detectRepo,
  buildProject,
  deployProject,
  runProject,
  getPipelineStatus,
  cancelRunPod,
} from '../../controllers/pipeline.controller.js';

export default async function(router: FastifyInstance) {
  router.post('/detect', { preHandler: [authMiddleware] }, detectRepo);
  router.post('/:projectId/detect', { preHandler: [authMiddleware] }, detectBuildConfig);
  router.post('/:projectId/build', { preHandler: [authMiddleware] }, buildProject);
  router.post('/:projectId/deploy', { preHandler: [authMiddleware] }, deployProject);
  router.post('/:projectId/run', { preHandler: [authMiddleware] }, runProject);
  router.get('/:projectId/status', { preHandler: [authMiddleware] }, getPipelineStatus);
  router.post('/:projectId/cancel-run', { preHandler: [authMiddleware] }, cancelRunPod);
}
