# Migration Guide: Kubernetes Cluster Integration

## Overview

This guide walks you through applying the Kubernetes cluster integration schema changes to your existing database.

## Prerequisites

- PostgreSQL database running
- Prisma CLI installed (`npm install -g prisma`)
- Backup of your existing database
- Development environment with Node.js

## Step 1: Generate Migration

From the backend directory, run:

```bash
cd packages/backend

# Generate migration from schema changes
npx prisma migrate dev --name add_kubernetes_cluster_integration
```

This will:
1. Compare your current schema with the updated `schema.prisma`
2. Generate a migration file in `prisma/migrations/`
3. Apply the migration to your development database
4. Generate updated Prisma Client

**Output**:
```
✔ Environment variables loaded from .env
✔ Prisma schema loaded from prisma/schema.prisma
✔ Drift detected: You have uncommitted changes to your Prisma schema.
✔ Created migration: migrations/[timestamp]_add_kubernetes_cluster_integration/migration.sql
✔ Applied migration [timestamp]_add_kubernetes_cluster_integration to the database
✔ Generated Prisma Client (in X.XXs)
```

## Step 2: Review Migration

The generated migration file will contain SQL for:

```sql
-- New table: Cluster (enhanced)
ALTER TABLE "Cluster" ADD COLUMN "description" TEXT;
ALTER TABLE "Cluster" ADD COLUMN "connectionMode" VARCHAR(255) NOT NULL DEFAULT 'TOKEN';
ALTER TABLE "Cluster" ADD COLUMN "environment" VARCHAR(255) NOT NULL DEFAULT 'PRODUCTION';
ALTER TABLE "Cluster" ADD COLUMN "caCertificateBase64" TEXT;
ALTER TABLE "Cluster" ADD COLUMN "kubeconfigBase64" TEXT;
ALTER TABLE "Cluster" ADD COLUMN "kubernetesVersion" TEXT;
ALTER TABLE "Cluster" ADD COLUMN "nodeCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Cluster" ADD COLUMN "lastHealthCheckAt" TIMESTAMP(3);
ALTER TABLE "Cluster" ADD COLUMN "lastHealthCheckStatus" TEXT;
ALTER TABLE "Cluster" ALTER COLUMN "token" DROP NOT NULL;
ALTER TABLE "Cluster" RENAME COLUMN "caCertificate" TO "caCertificateBase64";
ALTER TABLE "Cluster" DROP COLUMN "clientCert";
ALTER TABLE "Cluster" DROP COLUMN "clientKey";

-- New table: ClusterCredential
CREATE TABLE "ClusterCredential" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clusterId" TEXT NOT NULL,
  "apiEndpoint" TEXT NOT NULL,
  "caCertificateBase64" TEXT,
  "token" TEXT,
  "kubeconfigBase64" TEXT,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  UNIQUE("clusterId", "name"),
  CONSTRAINT "ClusterCredential_clusterId_fkey" 
    FOREIGN KEY ("clusterId") REFERENCES "Cluster"("id") ON DELETE CASCADE
);

-- New table: ClusterAuditLog
CREATE TABLE "ClusterAuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clusterId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  "details" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClusterAuditLog_clusterId_fkey" 
    FOREIGN KEY ("clusterId") REFERENCES "Cluster"("id") ON DELETE CASCADE,
  CONSTRAINT "ClusterAuditLog_workspaceId_fkey" 
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE,
  CONSTRAINT "ClusterAuditLog_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
);

-- Create indices for performance
CREATE INDEX "ClusterAuditLog_clusterId_idx" ON "ClusterAuditLog"("clusterId");
CREATE INDEX "ClusterAuditLog_workspaceId_idx" ON "ClusterAuditLog"("workspaceId");
CREATE INDEX "ClusterAuditLog_userId_idx" ON "ClusterAuditLog"("userId");
CREATE INDEX "ClusterAuditLog_createdAt_idx" ON "ClusterAuditLog"("createdAt");
CREATE INDEX "Cluster_status_idx" ON "Cluster"("status");

-- Add new enums
CREATE TYPE "ConnectionMode" AS ENUM ('TOKEN', 'KUBECONFIG');
CREATE TYPE "ClusterEnvironment" AS ENUM ('LOCAL', 'STAGING', 'PRODUCTION');
```

Review this to ensure it matches your expectations.

## Step 3: Update Environment Configuration

Add the encryption key to your `.env` file:

```bash
# Generate a secure encryption key
ENCRYPTION_KEY=$(openssl rand -hex 32)
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY" >> packages/backend/.env
```

Or manually set it in your environment:

```bash
# Linux/macOS
export ENCRYPTION_KEY=$(openssl rand -hex 32)

# Windows PowerShell
$encKey = -join((1..32 | ForEach-Object { "{0:x1}" -f (Get-Random -Maximum 16) }))
[Environment]::SetEnvironmentVariable("ENCRYPTION_KEY", $encKey)
```

**Important**: Store this key securely in your production environment (e.g., AWS Secrets Manager, HashiCorp Vault, etc.)

## Step 4: Apply to Staging/Production

### Option A: Using Prisma Migrate (Recommended)

```bash
# 1. Copy migration to production environment
# The migration file is in: packages/backend/prisma/migrations/[timestamp]_add_kubernetes_cluster_integration/

# 2. Deploy the migration
npx prisma migrate deploy

# 3. Verify migration success
npx prisma migrate status
```

### Option B: Manual SQL Migration

If you can't use Prisma Migrate:

```bash
# 1. Export the migration SQL
cat packages/backend/prisma/migrations/[timestamp]_add_kubernetes_cluster_integration/migration.sql

# 2. Apply to your database using psql or your DB tool
psql -U postgres -d your_database -f migration.sql
```

### Option C: AWS RDS or Managed Database

```bash
# 1. Use AWS RDS Query Editor or your database client
# 2. Copy the SQL from the migration file
# 3. Execute it in your database connection

# For verification:
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('Cluster', 'ClusterCredential', 'ClusterAuditLog');
```

## Step 5: Verify Migration

```bash
# Check migration status
npx prisma migrate status

# Output should show:
# Prisma Migrations Applied
# [timestamp]_add_kubernetes_cluster_integration

# Connect to database and verify tables exist
psql -U postgres -d your_database -c "
  \dt public.\"Cluster\"
  \dt public.\"ClusterCredential\"
  \dt public.\"ClusterAuditLog\"
"

# Should see all three tables listed
```

## Step 6: Install Dependencies

Ensure the Kubernetes client library is installed:

```bash
cd packages/backend
npm install @kubernetes/client-node
```

If using yarn:
```bash
yarn add @kubernetes/client-node
```

## Step 7: Rebuild and Test

```bash
# Build the backend
npm run build

# Run tests (if available)
npm run test

# Start the development server
npm run dev
```

## Step 8: Data Migration (If Existing Clusters)

If you already have clusters in the database, migrate their data:

```typescript
// Optional: Create a migration script to populate old clusters
// packages/backend/scripts/migrate-clusters.ts

import { PrismaClient } from '@prisma/client';
import { ClusterEncryptionService } from '../src/modules/clusters/cluster-encryption.service';

const prisma = new PrismaClient();
const encryption = new ClusterEncryptionService();

async function migrateClusters() {
  const clusters = await prisma.cluster.findMany();

  for (const cluster of clusters) {
    // Encrypt old credentials
    if (cluster.token) {
      const encryptedToken = encryption.encrypt(cluster.token);
      await prisma.cluster.update({
        where: { id: cluster.id },
        data: {
          token: encryptedToken,
          connectionMode: 'TOKEN',
          environment: 'PRODUCTION',
        },
      });
    }
  }

  console.log(`Migrated ${clusters.length} clusters`);
}

migrateClusters().then(() => process.exit(0));
```

Run it:
```bash
npx ts-node packages/backend/scripts/migrate-clusters.ts
```

## Troubleshooting

### Error: "Database connection failed"

```bash
# Verify your DATABASE_URL
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

### Error: "Migration already applied"

```bash
# Check what's been applied
npx prisma migrate status

# If it shows as applied but you want to reset (development only):
npx prisma migrate reset

# WARNING: This deletes all data in development!
```

### Error: "Unique constraint violation"

If you have existing clusters with duplicate workspaceId + name combinations:

```sql
-- Find duplicates
SELECT "workspaceId", "name", COUNT(*) 
FROM "Cluster" 
GROUP BY "workspaceId", "name" 
HAVING COUNT(*) > 1;

-- Manually merge or delete duplicates before migration
DELETE FROM "Cluster" WHERE id IN (
  SELECT id FROM "Cluster" 
  WHERE ("workspaceId", "name") IN (...)
  ORDER BY "createdAt" DESC
  LIMIT 1
);
```

### Error: "Foreign key constraint violation"

```bash
# Check for orphaned cluster records
SELECT c.id FROM "Cluster" c 
LEFT JOIN "Workspace" w ON c."workspaceId" = w.id 
WHERE w.id IS NULL;

# Delete orphaned records before migration
DELETE FROM "Cluster" WHERE "workspaceId" NOT IN (
  SELECT id FROM "Workspace"
);
```

## Rollback Procedure

If something goes wrong:

### Development

```bash
# Reset to previous state (development only!)
npx prisma migrate resolve --rolled-back [migration-name]

# Or completely reset
npx prisma migrate reset
```

### Production

```bash
# If using Prisma Migrate, you can't directly rollback
# Instead, create a new migration that reverses the changes

npx prisma migrate dev --name rollback_cluster_integration

# Manual rollback (if you have the old schema):
# 1. Export old database backup
# 2. Restore from backup
# 3. OR manually run reverse SQL commands
```

## Post-Migration Verification

1. **Check Cluster Service Loads**:
```bash
npm run dev
# Should start without errors
# Check: "ClustersModule loaded successfully"
```

2. **Test Cluster Creation**:
```bash
# Use the API to create a test cluster
curl -X POST http://localhost:3001/api/workspaces/{id}/clusters/kubeconfig \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{...}'
```

3. **Verify Audit Logging**:
```bash
# Check that ClusterAuditLog entries are created
SELECT * FROM "ClusterAuditLog" ORDER BY "createdAt" DESC LIMIT 5;
```

4. **Verify Encryption**:
```bash
# Cluster credentials should be encrypted
SELECT id, name, token FROM "Cluster" LIMIT 1;
-- token should look like: abc123.def456.ghi789 (not plain text)
```

## Database Backup

Always backup before migration:

```bash
# PostgreSQL backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# AWS RDS backup
aws rds create-db-snapshot \
  --db-instance-identifier your-instance \
  --db-snapshot-identifier backup-$(date +%s)

# Verify backup
psql -h localhost -U postgres -d your_database -f backup_file.sql
```

## Performance Optimization

After migration, consider adding these optimizations:

```sql
-- Analyze tables for query optimizer
ANALYZE "Cluster";
ANALYZE "ClusterCredential";
ANALYZE "ClusterAuditLog";

-- Verify indices are being used
EXPLAIN ANALYZE SELECT * FROM "Cluster" WHERE "workspaceId" = '...';
```

## Next Steps

1. ✅ Run migration
2. ✅ Set ENCRYPTION_KEY environment variable
3. ✅ Install @kubernetes/client-node
4. ✅ Test cluster creation
5. ✅ Review audit logs
6. ✅ Deploy to staging
7. ✅ Deploy to production
8. 📋 Set up health check monitoring (optional)
9. 📋 Configure alert on cluster health failures (optional)

## Support

If you encounter issues during migration:

1. Check the troubleshooting section above
2. Review PostgreSQL error logs
3. Verify environment variables are set correctly
4. Check that database user has proper permissions
5. Restore from backup if needed

For detailed information, see:
- `docs/kubernetes-cluster-integration.md` - Complete guide
- `docs/CLUSTER-INTEGRATION-SUMMARY.md` - Overview
- Prisma docs: https://www.prisma.io/docs/concepts/components/prisma-migrate
