import { IsString, IsOptional, IsEmail, IsArray } from 'class-validator';

export class CreateWorkspaceDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateWorkspaceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}

export class InviteMemberDto {
  @IsEmail()
  email: string;

  @IsString()
  role: string; // OWNER, ADMIN, EDITOR, VIEWER, MEMBER

  @IsOptional()
  @IsArray()
  permissions?: string[];
}

export class UpdateMemberRoleDto {
  @IsString()
  role: string;

  @IsOptional()
  @IsArray()
  permissions?: string[];
}

export class WorkspaceMemberResponseDto {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  role: string;
  permissions: string[];
  invitedAt: Date;
  acceptedAt?: Date;
}

export class WorkspaceResponseDto {
  id: string;
  name: string;
  slug: string;
  description?: string;
  avatar?: string;
  ownerId: string;
  memberCount: number;
  createdAt: Date;
}
