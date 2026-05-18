export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  DEVELOPER = 'DEVELOPER',
  VIEWER = 'VIEWER',
  BILLING = 'BILLING',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING = 'PENDING',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  PAST_DUE = 'PAST_DUE',
  TRIALING = 'TRIALING',
}

export const ROLE_PERMISSIONS = {
  [UserRole.ADMIN]: [
    'users:read',
    'users:write',
    'users:delete',
    'users:manage',
    'workspaces:read',
    'workspaces:write',
    'workspaces:delete',
    'clusters:read',
    'clusters:write',
    'clusters:delete',
    'projects:read',
    'projects:write',
    'projects:delete',
    'deployments:read',
    'deployments:write',
    'deployments:delete',
    'billing:read',
    'billing:write',
    'billing:manage',
    'plans:read',
    'plans:write',
    'settings:read',
    'settings:write',
  ],
  [UserRole.MANAGER]: [
    'workspaces:read',
    'workspaces:write',
    'clusters:read',
    'clusters:write',
    'projects:read',
    'projects:write',
    'deployments:read',
    'deployments:write',
    'billing:read',
  ],
  [UserRole.DEVELOPER]: [
    'workspaces:read',
    'clusters:read',
    'projects:read',
    'projects:write',
    'deployments:read',
    'deployments:write',
  ],
  [UserRole.VIEWER]: [
    'workspaces:read',
    'clusters:read',
    'projects:read',
    'deployments:read',
  ],
  [UserRole.BILLING]: [
    'billing:read',
    'billing:write',
    'workspaces:read',
  ],
} as const;

export const hasPermission = (role: UserRole, permission: string): boolean => {
  return ROLE_PERMISSIONS[role]?.includes(permission as any) ?? false;
};

