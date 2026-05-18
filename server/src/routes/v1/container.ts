import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { container as schemas } from '../../schemas/index.js';
import {
  buildAndDeploy,
  deployFromImage,
  scaleDeployment,
  updateResources,
  enableAutoScaling,
  disableAutoScaling,
  getHPAStatus,
  getDeploymentResources,
  getBuildLogs,
  detectLanguage,
  execCommand,
  getPods,
  suggestDomain,
  addCustomDomain,
  getProjectDomains,
  removeDomain,
  getBuildQueueStats,
} from '../../controllers/container.controller.js';
import {
  listFiles,
  readFile,
  writeFile,
  deleteFile,
  createDirectory,
  uploadFile,
  getFileInfo,
} from '../../controllers/files.controller.js';
import {
  previewProxy,
  getPreviewUrl,
} from '../../controllers/preview.controller.js';

export default async function(router: FastifyInstance) {
  router.post('/build-deploy', { preHandler: [authMiddleware], schema: schemas.buildDeploy }, buildAndDeploy);
  router.post('/deploy-image', { preHandler: [authMiddleware], schema: schemas.deployImage }, deployFromImage);
  router.post('/detect-language', { preHandler: [authMiddleware], schema: schemas.detectLanguage }, detectLanguage);
  router.put('/:projectId/scale', { preHandler: [authMiddleware], schema: schemas.scale }, scaleDeployment);
  router.put('/:projectId/resources', { preHandler: [authMiddleware], schema: schemas.updateResources }, updateResources);
  router.post('/:projectId/autoscale', { preHandler: [authMiddleware], schema: schemas.enableAutoScaling }, enableAutoScaling);
  router.delete('/:projectId/autoscale', { preHandler: [authMiddleware], schema: schemas.disableAutoScaling }, disableAutoScaling);
  router.get('/:projectId/autoscale', { preHandler: [authMiddleware], schema: schemas.getHPAStatus }, getHPAStatus);
  router.get('/:projectId/deployment', { preHandler: [authMiddleware], schema: schemas.getDeploymentResources }, getDeploymentResources);
  router.get('/:projectId/build-logs', { preHandler: [authMiddleware], schema: schemas.getBuildLogs }, getBuildLogs);
  router.post('/:projectId/exec', { preHandler: [authMiddleware], schema: schemas.execCommand }, execCommand);
  router.get('/:projectId/pods', { preHandler: [authMiddleware], schema: schemas.getPods }, getPods);
  router.get('/:projectId/domain/suggest', { preHandler: [authMiddleware], schema: schemas.suggestDomain }, suggestDomain);
  router.post('/:projectId/domain', { preHandler: [authMiddleware], schema: schemas.addCustomDomain }, addCustomDomain);
  router.get('/:projectId/domains', { preHandler: [authMiddleware], schema: schemas.getProjectDomains }, getProjectDomains);
  router.delete('/:projectId/domains/:domainId', { preHandler: [authMiddleware], schema: schemas.removeDomain }, removeDomain);

  router.get('/:projectId/files', { preHandler: [authMiddleware] }, listFiles);
  router.get('/:projectId/files/read', { preHandler: [authMiddleware] }, readFile);
  router.post('/:projectId/files/write', { preHandler: [authMiddleware] }, writeFile);
  router.post('/:projectId/files/delete', { preHandler: [authMiddleware] }, deleteFile);
  router.post('/:projectId/files/mkdir', { preHandler: [authMiddleware] }, createDirectory);
  router.post('/:projectId/files/upload', { preHandler: [authMiddleware] }, uploadFile);
  router.get('/:projectId/files/info', { preHandler: [authMiddleware] }, getFileInfo);

  router.get('/queue/stats', { preHandler: [authMiddleware] }, getBuildQueueStats);

  router.get('/:projectId/preview-url', { preHandler: [authMiddleware] }, getPreviewUrl);
  router.all('/proxy/:projectId/*', { preHandler: [authMiddleware] }, previewProxy);
  router.all('/proxy/:projectId', { preHandler: [authMiddleware] }, previewProxy);
}
