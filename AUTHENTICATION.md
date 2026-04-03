# Authentication & Multi-Tenant Management

This document describes the complete authentication and multi-tenant workspace management system for the Kubernetes Hosting Platform.

## Architecture Overview

### User Roles
- **SUPER_ADMIN**: Global system administrator with full access to all workspaces
- **ADMIN**: Global administrator with management capabilities
- **SUPPORT**: Support staff role
- **TENANT_OWNER**: Owner of one or more workspaces (default role for new users)
- **TENANT_MEMBER**: Regular user role

### Workspace Roles
- **OWNER**: Workspace owner with full control
- **ADMIN**: Can manage members and settings
- **EDITOR**: Can create and modify projects
- **VIEWER**: Read-only access
- **MEMBER**: Standard workspace member

## Authentication Flow

### Signup
1. User provides email, password, and name
2. Password is hashed with Argon2 (PBKDF2 best practice)
3. User created with `TENANT_OWNER` global role
4. Email verification token generated (24hr expiry)
5. Verification email sent (TODO: implement email service)
6. Access and refresh tokens generated

### Login
1. User provides email and password
2. Account lockout checked (5 attempts lock for 15 mins)
3. Password verified against Argon2 hash
4. Login attempts reset on success
5. Last login timestamp and IP recorded
6. Audit log created for login event
7. New access (15min) and refresh (7day) tokens generated

### Token Refresh
1. User sends valid refresh token
2. Token validated (not revoked, not expired)
3. New access and refresh tokens issued
4. Old refresh token remains valid until revoked

### Logout
1. Refresh token revoked (marked as `revokedAt`)
2. Audit log created
3. User must login again for new tokens

### Password Reset Flow
1. User requests password reset with email
2. Reset token generated (1hr expiry)
3. Reset email sent with secure link
4. User clicks link and submits new password
5. Password updated and hashed with Argon2
6. All existing refresh tokens revoked for security
7. Reset token marked as used

### Email Verification
1. Verification token sent during signup
2. User clicks link with token
3. Token validated (not expired)
4. Email marked as verified
5. Verification record deleted

## Database Schema

### User Model
```prisma
model User {
  id                    String                 @id @default(cuid())
  email                 String                 @unique
  password              String                 // Argon2 hashed
  name                  String
  avatar                String?
  
  // Email verification
  emailVerified         Boolean                @default(false)
  emailVerificationToken String?
  emailVerificationExpiresAt DateTime?
  
  // Password reset
  passwordResetToken    String?
  passwordResetExpiresAt DateTime?
  
  // Global role
  globalRole            GlobalUserRole         @default(TENANT_OWNER)
  
  // Session management
  lastLoginAt           DateTime?
  lastLoginIp           String?
  loginAttempts         Int                    @default(0)
  lockedUntil           DateTime?
  
  // Relations
  workspaceMembers      WorkspaceMember[]
  ownedWorkspaces       Workspace[]            @relation("workspace_owner")
  refreshTokens         RefreshToken[]
  auditLogs             AuditLog[]
  deployments           Deployment[]
  
  createdAt             DateTime               @default(now())
  updatedAt             DateTime               @updatedAt
}
```

### Workspace Model
```prisma
model Workspace {
  id                String              @id @default(cuid())
  name              String
  slug              String              @unique
  description       String?
  avatar            String?
  
  // Owner
  ownerId           String
  owner             User                @relation("workspace_owner", fields: [ownerId], references: [id], onDelete: Cascade)
  
  // Relations
  members           WorkspaceMember[]
  clusters          Cluster[]
  projects          Project[]
  domains           Domain[]
  apiKeys           ApiKey[]
  auditLogs         AuditLog[]
  
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
}
```

### WorkspaceMember Model
```prisma
model WorkspaceMember {
  id          String              @id @default(cuid())
  workspaceId String
  workspace   Workspace           @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  
  userId      String
  user        User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  role        WorkspaceMemberRole @default(MEMBER)
  permissions String[]            // Array of permission strings
  
  invitedBy   String?
  invitedAt   DateTime            @default(now())
  acceptedAt  DateTime?
  removedAt   DateTime?
  
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt
  
  @@unique([workspaceId, userId])
}
```

### RefreshToken Model
```prisma
model RefreshToken {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  token     String   @unique
  expiresAt DateTime
  revokedAt DateTime?
  
  createdAt DateTime @default(now())
}
```

## API Endpoints

### Authentication Endpoints

#### POST `/auth/signup`
Register a new user account
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "password": "SecurePassword123!"
}
```

#### POST `/auth/login`
Login with email and password
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```
Response includes `accessToken`, `refreshToken`, and `expiresIn`

#### POST `/auth/refresh`
Get new access token using refresh token
```json
{
  "refreshToken": "refresh_token_string"
}
```

#### POST `/auth/logout`
Revoke refresh token and logout
```json
{
  "refreshToken": "refresh_token_string"
}
```

#### POST `/auth/forgot-password`
Request password reset email
```json
{
  "email": "user@example.com"
}
```

#### POST `/auth/reset-password`
Reset password with token
```json
{
  "token": "reset_token_from_email",
  "password": "NewPassword123!"
}
```

#### POST `/auth/verify-email`
Verify email address
```json
{
  "token": "verification_token_from_email"
}
```

#### POST `/auth/change-password`
Change password (requires JWT auth)
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword456!"
}
```

#### GET `/auth/profile` (Protected)
Get current user profile and workspaces

#### POST `/auth/profile` (Protected)
Update user profile
```json
{
  "name": "Jane Doe",
  "avatar": "https://..."
}
```

### Workspace Endpoints

#### POST `/auth/workspaces` (Protected)
Create new workspace
```json
{
  "name": "My Workspace",
  "slug": "my-workspace",
  "description": "Production workspace"
}
```

#### GET `/auth/workspaces` (Protected)
List all workspaces user is member of

#### GET `/auth/workspaces/:workspaceId` (Protected)
Get workspace details

#### POST `/auth/workspaces/:workspaceId` (Protected)
Update workspace settings

#### POST `/auth/workspaces/:workspaceId/members/invite` (Protected)
Invite member to workspace
```json
{
  "email": "newmember@example.com",
  "role": "EDITOR",
  "permissions": ["project.create", "deployment.create"]
}
```

#### GET `/auth/workspaces/:workspaceId/members` (Protected)
List workspace members

#### POST `/auth/workspaces/:workspaceId/members/:memberId/role` (Protected)
Update member role and permissions

#### POST `/auth/workspaces/:workspaceId/members/:memberId/remove` (Protected)
Remove member from workspace

## Security Features

### Password Security
- **Hashing Algorithm**: Argon2id (recommended by OWASP)
- **Parameters**:
  - Memory Cost: 64MB (2^16)
  - Time Cost: 3 iterations
  - Parallelism: 1

### Session Management
- **Access Tokens**: 15-minute expiry
- **Refresh Tokens**: 7-day expiry
- **Token Revocation**: Explicit revocation on logout, password change
- **Token Format**: JWT with RS256 signing

### Account Lockout
- **Failed Attempts**: 5 failed login attempts triggers lockout
- **Lockout Duration**: 15 minutes
- **Reset**: Automatic reset on successful login

### Audit Logging
- All authentication events logged (login, logout, registration)
- Workspace member changes logged
- Password changes logged
- IP address and user agent captured

### Multi-Tenancy Isolation
- **WorkspaceGuard**: Validates user access to workspace
- **Row-Level Security**: Workspace members can only access their workspace data
- **Permission Model**: Fine-grained permissions per workspace member

## Protected Routes

Routes protected with `@UseGuards(JwtAuthGuard)` require valid JWT access token in Authorization header:
```
Authorization: Bearer <access_token>
```

Routes with `@UseGuards(JwtAuthGuard, WorkspaceGuard)` additionally validate workspace access.

## Environment Variables

Required:
```env
JWT_SECRET=your-secret-key-min-32-chars
JWT_EXPIRATION=15m
DATABASE_URL=postgresql://user:password@localhost:5432/k8s_platform
```

Optional:
```env
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_REFRESH_EXPIRATION=7d
```

## Frontend Integration

### Auth Context (`lib/auth-context.tsx`)
Provides:
- `login(email, password)`: User login
- `signup(email, password, name)`: User registration
- `logout()`: User logout
- `getAccessToken()`: Get current access token
- `isAuthenticated`: Check auth status

### Protected Pages
Use `JwtAuthGuard` for protected routes in Next.js:
```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProtectedPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/login');
    }
  }, []);

  // Page content
}
```

### Token Refresh
Implement automatic token refresh in API client middleware:
```typescript
// When access token expires, use refresh token to get new one
const response = await apiClient.post('/auth/refresh', {
  refreshToken: localStorage.getItem('refreshToken'),
});
localStorage.setItem('accessToken', response.data.accessToken);
```

## Testing

### Manual Testing Checklist
- [ ] Signup with valid email/password
- [ ] Verify email address
- [ ] Login with correct credentials
- [ ] Login with incorrect password (should fail and increment counter)
- [ ] Account lockout after 5 failed attempts
- [ ] Refresh tokens after 15 minutes
- [ ] Logout and verify token revocation
- [ ] Forgot password and reset flow
- [ ] Create workspace and manage members
- [ ] Verify workspace isolation (can't access other workspaces)

## Future Enhancements
- Two-factor authentication (2FA)
- Social login (Google, GitHub)
- Single sign-on (SSO)
- API key authentication
- Role-based middleware
- Permission validation middleware
