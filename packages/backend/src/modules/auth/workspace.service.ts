import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateWorkspaceDto, UpdateWorkspaceDto, InviteMemberDto, UpdateMemberRoleDto } from './dto/workspace.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class WorkspaceService {
  constructor(private prisma: PrismaService) {}

  async createWorkspace(userId: string, createWorkspaceDto: CreateWorkspaceDto) {
    const { name, slug, description } = createWorkspaceDto;

    // Verify slug is unique
    const existing = await this.prisma.workspace.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new BadRequestException('Workspace slug already exists');
    }

    // Create workspace
    const workspace = await this.prisma.workspace.create({
      data: {
        name,
        slug,
        description,
        ownerId: userId,
      },
    });

    // Add owner as member with OWNER role
    await this.prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId,
        role: 'OWNER',
        permissions: ['*'], // Full permissions for owner
        acceptedAt: new Date(),
      },
    });

    // Log audit
    await this.prisma.auditLog.create({
      data: {
        workspaceId: workspace.id,
        action: 'workspace.created',
        resourceType: 'workspace',
        resourceId: workspace.id,
        userId,
      },
    });

    return workspace;
  }

  async getWorkspace(userId: string, workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Check if user has access
    const member = workspace.members.find((m) => m.userId === userId);
    if (!member && workspace.ownerId !== userId) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    return {
      ...workspace,
      memberCount: workspace.members.length,
    };
  }

  async listWorkspaces(userId: string) {
    // Get owned workspaces
    const ownedWorkspaces = await this.prisma.workspace.findMany({
      where: { ownerId: userId },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    // Get member workspaces
    const memberWorkspaces = await this.prisma.workspaceMember.findMany({
      where: { userId, acceptedAt: { not: null } },
      include: {
        workspace: {
          include: {
            _count: {
              select: { members: true },
            },
          },
        },
      },
    });

    return [
      ...ownedWorkspaces.map((w) => ({
        ...w,
        memberCount: w._count.members,
        role: 'OWNER',
      })),
      ...memberWorkspaces.map((m) => ({
        ...m.workspace,
        memberCount: m.workspace._count.members,
        role: m.role,
      })),
    ];
  }

  async updateWorkspace(userId: string, workspaceId: string, updateWorkspaceDto: UpdateWorkspaceDto) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Only owner can update workspace
    if (workspace.ownerId !== userId) {
      throw new ForbiddenException('Only workspace owner can update workspace settings');
    }

    const updated = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: updateWorkspaceDto,
    });

    // Log audit
    await this.prisma.auditLog.create({
      data: {
        workspaceId,
        action: 'workspace.updated',
        resourceType: 'workspace',
        resourceId: workspaceId,
        userId,
        changes: JSON.stringify(updateWorkspaceDto),
      },
    });

    return updated;
  }

  async deleteWorkspace(userId: string, workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Only owner can delete workspace
    if (workspace.ownerId !== userId) {
      throw new ForbiddenException('Only workspace owner can delete workspace');
    }

    // Delete workspace (cascades to members, projects, etc.)
    await this.prisma.workspace.delete({
      where: { id: workspaceId },
    });

    // Log audit
    await this.prisma.auditLog.create({
      data: {
        action: 'workspace.deleted',
        resourceType: 'workspace',
        resourceId: workspaceId,
        userId,
      },
    });
  }

  async inviteMember(userId: string, workspaceId: string, inviteMemberDto: InviteMemberDto) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Check if user is admin or owner
    const userMember = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    if (!userMember && workspace.ownerId !== userId) {
      throw new ForbiddenException('You do not have permission to invite members');
    }

    if (
      userMember &&
      !['OWNER', 'ADMIN'].includes(userMember.role) &&
      workspace.ownerId !== userId
    ) {
      throw new ForbiddenException('Only admins can invite members');
    }

    // Check if invitee exists
    const inviteeUser = await this.prisma.user.findUnique({
      where: { email: inviteMemberDto.email },
    });

    if (!inviteeUser) {
      throw new BadRequestException('User with this email does not exist');
    }

    // Check if already a member
    const existingMember = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: inviteeUser.id,
        },
      },
    });

    if (existingMember && existingMember.acceptedAt) {
      throw new BadRequestException('User is already a member of this workspace');
    }

    // Create or update membership
    const member = await this.prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: inviteeUser.id,
        },
      },
      create: {
        workspaceId,
        userId: inviteeUser.id,
        role: inviteMemberDto.role as any,
        permissions: inviteMemberDto.permissions || [],
        invitedBy: userId,
      },
      update: {
        role: inviteMemberDto.role as any,
        permissions: inviteMemberDto.permissions || [],
        invitedBy: userId,
        invitedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    // TODO: Send invitation email

    // Log audit
    await this.prisma.auditLog.create({
      data: {
        workspaceId,
        action: 'member.invited',
        resourceType: 'workspace_member',
        resourceId: member.id,
        userId,
        changes: JSON.stringify({ email: inviteMemberDto.email, role: inviteMemberDto.role }),
      },
    });

    return member;
  }

  async acceptInvitation(userId: string, workspaceId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Invitation not found');
    }

    if (member.acceptedAt) {
      throw new BadRequestException('Invitation already accepted');
    }

    const updated = await this.prisma.workspaceMember.update({
      where: {
        id: member.id,
      },
      data: {
        acceptedAt: new Date(),
      },
    });

    return updated;
  }

  async updateMemberRole(userId: string, workspaceId: string, memberId: string, updateMemberRoleDto: UpdateMemberRoleDto) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Check if user is admin or owner
    const userMember = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    if (!userMember && workspace.ownerId !== userId) {
      throw new ForbiddenException('You do not have permission to update members');
    }

    if (
      userMember &&
      !['OWNER', 'ADMIN'].includes(userMember.role) &&
      workspace.ownerId !== userId
    ) {
      throw new ForbiddenException('Only admins can update members');
    }

    const member = await this.prisma.workspaceMember.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    // Prevent removing owner role
    if (member.role === 'OWNER' && updateMemberRoleDto.role !== 'OWNER') {
      throw new BadRequestException('Cannot change owner role');
    }

    const updated = await this.prisma.workspaceMember.update({
      where: { id: memberId },
      data: {
        role: updateMemberRoleDto.role as any,
        permissions: updateMemberRoleDto.permissions || member.permissions,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    // Log audit
    await this.prisma.auditLog.create({
      data: {
        workspaceId,
        action: 'member.updated',
        resourceType: 'workspace_member',
        resourceId: memberId,
        userId,
        changes: JSON.stringify({ role: updateMemberRoleDto.role }),
      },
    });

    return updated;
  }

  async removeMember(userId: string, workspaceId: string, memberId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Check if user is admin or owner
    const userMember = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    if (!userMember && workspace.ownerId !== userId) {
      throw new ForbiddenException('You do not have permission to remove members');
    }

    if (
      userMember &&
      !['OWNER', 'ADMIN'].includes(userMember.role) &&
      workspace.ownerId !== userId
    ) {
      throw new ForbiddenException('Only admins can remove members');
    }

    const member = await this.prisma.workspaceMember.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    // Prevent removing owner
    if (member.role === 'OWNER') {
      throw new BadRequestException('Cannot remove workspace owner');
    }

    await this.prisma.workspaceMember.update({
      where: { id: memberId },
      data: { removedAt: new Date() },
    });

    // Log audit
    await this.prisma.auditLog.create({
      data: {
        workspaceId,
        action: 'member.removed',
        resourceType: 'workspace_member',
        resourceId: memberId,
        userId,
      },
    });
  }

  async getMembers(userId: string, workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          where: { removedAt: null },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Check if user has access
    const userMember = workspace.members.find((m) => m.userId === userId);
    if (!userMember && workspace.ownerId !== userId) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    return workspace.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      userEmail: m.user.email,
      userName: m.user.name,
      role: m.role,
      permissions: m.permissions,
      invitedAt: m.invitedAt,
      acceptedAt: m.acceptedAt,
    }));
  }
}
