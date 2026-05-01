export var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "ADMIN";
    UserRole["MANAGER"] = "MANAGER";
    UserRole["DEVELOPER"] = "DEVELOPER";
    UserRole["VIEWER"] = "VIEWER";
    UserRole["BILLING"] = "BILLING";
})(UserRole || (UserRole = {}));
export var UserStatus;
(function (UserStatus) {
    UserStatus["ACTIVE"] = "ACTIVE";
    UserStatus["INACTIVE"] = "INACTIVE";
    UserStatus["SUSPENDED"] = "SUSPENDED";
    UserStatus["PENDING"] = "PENDING";
})(UserStatus || (UserStatus = {}));
export var SubscriptionStatus;
(function (SubscriptionStatus) {
    SubscriptionStatus["ACTIVE"] = "ACTIVE";
    SubscriptionStatus["CANCELLED"] = "CANCELLED";
    SubscriptionStatus["EXPIRED"] = "EXPIRED";
    SubscriptionStatus["PAST_DUE"] = "PAST_DUE";
    SubscriptionStatus["TRIALING"] = "TRIALING";
})(SubscriptionStatus || (SubscriptionStatus = {}));
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
};
export const hasPermission = (role, permission) => {
    return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
};
export const canAccessResource = (role, resourceOwnerId, userId, isAdmin) => {
    if (isAdmin || role === UserRole.ADMIN)
        return true;
    return resourceOwnerId === userId;
};
