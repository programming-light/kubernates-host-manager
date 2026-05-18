import v1Routes from './v1/index.js';
export default async function (router) {
    await router.register(v1Routes, { prefix: '/v1' });
    router.get('/health', async () => {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        };
    });
}
