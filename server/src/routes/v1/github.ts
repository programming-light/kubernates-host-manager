import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import {
  githubLogin,
  githubCallback,
  getRepos,
  disconnectGitHub,
  setupWebhook,
  webhookHandler,
  githubAppInstall,
  githubAppCallback,
  getGitHubInstallations,
} from '../../controllers/github.controller.js';

export default async function(router: FastifyInstance) {
  router.get('/login', { preHandler: [authMiddleware] }, githubLogin);
  router.get('/callback', githubCallback);
  router.get('/repos', { preHandler: [authMiddleware] }, getRepos);
  router.get('/install', { preHandler: [authMiddleware] }, githubAppInstall);
  router.get('/install/callback', githubAppCallback);
  router.get('/installations', { preHandler: [authMiddleware] }, getGitHubInstallations);
  router.delete('/disconnect', { preHandler: [authMiddleware] }, disconnectGitHub);
  router.get('/webhook', async (request, reply) => reply.send({ ok: true, message: 'Webhook endpoint ready. GitHub sends POST here on push events.' }));
  router.post('/webhook', webhookHandler);
  router.post('/setup-webhook', { preHandler: [authMiddleware] }, setupWebhook);
}
