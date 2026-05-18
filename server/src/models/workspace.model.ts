import { UserRole } from '../constants/roles.js';

export interface WorkspaceProfile {
  id: string;
  name: string;
  slug: string;
  description?: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  memberRole?: string;
  _count?: {
    projects: number;
    members: number;
  };
}

export interface CreateWorkspaceDto {
  name: string;
  slug: string;
  description?: string;
}

export interface UpdateWorkspaceDto {
  name?: string;
  description?: string;
}

export interface AddMemberDto {
  email: string;
  role?: UserRole;
}

export interface UpdateMemberDto {
  role: UserRole;
}

export interface TransferOwnershipDto {
  newOwnerId: string;
}

export interface WorkspaceEnvDto {
  key?: string;
  value?: string;
  isSecret?: boolean;
  envContent?: string;
  environment?: string;
}
