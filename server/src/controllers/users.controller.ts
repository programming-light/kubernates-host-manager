import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import { UserRole, UserStatus } from '../constants/roles.js';

export async function getCurrentUser(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const isDev = process.env.NODE_ENV === 'development';

    let user;
    try {
      user = await prisma.user.findUnique({ 
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
          githubToken: true,
          githubUsername: true,
          createdAt: true,
          updatedAt: true,
        }
      });
    } catch (dbError) {
      if (isDev) {
        return reply.send({
          id: userId,
          email: request.email || 'dev@localhost',
          name: 'Dev User',
          role: 'DEVELOPER',
          status: 'ACTIVE',
          company: null,
          phone: null,
          avatar: null,
          githubToken: null,
          githubUsername: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      throw dbError;
    }

    if (!user) {
      if (isDev && userId.startsWith('dev-')) {
        return reply.send({
          id: userId,
          email: request.email || 'dev@localhost',
          name: 'Dev User',
          role: 'DEVELOPER',
          status: 'ACTIVE',
          company: null,
          phone: null,
          avatar: null,
          githubToken: null,
          githubUsername: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      return reply.status(404).send({ error: 'Not Found', message: 'User not found' });
    }

    reply.send(user);
  } catch (error) {
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to get user' });
  }
}

export async function updateCurrentUser(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const { name, company, phone, avatar } = request.body as any;

    const user = await prisma.user.update({
      where: { id: userId },
      data: { 
        ...(name && { name }),
        ...(company !== undefined && { company }),
        ...(phone !== undefined && { phone }),
        ...(avatar !== undefined && { avatar }),
      },
    });

    reply.send({
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
  } catch (error) {
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to update user' });
  }
}

export async function getUsers(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { page = 1, limit = 20, role, status, search } = request.query as any;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    
    if (role) where.role = role;
    if (status) where.status = status;
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

    reply.send({
      data: users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to get users' });
  }
}

export async function getUserById(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const userRole = (request as any).userRole!;
    const targetId = (request.params as any).id;
    
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
      return reply.status(404).send({ error: 'Not Found', message: 'User not found' });
    }

    if (userRole !== UserRole.ADMIN && user.id !== userId) {
      reply.status(403).send({ error: 'Forbidden', message: 'Cannot view other user details' });
    }

    reply.send(user);
  } catch (error) {
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to get user' });
  }
}

export async function updateUserRole(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { role } = request.body as any;
    const { id } = request.params as any;

    if (!Object.values(UserRole).includes(role)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Invalid role' });
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

    reply.send({ message: 'User role updated', user });
  } catch (error) {
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to update user role' });
  }
}

export async function updateUserStatus(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { status } = request.body as any;
    const { id } = request.params as any;

    if (!Object.values(UserStatus).includes(status)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Invalid status' });
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

    reply.send({ message: 'User status updated', user });
  } catch (error) {
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to update user status' });
  }
}

export async function deleteUser(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const { id } = request.params as any;

    if (id === userId) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Cannot delete yourself' });
    }

    await prisma.user.delete({ where: { id } });

    reply.send({ message: 'User deleted successfully' });
  } catch (error) {
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to delete user' });
  }
}
