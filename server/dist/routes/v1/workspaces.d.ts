/**
 * @swagger
 * tags:
 *   - name: Workspaces
 *     description: Workspace management endpoints
 */
declare const router: import("express-serve-static-core").Router;
interface Workspace {
    id: string;
    name: string;
    slug: string;
    ownerId: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}
declare const workspaces: Map<string, Workspace>;
export default router;
export { workspaces };
