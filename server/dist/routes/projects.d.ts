/**
 * @swagger
 * tags:
 *   - name: Projects
 *     description: Project management
 */
declare const router: import("express-serve-static-core").Router;
interface Project {
    id: string;
    workspaceId: string;
    clusterId: string;
    name: string;
    slug: string;
    description?: string;
    gitUrl?: string;
    status: string;
    namespace: string;
    replicas: number;
    createdAt: Date;
    updatedAt: Date;
}
declare const projects: Map<string, Project>;
export default router;
export { projects };
