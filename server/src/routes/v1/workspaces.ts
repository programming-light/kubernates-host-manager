import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { workspaces as schemas } from '../../schemas/index.js';
import { 
  getWorkspaces, 
  createWorkspace, 
  getWorkspaceById, 
  updateWorkspace, 
  deleteWorkspace,
  getWorkspaceMembers,
  addWorkspaceMember,
  updateMemberRole,
  removeMember,
  transferOwnership,
  getWorkspaceEnv,
  setWorkspaceEnv,
  deleteWorkspaceEnv
} from '../../controllers/workspaces.controller.js';

export default async function(router: FastifyInstance) {
  router.get('/', { preHandler: [authMiddleware], schema: schemas.list }, getWorkspaces);
  router.post('/', { preHandler: [authMiddleware], schema: schemas.create }, createWorkspace);
  router.get('/:id', { preHandler: [authMiddleware], schema: schemas.getById }, getWorkspaceById);
  router.put('/:id', { preHandler: [authMiddleware], schema: schemas.update }, updateWorkspace);
  router.delete('/:id', { preHandler: [authMiddleware], schema: schemas.remove }, deleteWorkspace);

  router.get('/:id/members', { preHandler: [authMiddleware], schema: schemas.getMembers }, getWorkspaceMembers);
  router.post('/:id/members', { preHandler: [authMiddleware], schema: schemas.addMember }, addWorkspaceMember);
  router.put('/:id/members/:memberId', { preHandler: [authMiddleware], schema: schemas.updateMember }, updateMemberRole);
  router.delete('/:id/members/:memberId', { preHandler: [authMiddleware], schema: schemas.removeMember }, removeMember);
  router.post('/:id/transfer-ownership', { preHandler: [authMiddleware] }, transferOwnership);

  router.get('/:id/env', { preHandler: [authMiddleware] }, getWorkspaceEnv);
  router.post('/:id/env', { preHandler: [authMiddleware] }, setWorkspaceEnv);
  router.delete('/:id/env/:key', { preHandler: [authMiddleware] }, deleteWorkspaceEnv);
}
