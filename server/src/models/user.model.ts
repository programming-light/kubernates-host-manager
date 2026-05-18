import { UserRole, UserStatus } from '../constants/roles.js';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  company?: string;
  phone?: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDto {
  email: string;
  name?: string;
  role?: UserRole;
  status?: UserStatus;
  company?: string;
  phone?: string;
  avatar?: string;
}

export interface UpdateUserDto {
  name?: string;
  company?: string;
  phone?: string;
  avatar?: string;
}

export interface UpdateUserRoleDto {
  role: UserRole;
}

export interface UpdateUserStatusDto {
  status: UserStatus;
}
