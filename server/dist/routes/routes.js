import { Router } from 'express';
import v1Routes from './v1/index.js';
const router = Router();
router.use('/v1', v1Routes);
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});
export default router;
