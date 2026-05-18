import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import log from '../lib/logger.js';
import { UserRole } from '../constants/roles.js';
import { k8sDeployManager } from '../lib/k8s-deploy.js';

interface EnvVar {
  key: string;
  value: string;
  isSecret?: boolean;
}

interface EnvFile {
  [key: string]: EnvVar;
}

function parseEnvContent(content: string): EnvVar[] {
  const lines = content.split('\n');
  const vars: EnvVar[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      let key = match[1].trim();
      let value = match[2].trim();

      key = key.replace(/^export\s+/, '');

      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (key) {
        vars.push({ key, value });
      }
    }
  }

  return vars;
}

async function getWorkspaceForEnv(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });

  if (!workspace) return { error: 'Workspace not found', status: 404 };

  if (workspace.ownerId !== userId) {
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });
    if (!membership || (membership.role !== 'ADMIN' && membership.role !== 'MANAGER')) {
      return { error: 'Access denied', status: 403 };
    }
  }

  return { workspace };
}

export async function getWorkspaces(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;

    const ownedWorkspaces = await prisma.workspace.findMany({
      where: { ownerId: userId },
      include: { _count: { select: { projects: true, members: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const memberWorkspaces = await prisma.workspaceMember.findMany({
      where: { userId },
      include: { workspace: { include: { _count: { select: { projects: true, members: true } } } } },
    });

    const allWorkspaces = [
      ...ownedWorkspaces.map((ws) => ({
        ...ws,
        memberRole: 'OWNER' as const,
      })),
      ...memberWorkspaces.map((m) => ({
        ...m.workspace,
        memberRole: m.role,
      })),
    ];

    reply.send(allWorkspaces);
  } catch (error) {
    log.error('Failed to list workspaces:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to fetch workspaces' });
  }
}

export async function createWorkspace(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { name, slug, description } = request.body as any;
    const userId = (request as any).userId!;

    if (!name || !slug) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Name and slug are required' });
    }

    const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    if (!slugRegex.test(slug)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Invalid slug format. Use lowercase letters, numbers, and hyphens only' });
    }

    const existing = await prisma.workspace.findUnique({ where: { slug } });
    if (existing) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Workspace slug already exists' });
    }

    const workspace = await prisma.workspace.create({
      data: {
        name,
        slug,
        description: description || null,
        ownerId: userId,
      },
      include: { _count: { select: { projects: true, members: true } } },
    });

    reply.status(201).send({ ...workspace, memberRole: 'OWNER' });
  } catch (error) {
    log.error('Failed to create workspace:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to create workspace' });
  }
}

export async function getWorkspaceById(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const workspace = await prisma.workspace.findUnique({
      where: { id: (request.params as any).id },
      include: { owner: { select: { id: true, email: true, name: true } }, _count: { select: { projects: true, members: true } } },
    });

    if (!workspace) {
      return reply.status(404).send({ error: 'Not Found', message: 'Workspace not found' });
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: workspace.id, userId },
    });

    if (workspace.ownerId !== userId && !membership) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
    }

    const memberRole = workspace.ownerId === userId ? 'OWNER' : (membership?.role || 'VIEWER');

    reply.send({ ...workspace, memberRole });
  } catch (error) {
    log.error('Failed to get workspace:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to fetch workspace' });
  }
}

export async function updateWorkspace(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { name, description } = request.body as any;
    const userId = (request as any).userId!;

    const workspace = await prisma.workspace.findUnique({ where: { id: (request.params as any).id } });
    if (!workspace) {
      return reply.status(404).send({ error: 'Not Found', message: 'Workspace not found' });
    }

    if (workspace.ownerId !== userId) {
      const membership = await prisma.workspaceMember.findFirst({
        where: { workspaceId: workspace.id, userId },
      });
      if (membership?.role !== UserRole.ADMIN) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Only owners or admins can update workspace' });
      }
    }

    const updated = await prisma.workspace.update({
      where: { id: (request.params as any).id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
      },
      include: { _count: { select: { projects: true, members: true } } },
    });

    reply.send({ ...updated, memberRole: workspace.ownerId === userId ? 'OWNER' : 'ADMIN' });
  } catch (error) {
    log.error('Failed to update workspace:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to update workspace' });
  }
}

export async function deleteWorkspace(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const workspace = await prisma.workspace.findUnique({ where: { id: (request.params as any).id } });
    if (!workspace) {
      return reply.status(404).send({ error: 'Not Found', message: 'Workspace not found' });
    }

    if (workspace.ownerId !== userId) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only the workspace owner can delete it' });
    }

    await prisma.workspace.delete({ where: { id: (request.params as any).id } });

    reply.status(204).send();
  } catch (error) {
    log.error('Failed to delete workspace:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to delete workspace' });
  }
}

export async function getWorkspaceMembers(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const workspace = await prisma.workspace.findUnique({ where: { id: (request.params as any).id } });
    if (!workspace) {
      return reply.status(404).send({ error: 'Not Found', message: 'Workspace not found' });
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: workspace.id, userId },
    });

    if (workspace.ownerId !== userId && !membership) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
    }

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: (request.params as any).id },
      include: { user: { select: { id: true, email: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const ownerUser = await prisma.user.findUnique({
      where: { id: workspace.ownerId },
      select: { id: true, email: true, name: true, avatar: true },
    });

    const result = [
      { id: 'owner', user: ownerUser, role: 'OWNER', createdAt: workspace.createdAt },
      ...members.map((m) => ({ ...m, user: m.user })),
    ];

    reply.send(result);
  } catch (error) {
    log.error('Failed to list workspace members:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to fetch members' });
  }
}

export async function addWorkspaceMember(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { email, role } = request.body as any;
    const userId = (request as any).userId!;

    if (!email) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Email is required' });
    }

    const workspace = await prisma.workspace.findUnique({ where: { id: (request.params as any).id } });
    if (!workspace) {
      return reply.status(404).send({ error: 'Not Found', message: 'Workspace not found' });
    }

    if (workspace.ownerId !== userId) {
      const membership = await prisma.workspaceMember.findFirst({
        where: { workspaceId: workspace.id, userId },
      });
      if (membership?.role !== UserRole.ADMIN) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Only owners or admins can invite members' });
      }
    }

    const userToAdd = await prisma.user.findUnique({ where: { email } });
    if (!userToAdd) {
      return reply.status(404).send({ error: 'Not Found', message: 'User not found. They need to create an account first' });
    }

    if (userToAdd.id === workspace.ownerId) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Cannot add owner as member' });
    }

    const existing = await prisma.workspaceMember.findFirst({
      where: { workspaceId: (request.params as any).id, userId: userToAdd.id },
    });
    if (existing) {
      return reply.status(400).send({ error: 'Bad Request', message: 'User is already a member' });
    }

    const member = await prisma.workspaceMember.create({
      data: {
        workspaceId: (request.params as any).id,
        userId: userToAdd.id,
        role: role || UserRole.DEVELOPER,
      },
      include: { user: { select: { id: true, email: true, name: true, avatar: true } } },
    });

    reply.status(201).send(member);
  } catch (error) {
    log.error('Failed to add workspace member:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to add member' });
  }
}

export async function updateMemberRole(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { role } = request.body as any;
    const userId = (request as any).userId!;

    if (!role || !Object.values(UserRole).includes(role)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Invalid role' });
    }

    const workspace = await prisma.workspace.findUnique({ where: { id: (request.params as any).id } });
    if (!workspace) {
      return reply.status(404).send({ error: 'Not Found', message: 'Workspace not found' });
    }

    if (workspace.ownerId !== userId) {
      const membership = await prisma.workspaceMember.findFirst({
        where: { workspaceId: workspace.id, userId },
      });
      if (membership?.role !== UserRole.ADMIN) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Only owners or admins can change roles' });
      }
    }

    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: (request.params as any).id, userId: (request.params as any).memberId },
    });
    if (!member) {
      return reply.status(404).send({ error: 'Not Found', message: 'Member not found' });
    }

    const updated = await prisma.workspaceMember.update({
      where: { id: member.id },
      data: { role },
      include: { user: { select: { id: true, email: true, name: true, avatar: true } } },
    });

    reply.send(updated);
  } catch (error) {
    log.error('Failed to update member role:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to update member' });
  }
}

export async function removeMember(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const workspace = await prisma.workspace.findUnique({ where: { id: (request.params as any).id } });
    if (!workspace) {
      return reply.status(404).send({ error: 'Not Found', message: 'Workspace not found' });
    }

    if ((request.params as any).memberId === workspace.ownerId) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Cannot remove workspace owner' });
    }

    if (workspace.ownerId !== userId) {
      const membership = await prisma.workspaceMember.findFirst({
        where: { workspaceId: workspace.id, userId },
      });
      if (membership?.role !== UserRole.ADMIN) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Only owners or admins can remove members' });
      }
    }

    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: (request.params as any).id, userId: (request.params as any).memberId },
    });
    if (!member) {
      return reply.status(404).send({ error: 'Not Found', message: 'Member not found' });
    }

    await prisma.workspaceMember.delete({ where: { id: member.id } });

    reply.status(204).send();
  } catch (error) {
    log.error('Failed to remove member:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to remove member' });
  }
}

export async function transferOwnership(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { newOwnerId } = request.body as any;
    const userId = (request as any).userId!;

    if (!newOwnerId) {
      return reply.status(400).send({ error: 'Bad Request', message: 'New owner ID is required' });
    }

    const workspace = await prisma.workspace.findUnique({ where: { id: (request.params as any).id } });
    if (!workspace) {
      return reply.status(404).send({ error: 'Not Found', message: 'Workspace not found' });
    }

    if (workspace.ownerId !== userId) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only the workspace owner can transfer ownership' });
    }

    if (newOwnerId === workspace.ownerId) {
      return reply.status(400).send({ error: 'Bad Request', message: 'New owner must be different from current owner' });
    }

    const newOwner = await prisma.user.findUnique({ where: { id: newOwnerId } });
    if (!newOwner) {
      return reply.status(404).send({ error: 'Not Found', message: 'User not found' });
    }

    const existingMember = await prisma.workspaceMember.findFirst({
      where: { workspaceId: (request.params as any).id, userId: newOwnerId },
    });
    if (!existingMember) {
      return reply.status(400).send({ error: 'Bad Request', message: 'User must be a member of the workspace first' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.workspace.update({
        where: { id: (request.params as any).id },
        data: { ownerId: newOwnerId },
      });

      const oldOwnerMember = await tx.workspaceMember.findFirst({
        where: { workspaceId: (request.params as any).id, userId: workspace.ownerId },
      });

      if (oldOwnerMember) {
        await tx.workspaceMember.update({
          where: { id: oldOwnerMember.id },
          data: { role: UserRole.ADMIN },
        });
      } else {
        await tx.workspaceMember.create({
          data: {
            workspaceId: (request.params as any).id,
            userId: workspace.ownerId,
            role: UserRole.ADMIN,
          },
        });
      }

      return tx.workspace.findUnique({
        where: { id: (request.params as any).id },
        include: { owner: { select: { id: true, email: true, name: true } }, _count: { select: { projects: true, members: true } } },
      });
    });

    reply.send({ ...updated, memberRole: 'ADMIN' });
  } catch (error) {
    log.error('Failed to transfer ownership:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to transfer ownership' });
  }
}

export async function getWorkspaceEnv(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id: workspaceId } = request.params as any;
    const { environment = 'PRODUCTION' } = request.query as any;
    const userId = (request as any).userId!;

    const result = await getWorkspaceForEnv(workspaceId, userId);
    if ('error' in result) {
      reply.status(result.status!).send({ error: 'Not Found', message: result.error });
    }

    const namespace = 'default';
    const workspaceEnvFile = await k8sDeployManager.getWorkspaceEnvVars(namespace, workspaceId);

    reply.send({
      environment,
      env: workspaceEnvFile,
    });
  } catch (error: any) {
    log.error('Failed to fetch workspace env vars:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

export async function setWorkspaceEnv(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id: workspaceId } = request.params as any;
    const { key, value, isSecret, envContent, environment = 'PRODUCTION' } = request.body as any;
    const userId = (request as any).userId!;

    const result = await getWorkspaceForEnv(workspaceId, userId);
    if ('error' in result) {
      return reply.status(result.status!).send({ error: 'Not Found', message: result.error });
    }

    let varsToAdd: EnvVar[] = [];

    if (envContent) {
      varsToAdd = parseEnvContent(envContent);
    } else if (key && value !== undefined) {
      varsToAdd = [{ key, value, isSecret }];
    } else {
      return reply.status(400).send({ error: 'Bad Request', message: 'Provide either key/value or envContent' });
    }

    const namespace = 'default';
    const workspaceEnvFile = await k8sDeployManager.getWorkspaceEnvVars(namespace, workspaceId);

    for (const v of varsToAdd) {
      workspaceEnvFile[v.key] = { key: v.key, value: v.value, isSecret: true };
    }

    await k8sDeployManager.setWorkspaceEnvVars(namespace, workspaceId, workspaceEnvFile);

    reply.send({ message: 'Workspace environment variables updated', env: workspaceEnvFile });
  } catch (error: any) {
    log.error('Failed to set workspace env var:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

export async function deleteWorkspaceEnv(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id: workspaceId, key } = request.params as any;
    const { environment = 'PRODUCTION' } = request.query as any;

    const namespace = 'default';
    const workspaceEnvFile = await k8sDeployManager.getWorkspaceEnvVars(namespace, workspaceId);

    if (!workspaceEnvFile[key]) {
      return reply.status(404).send({ error: 'Not Found', message: 'Environment variable not found' });
    }

    delete workspaceEnvFile[key];

    await k8sDeployManager.setWorkspaceEnvVars(namespace, workspaceId, workspaceEnvFile);

    reply.status(204).send();
  } catch (error: any) {
    log.error('Failed to delete workspace env var:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}
