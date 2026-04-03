# Security Best Practices & Implementation Guide

## Overview

This document outlines the security architecture and best practices implemented in the K8s Hosting Platform.

## 1. Authentication & Authorization

### JWT Authentication
- **Access Tokens**: Short-lived (15 minutes) used for API requests
- **Refresh Tokens**: Long-lived (7 days) used to obtain new access tokens
- Tokens are signed with a secret key stored in `JWT_SECRET`
- Tokens include user ID and email for identity verification

### Implementation
```typescript
// Backend validates JWT on protected routes
@UseGuards(AuthGuard('jwt'))
@Controller('protected-resource')
export class ProtectedController {}

// Frontend stores tokens in localStorage
localStorage.setItem('accessToken', token);
localStorage.setItem('refreshToken', refreshToken);
```

### Refresh Token Flow
1. Access token expires after 15 minutes
2. Client receives 401 Unauthorized response
3. Client uses refresh token to obtain new access token
4. Backend validates refresh token and issues new access token
5. Request is retried with new token

## 2. Role-Based Access Control (RBAC)

### User Roles
- **ADMIN**: Full platform access, can manage all users and resources
- **DEVELOPER**: Can create and manage projects, deploy, scale, etc.
- **VIEWER**: Read-only access to assigned resources

### Implementation
```typescript
@Roles(UserRole.ADMIN, UserRole.DEVELOPER)
@Post('projects')
createProject(@Body() dto: CreateProjectInput) {
  // Only admin and developer can create projects
}
```

### Database-Level Multi-tenancy
- Every resource is scoped to a `tenantId`
- API endpoints validate tenant ownership before returning data
- Row-level security prevents data leakage between tenants

## 3. Password Security

### Hashing
- Passwords are hashed using `bcryptjs` with salt rounds of 10
- Never store plain text passwords
- Hash is computed during registration and login

```typescript
// Registration
const hashedPassword = await bcrypt.hash(password, 10);

// Login verification
const valid = await bcrypt.compare(inputPassword, hashedPassword);
```

### Requirements
- Minimum 8 characters
- Should include mix of upper/lowercase, numbers, special characters (recommended)
- Rate limiting on login attempts to prevent brute force

## 4. Kubernetes Credential Encryption

### Threat Model
- Cluster credentials needed for deployment operations
- Credentials must never be exposed to frontend or logs
- Credentials must be encrypted at rest in database

### Implementation
```typescript
// Encrypt credentials before storing
const encrypted = encryptionService.encrypt(clusterCredentials);
await prisma.cluster.create({
  data: {
    apiEndpoint: encrypted.apiEndpoint,
    clientCert: encrypted.clientCert,
    clientKey: encrypted.clientKey,
    token: encrypted.token,
  },
});

// Decrypt only when needed for K8s operations
const credentials = {
  apiEndpoint: decryptionService.decrypt(cluster.apiEndpoint),
  clientCert: decryptionService.decrypt(cluster.clientCert),
};
```

### Encryption Details
- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key**: 32-character hex string from `ENCRYPTION_KEY` environment variable
- **IV**: Random 12-byte initialization vector (regenerated per encryption)
- **Auth Tag**: Prevents tampering with encrypted data

### Never expose credentials to:
- Frontend API responses
- Logs or error messages
- External services without explicit permission
- Source code or configuration files

## 5. API Security

### CORS (Cross-Origin Resource Sharing)
- Only allowed origins specified in `CORS_ORIGINS` environment variable
- Credentials transmitted with same-origin requests only
- Methods limited to GET, POST, PUT, PATCH, DELETE

### CSRF Protection
- State-changing operations (POST, PUT, PATCH, DELETE) logged via audit system
- Frontend must include Authorization header for all requests
- SameSite cookies would be configured for traditional session-based auth

### Helmet Security Headers
- Prevents XSS attacks via Content-Security-Policy
- Blocks MIME type sniffing
- Forces HTTPS with Strict-Transport-Security (in production)
- Prevents clickjacking with X-Frame-Options

```typescript
app.use(helmet());
```

### Input Validation
- All request bodies validated with Zod schemas
- Whitelist approach: only allow known fields
- Type coercion and sanitization applied
- Rejects unknown properties

```typescript
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const validated = schema.parse(request.body);
```

### Rate Limiting
- Authentication endpoints rate-limited to 100 requests per 15 minutes per IP
- Prevents brute force attacks
- Prevents credential stuffing

## 6. Audit Logging

### What's Logged
- Every create, update, delete operation
- User performing the action
- Timestamp and IP address
- Resource type and ID
- Changes made (before/after values)

### Access
- Admin users can view audit logs via `/admin/audit-logs`
- Audit logs are immutable (no delete option)
- Logs are searchable by tenant, user, resource type, date

### Implementation
```typescript
// Automatically logged via AuditInterceptor
POST /api/projects (creates audit log)
PATCH /api/projects/:id (creates audit log)
DELETE /api/projects/:id (creates audit log)
```

## 7. Data Protection

### In Transit
- HTTPS/TLS encryption for all client-server communication
- Configure in production environment
- Set `SECURE` cookie flag and `SameSite=Strict`

### At Rest
- Database credentials stored in environment variables
- Kubernetes credentials encrypted with AES-256-GCM
- API keys and tokens not stored longer than necessary
- Deleted data soft-deleted with `deletedAt` timestamp

### Tenant Isolation
- Database queries filter by `tenantId`
- Kubernetes resources in separate namespaces per tenant
- Service accounts have minimal required permissions

## 8. Environment Variables

### Required Security Variables
```bash
# Authentication
JWT_SECRET=<32-character-random-string>
JWT_REFRESH_SECRET=<32-character-random-string>

# Encryption
ENCRYPTION_KEY=<32-character-hex-string>

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

### Never commit to source code:
- `.env` files
- API keys, tokens, secrets
- Private keys or certificates
- Database connection strings with credentials

### Use `.env.example` as template with placeholder values.

## 9. Database Security

### Connection
- Use environment variable for database URL
- Require SSL/TLS in production
- Use strong credentials for database user

### User Permissions
- Database user should have minimal required privileges
- Create separate read-only user for backups
- Rotate credentials periodically

### Backups
- Automated daily backups
- Encrypted backups stored separately
- Test restore procedures regularly
- Maintain backup for at least 30 days

## 10. Third-Party Dependencies

### Security Updates
- Run `npm audit` regularly to identify vulnerabilities
- Update dependencies promptly, especially security patches
- Use automated dependency monitoring services (GitHub Dependabot, etc.)

### Trusted Packages Only
- Review package authors and download statistics
- Check package.json for unnecessary dependencies
- Remove unused packages

## 11. Deployment Security

### Production Checklist
- [ ] Set strong `JWT_SECRET` and `ENCRYPTION_KEY` (do not use development defaults)
- [ ] Enable HTTPS with valid SSL certificate
- [ ] Set appropriate `CORS_ORIGINS` (not `*`)
- [ ] Use environment-specific `.env` files
- [ ] Enable database backups and point-in-time recovery
- [ ] Set up log aggregation and monitoring
- [ ] Configure firewall and network policies
- [ ] Enable API rate limiting globally
- [ ] Use private Docker registries for images
- [ ] Implement web application firewall (WAF)
- [ ] Set up intrusion detection
- [ ] Regularly scan for vulnerabilities

### Docker Security
- Use minimal base images (Alpine Linux)
- Run as non-root user
- Use read-only file systems where possible
- Scan images for vulnerabilities before deployment

### Kubernetes Security
- Enable RBAC on all clusters
- Use Network Policies to restrict traffic
- Enable Pod Security Standards
- Encrypt etcd at rest
- Use Private registries for images
- Regularly patch Kubernetes versions

## 12. Incident Response

### Suspected Data Breach
1. Immediately revoke all active tokens
2. Force password reset for affected users
3. Audit logs to understand scope
4. Notify affected users
5. Perform security assessment
6. Update security measures

### Compromised Credentials
1. Regenerate all API keys and secrets
2. Rotate database credentials
3. Update encryption keys (re-encrypt existing data)
4. Review access logs for unauthorized access
5. Update security policies if needed

## 13. Compliance & Legal

### Data Privacy
- Comply with GDPR, CCPA, and applicable regulations
- Obtain explicit user consent for data collection
- Implement data retention policies
- Provide data export and deletion capabilities

### Terms of Service
- Define acceptable use policies
- Outline liability limitations
- Specify incident notification procedures
- Include security requirements for users

## 14. Monitoring & Alerting

### Key Metrics
- Authentication failures and rate limiting triggers
- Unusual API access patterns
- Deployment operations and failures
- Cluster health and availability
- Certificate expiration warnings

### Alerting
- Alert on multiple failed login attempts
- Alert on privilege escalation
- Alert on cluster credential access
- Alert on audit log anomalies
- Alert on infrastructure changes

## 15. Regular Security Audits

### Quarterly Tasks
- [ ] Review access logs for anomalies
- [ ] Audit user permissions
- [ ] Check for unused infrastructure
- [ ] Review security policies
- [ ] Update dependencies

### Annual Tasks
- [ ] Third-party security audit
- [ ] Penetration testing
- [ ] Update incident response plan
- [ ] Disaster recovery drill

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NestJS Security](https://docs.nestjs.com/security/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8949)
- [Node.js Security](https://nodejs.org/en/docs/guides/nodejs-security/)
