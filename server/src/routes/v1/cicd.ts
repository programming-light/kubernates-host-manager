import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { cicd as schemas } from '../../schemas/index.js';
import { getPipelines, triggerPipeline, deletePipeline } from '../../controllers/cicd.controller.js';
import { handleWebhook } from '../../controllers/cicd.controller.js';

export default async function(router: FastifyInstance) {
  router.get('/:projectId/pipelines', { preHandler: [authMiddleware], schema: schemas.listPipelines }, getPipelines);
  router.post('/:projectId/trigger', { preHandler: [authMiddleware], schema: schemas.triggerPipeline }, triggerPipeline);
  router.delete('/:pipelineId', { preHandler: [authMiddleware], schema: schemas.cancelPipeline }, deletePipeline);
  router.post('/:projectId/webhook', handleWebhook);
}
