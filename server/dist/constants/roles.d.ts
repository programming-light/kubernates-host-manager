export declare enum UserRole {
    ADMIN = "ADMIN",
    MANAGER = "MANAGER",
    DEVELOPER = "DEVELOPER",
    VIEWER = "VIEWER",
    BILLING = "BILLING"
}
export declare enum UserStatus {
    ACTIVE = "ACTIVE",
    INACTIVE = "INACTIVE",
    SUSPENDED = "SUSPENDED",
    PENDING = "PENDING"
}
export declare enum SubscriptionStatus {
    ACTIVE = "ACTIVE",
    CANCELLED = "CANCELLED",
    EXPIRED = "EXPIRED",
    PAST_DUE = "PAST_DUE",
    TRIALING = "TRIALING"
}
export declare const ROLE_PERMISSIONS: {
    readonly ADMIN: readonly ["users:read", "users:write", "users:delete", "users:manage", "workspaces:read", "workspaces:write", "workspaces:delete", "clusters:read", "clusters:write", "clusters:delete", "projects:read", "projects:write", "projects:delete", "deployments:read", "deployments:write", "deployments:delete", "billing:read", "billing:write", "billing:manage", "plans:read", "plans:write", "settings:read", "settings:write"];
    readonly MANAGER: readonly ["workspaces:read", "workspaces:write", "clusters:read", "clusters:write", "projects:read", "projects:write", "deployments:read", "deployments:write", "billing:read"];
    readonly DEVELOPER: readonly ["workspaces:read", "clusters:read", "projects:read", "projects:write", "deployments:read", "deployments:write"];
    readonly VIEWER: readonly ["workspaces:read", "clusters:read", "projects:read", "deployments:read"];
    readonly BILLING: readonly ["billing:read", "billing:write", "workspaces:read"];
};
export declare const hasPermission: (role: UserRole, permission: string) => boolean;
export declare const canAccessResource: (role: UserRole, resourceOwnerId: string, userId: string, isAdmin: boolean) => boolean;
