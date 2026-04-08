/**
 * @swagger
 * tags:
 *   - name: Deployments
 *     description: Deployment management
 */
declare const router: import("express-serve-static-core").Router;
interface Deployment {
    id: string;
    projectId: string;
    version: number;
    status: string;
    imageUrl: string;
    commitSha?: string;
    replicas: number;
    deployedBy?: string;
    startedAt: Date;
    completedAt?: Date;
    logs: string[];
}
declare const deployments: Map<string, Deployment>;
export default router;
export { deployments };
