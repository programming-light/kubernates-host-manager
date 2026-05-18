import { FastifyInstance } from 'fastify';
import { authMiddleware, adminMiddleware } from '../../middleware/auth.js';
import { users as schemas } from '../../schemas/index.js';
import { 
  getCurrentUser, 
  updateCurrentUser, 
  getUsers, 
  getUserById, 
  updateUserRole, 
  updateUserStatus, 
  deleteUser 
} from '../../controllers/users.controller.js';

export default async function(router: FastifyInstance) {
  router.get('/me', { preHandler: [authMiddleware], schema: schemas.getMe }, getCurrentUser);
  router.put('/me', { preHandler: [authMiddleware], schema: schemas.updateMe }, updateCurrentUser);
  router.get('/', { preHandler: [authMiddleware, adminMiddleware], schema: schemas.list }, getUsers);
  router.get('/:id', { preHandler: [authMiddleware], schema: schemas.getById }, getUserById);
  router.put('/:id/role', { preHandler: [authMiddleware, adminMiddleware], schema: schemas.updateRole }, updateUserRole);
  router.put('/:id/status', { preHandler: [authMiddleware, adminMiddleware], schema: schemas.updateStatus }, updateUserStatus);
  router.delete('/:id', { preHandler: [authMiddleware, adminMiddleware], schema: schemas.remove }, deleteUser);
}
