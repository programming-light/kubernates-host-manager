import { authMiddleware } from '../../middleware/auth.js';
import { projects as schemas } from '../../schemas/index.js';
import { getProjects, createProject, getProjectById, updateProject, deleteProject, getProjectEnv, setProjectEnv, updateProjectEnv, deleteProjectEnv } from '../../controllers/projects.controller.js';
export default async function (router) {
    router.get('/', { preHandler: [authMiddleware], schema: schemas.list }, getProjects);
    router.post('/', { preHandler: [authMiddleware], schema: schemas.create }, createProject);
    router.get('/:id', { preHandler: [authMiddleware], schema: schemas.getById }, getProjectById);
    router.put('/:id', { preHandler: [authMiddleware], schema: schemas.update }, updateProject);
    router.delete('/:id', { preHandler: [authMiddleware], schema: schemas.remove }, deleteProject);
    router.get('/:projectId/env', { preHandler: [authMiddleware] }, getProjectEnv);
    router.post('/:projectId/env', { preHandler: [authMiddleware] }, setProjectEnv);
    router.put('/:projectId/env/:key', { preHandler: [authMiddleware] }, updateProjectEnv);
    router.delete('/:projectId/env/:key', { preHandler: [authMiddleware] }, deleteProjectEnv);
}
