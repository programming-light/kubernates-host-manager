/**
 * @swagger
 * tags:
 *   - name: Users
 *     description: User management endpoints
 */
import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../../middleware/auth.js';
import prisma from '../../lib/prisma.js';
import { UserRole, UserStatus } from '../../constants/roles.js';
const router = Router();
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                status: true,
                company: true,
                phone: true,
                avatar: true,
                createdAt: true,
                updatedAt: true,
            }
        });
        if (!user) {
            return res.status(404).json({ error: 'Not Found', message: 'User not found' });
        }
        res.json(user);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get user' });
    }
});
router.put('/me', authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        const { name, company, phone, avatar } = req.body;
        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                ...(name && { name }),
                ...(company !== undefined && { company }),
                ...(phone !== undefined && { phone }),
                ...(avatar !== undefined && { avatar }),
            },
        });
        res.json({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            status: user.status,
            company: user.company,
            phone: user.phone,
            avatar: user.avatar,
            updatedAt: user.updatedAt,
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update user' });
    }
});
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { page = 1, limit = 20, role, status, search } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const where = {};
        if (role)
            where.role = role;
        if (status)
            where.status = status;
        if (search) {
            where.OR = [
                { name: { contains: String(search), mode: 'insensitive' } },
                { email: { contains: String(search), mode: 'insensitive' } },
            ];
        }
        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    status: true,
                    company: true,
                    createdAt: true,
                    updatedAt: true,
                },
            }),
            prisma.user.count({ where }),
        ]);
        res.json({
            data: users,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get users' });
    }
});
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        const userRole = req.userRole;
        const targetId = req.params.id;
        const user = await prisma.user.findUnique({
            where: { id: targetId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                status: true,
                company: true,
                phone: true,
                avatar: true,
                createdAt: true,
                updatedAt: true,
            }
        });
        if (!user) {
            return res.status(404).json({ error: 'Not Found', message: 'User not found' });
        }
        if (userRole !== UserRole.ADMIN && user.id !== userId) {
            return res.status(403).json({ error: 'Forbidden', message: 'Cannot view other user details' });
        }
        res.json(user);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get user' });
    }
});
router.put('/:id/role', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { role } = req.body;
        const { id } = req.params;
        if (!Object.values(UserRole).includes(role)) {
            return res.status(400).json({ error: 'Bad Request', message: 'Invalid role' });
        }
        const user = await prisma.user.update({
            where: { id },
            data: { role },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                status: true,
            }
        });
        res.json({ message: 'User role updated', user });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update user role' });
    }
});
router.put('/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { status } = req.body;
        const { id } = req.params;
        if (!Object.values(UserStatus).includes(status)) {
            return res.status(400).json({ error: 'Bad Request', message: 'Invalid status' });
        }
        const user = await prisma.user.update({
            where: { id },
            data: { status },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                status: true,
            }
        });
        res.json({ message: 'User status updated', user });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update user status' });
    }
});
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        if (id === userId) {
            return res.status(400).json({ error: 'Bad Request', message: 'Cannot delete yourself' });
        }
        await prisma.user.delete({ where: { id } });
        res.json({ message: 'User deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete user' });
    }
});
export default router;
