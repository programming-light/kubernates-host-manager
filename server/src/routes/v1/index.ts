import { FastifyInstance } from 'fastify';
import authRoutes from './auth.js';
import userRoutes from './users.js';
import workspaceRoutes from './workspaces.js';
import clusterRoutes from './clusters.js';
import projectRoutes from './projects.js';
import deploymentRoutes from './deployments.js';
import kubernetesRoutes from './kubernetes.js';
import cicdRoutes from './cicd.js';
import containerRoutes from './container.js';
import planRoutes from './plans.js';
import paymentRoutes from './payments.js';
import githubRoutes from './github.js';
import sourcesRoutes from './sources.js';
import databaseRoutes from './databases.js';
import pipelineRoutes from './pipeline.js';

export default async function(router: FastifyInstance) {
  await router.register(authRoutes, { prefix: '/auth' });
  await router.register(userRoutes, { prefix: '/auth' });
  await router.register(workspaceRoutes, { prefix: '/workspaces' });
  await router.register(clusterRoutes, { prefix: '/clusters' });
  await router.register(projectRoutes, { prefix: '/projects' });
  await router.register(deploymentRoutes, { prefix: '/deployments' });
  await router.register(kubernetesRoutes, { prefix: '/kubernetes' });
  await router.register(cicdRoutes, { prefix: '/cicd' });
  await router.register(containerRoutes, { prefix: '/container' });
  await router.register(planRoutes, { prefix: '/plans' });
  await router.register(paymentRoutes, { prefix: '/payments' });
  await router.register(githubRoutes, { prefix: '/github' });
  await router.register(sourcesRoutes, { prefix: '/sources' });
  await router.register(databaseRoutes, { prefix: '/databases' });
  await router.register(pipelineRoutes, { prefix: '/pipeline' });
}
