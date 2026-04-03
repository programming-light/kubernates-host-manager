import { Injectable, CanActivate, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const workspaceId = request.params.workspaceId || request.body?.workspaceId;

    if (!user || !workspaceId) {
      return false;
    }

    // Check if workspace exists
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Check if user is owner
    if (workspace.ownerId === user.sub) {
      request.workspace = workspace;
      request.workspaceRole = 'OWNER';
      return true;
    }

    // Check if user is a member
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: user.sub,
        },
      },
    });

    if (!member || !member.acceptedAt) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    request.workspace = workspace;
    request.workspaceRole = member.role;
    request.workspaceMember = member;

    return true;
  }
}
