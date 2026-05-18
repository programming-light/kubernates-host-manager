import { UserRole, UserStatus } from './types';

export const WORKSPACE_ROLE_PERMISSIONS: Record<string, string[]> = {
  OWNER: [
    'workspace:read',
    'workspace:write',
    'workspace:delete',
    'workspace:transfer',
    'members:read',
    'members:write',
    'members:delete',
    'members:invite',
    'projects:read',
    'projects:write',
    'projects:delete',
    'deployments:read',
    'deployments:write',
    'deployments:delete',
    'clusters:read',
    'clusters:write',
    'clusters:delete',
    'billing:read',
    'billing:write',
    'settings:read',
    'settings:write',
  ],
  ADMIN: [
    'workspace:read',
    'workspace:write',
    'members:read',
    'members:write',
    'members:delete',
    'members:invite',
    'projects:read',
    'projects:write',
    'projects:delete',
    'deployments:read',
    'deployments:write',
    'deployments:delete',
    'clusters:read',
    'clusters:write',
    'clusters:delete',
    'billing:read',
    'settings:read',
    'settings:write',
  ],
  MANAGER: [
    'workspace:read',
    'members:read',
    'projects:read',
    'projects:write',
    'deployments:read',
    'deployments:write',
    'clusters:read',
    'billing:read',
    'settings:read',
  ],
  DEVELOPER: [
    'workspace:read',
    'members:read',
    'projects:read',
    'projects:write',
    'deployments:read',
    'deployments:write',
  ],
  VIEWER: [
    'workspace:read',
    'members:read',
    'projects:read',
    'deployments:read',
  ],
  BILLING: [
    'workspace:read',
    'billing:read',
    'billing:write',
  ],
} as const;

export const PAGE_PERMISSIONS: Record<string, string> = {
  '/dashboard': 'workspace:read',
  '/dashboard/workspaces': 'workspace:read',
  '/dashboard/projects': 'projects:read',
  '/dashboard/deployments': 'deployments:read',
  '/dashboard/kubernetes': 'clusters:read',
  '/dashboard/billing': 'billing:read',
  '/dashboard/pricing': 'workspace:read',
  '/dashboard/settings': 'settings:read',
} as const;

export const hasWorkspacePermission = (role: string, permission: string): boolean => {
  return WORKSPACE_ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
};

export const canAccessPage = (role: string, page: string): boolean => {
  const requiredPermission = PAGE_PERMISSIONS[page];
  if (!requiredPermission) return true;
  return hasWorkspacePermission(role, requiredPermission);
};
