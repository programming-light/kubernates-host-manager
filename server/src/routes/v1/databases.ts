import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import {
  listDatabases,
  getDatabase,
  createDatabase,
  updateDatabase,
  deleteDatabase,
  getDatabaseCredentials,
  createDatabaseUser,
  listDatabaseUsers,
  deleteDatabaseUser,
  addIpWhitelist,
  removeIpWhitelist,
  listIpWhitelist,
  executeQuery,
  runMigration,
} from '../../controllers/databases.controller.js';

export default async function (router: FastifyInstance) {
  router.get('/', { preHandler: [authMiddleware] }, listDatabases);
  router.get('/:id', { preHandler: [authMiddleware] }, getDatabase);
  router.post('/', { preHandler: [authMiddleware] }, createDatabase);
  router.put('/:id', { preHandler: [authMiddleware] }, updateDatabase);
  router.delete('/:id', { preHandler: [authMiddleware] }, deleteDatabase);

  router.get('/:id/credentials', { preHandler: [authMiddleware] }, getDatabaseCredentials);
  router.post('/:id/query', { preHandler: [authMiddleware] }, executeQuery);
  router.post('/:id/migrate', { preHandler: [authMiddleware] }, runMigration);

  router.post('/:id/users', { preHandler: [authMiddleware] }, createDatabaseUser);
  router.get('/:id/users', { preHandler: [authMiddleware] }, listDatabaseUsers);
  router.delete('/:id/users/:userId', { preHandler: [authMiddleware] }, deleteDatabaseUser);

  router.post('/:id/ip-whitelist', { preHandler: [authMiddleware] }, addIpWhitelist);
  router.get('/:id/ip-whitelist', { preHandler: [authMiddleware] }, listIpWhitelist);
  router.delete('/:id/ip-whitelist/:whitelistId', { preHandler: [authMiddleware] }, removeIpWhitelist);
}
