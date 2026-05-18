import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import {
  getSourcesStatus,
  disconnectSource,
  gitlabLogin,
  gitlabCallback,
  getGitlabRepos,
  giteaLogin,
  giteaCallback,
  getGiteaRepos,
  setupGitea,
  searchDockerHub,
  getDockerHubTags,
} from '../../controllers/sources.controller.js';

export default async function(router: FastifyInstance) {
  router.get('/status', { preHandler: [authMiddleware] }, getSourcesStatus);
  router.delete('/:provider', { preHandler: [authMiddleware] }, disconnectSource);

  router.get('/gitlab/login', { preHandler: [authMiddleware] }, gitlabLogin);
  router.get('/gitlab/callback', gitlabCallback);
  router.get('/gitlab/repos', { preHandler: [authMiddleware] }, getGitlabRepos);

  router.get('/gitea/login', { preHandler: [authMiddleware] }, giteaLogin);
  router.get('/gitea/callback', giteaCallback);
  router.get('/gitea/repos', { preHandler: [authMiddleware] }, getGiteaRepos);
  router.post('/gitea/setup', { preHandler: [authMiddleware] }, setupGitea);

  router.get('/dockerhub/search', { preHandler: [authMiddleware] }, searchDockerHub);
  router.get('/dockerhub/tags', { preHandler: [authMiddleware] }, getDockerHubTags);
}
