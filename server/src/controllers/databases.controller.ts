import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import log from '../lib/logger.js';
import { k8sDatabaseManager, DatabaseType } from '../lib/k8s-database.js';
import crypto from 'crypto';

function generatePassword(length = 24): string {
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

function generateDbName(name: string): string {
  return `db_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}

const DB_PORT_MAP: Record<DatabaseType, number> = {
  POSTGRESQL: 5432,
  MYSQL: 3306,
  MARIADB: 3306,
  MONGODB: 27017,
  FERRETDB: 27017,
  REDIS: 6379,
  SQLITE: 0,
};

export async function listDatabases(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId;
    const { workspaceId, projectId } = request.query as any;

    const where: any = {};
    if (workspaceId) where.workspaceId = workspaceId;
    if (projectId) where.projectId = projectId;

    if (workspaceId) {
      const ws = await prisma.workspace.findFirst({
        where: { id: workspaceId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
      });
      if (!ws) return reply.status(403).send({ error: 'Forbidden' });
    }

    const databases = await prisma.databaseInstance.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { workspace: { select: { name: true, slug: true } } },
    });

    const result = await Promise.all(databases.map(async (db) => {
      let status = db.status;
      if (db.status === 'PROVISIONING' || db.status === 'RUNNING') {
        try {
          const k8sStatus = await k8sDatabaseManager.getDatabaseStatus(
            db.namespace, db.name, db.type as DatabaseType
          );
          if (k8sStatus !== db.status) {
            await prisma.databaseInstance.update({
              where: { id: db.id },
              data: { status: k8sStatus as any },
            });
            status = k8sStatus as any;
          }
        } catch (error) { log.warn(`[databases.controller] Status sync failed for ${db.name}: ${(error as Error).message}`); }
      }

      return {
        ...db,
        status,
      };
    }));

    reply.send(result);
  } catch (error: any) {
    log.error('Failed to list databases:', error);
    reply.status(500).send({ error: 'Internal Server Error' });
  }
}

export async function getDatabase(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as any;
    const userId = (request as any).userId;

    const db = await prisma.databaseInstance.findUnique({
      where: { id },
      include: { workspace: { select: { name: true, slug: true } } },
    });

    if (!db) return reply.status(404).send({ error: 'Not Found' });

    const ws = await prisma.workspace.findFirst({
      where: { id: db.workspaceId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    });
    if (!ws) return reply.status(403).send({ error: 'Forbidden' });

    let status = db.status;
    if (db.status === 'PROVISIONING' || db.status === 'RUNNING') {
      try {
        const k8sStatus = await k8sDatabaseManager.getDatabaseStatus(
          db.namespace, db.name, db.type as DatabaseType
        );
        if (k8sStatus !== db.status) {
          await prisma.databaseInstance.update({ where: { id: db.id }, data: { status: k8sStatus as any } });
          status = k8sStatus as any;
        }
      } catch (error) { log.warn(`[databases.controller] Status sync failed for ${db.name}: ${(error as Error).message}`); }
    }

    reply.send({ ...db, status });
  } catch (error: any) {
    log.error('Failed to get database:', error);
    reply.status(500).send({ error: 'Internal Server Error' });
  }
}

export async function createDatabase(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId;
    const { workspaceId, projectId, name, type, version, storageSize, storageClass, dbUser: userProvidedUser, dbPassword: userProvidedPassword } = request.body as any;

    if (!workspaceId || !name || !type) {
      return reply.status(400).send({ error: 'Bad Request', message: 'workspaceId, name, and type are required' });
    }

    if (!userProvidedUser || !userProvidedPassword) {
      return reply.status(400).send({ error: 'Bad Request', message: 'dbUser and dbPassword are required' });
    }

    const validTypes: DatabaseType[] = ['POSTGRESQL', 'MYSQL', 'MARIADB', 'MONGODB', 'FERRETDB', 'REDIS', 'SQLITE'];
    if (!validTypes.includes(type)) {
      return reply.status(400).send({ error: 'Bad Request', message: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
    }

    const ws = await prisma.workspace.findFirst({
      where: { id: workspaceId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    });
    if (!ws) return reply.status(403).send({ error: 'Forbidden' });

    const existing = await prisma.databaseInstance.findUnique({
      where: { workspaceId_name: { workspaceId, name } },
    });
    if (existing) {
      return reply.status(409).send({ error: 'Conflict', message: 'A database with this name already exists in this workspace' });
    }

    const dbName = generateDbName(name);
    const namespace = `db-${ws.slug}-${dbName}`;
    const dbUser = userProvidedUser.slice(0, 32);
    const dbPassword = userProvidedPassword;
    const port = DB_PORT_MAP[type as DatabaseType];

    const db = await prisma.databaseInstance.create({
      data: {
        workspaceId,
        projectId: projectId || null,
        name,
        type,
        version: version || 'latest',
        status: 'PROVISIONING',
        namespace,
        storageSize: storageSize || '1Gi',
        storageClass: storageClass || null,
        port,
        dbName,
        dbUser,
        dbPassword,
        connectionString: '',
      },
    });

    try {
      const result = await k8sDatabaseManager.provisionDatabase({
        instanceId: db.id,
        name,
        type: type as DatabaseType,
        namespace,
        dbName,
        dbUser,
        dbPassword,
        storageSize: storageSize || '1Gi',
        storageClass,
      });

      await prisma.databaseInstance.update({
        where: { id: db.id },
        data: {
          connectionString: result.connectionString,
          status: 'RUNNING',
        },
      });

      await prisma.databaseUser.create({
        data: { databaseId: db.id, username: dbUser, password: dbPassword, permission: 'READ_WRITE' },
      });

      reply.send({
        ...db,
        connectionString: result.connectionString,
        status: 'RUNNING',
        dbPassword,
      });
    } catch (k8sError: any) {
      log.error('K8s provision failed:', k8sError);
      await prisma.databaseInstance.update({
        where: { id: db.id },
        data: { status: 'FAILED' },
      });
      reply.send({
        ...db,
        status: 'FAILED',
        error: k8sError.message,
      });
    }
  } catch (error: any) {
    log.error('Failed to create database:', error);
    reply.status(500).send({ error: 'Internal Server Error' });
  }
}

export async function deleteDatabase(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as any;
    const userId = (request as any).userId;

    const db = await prisma.databaseInstance.findUnique({ where: { id } });
    if (!db) return reply.status(404).send({ error: 'Not Found' });

    const ws = await prisma.workspace.findFirst({
      where: { id: db.workspaceId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    });
    if (!ws) return reply.status(403).send({ error: 'Forbidden' });

    await prisma.databaseInstance.update({ where: { id }, data: { status: 'DELETING' } });

    try {
      await k8sDatabaseManager.deleteDatabase(db.name, db.namespace, db.type as DatabaseType);
    } catch (k8sError: any) {
      log.warn(`K8s delete failed for ${db.name}: ${k8sError.message}`);
    }

    await prisma.databaseInstance.delete({ where: { id } });

    reply.send({ message: 'Database deleted' });
  } catch (error: any) {
    log.error('Failed to delete database:', error);
    reply.status(500).send({ error: 'Internal Server Error' });
  }
}

async function getDb(id: string, userId: string) {
  const db = await prisma.databaseInstance.findUnique({ where: { id } });
  if (!db) return null;
  const ws = await prisma.workspace.findFirst({
    where: { id: db.workspaceId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
  });
  if (!ws) return null;
  return db;
}

export async function updateDatabase(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as any;
    const userId = (request as any).userId;
    const { name, storageSize, sslEnabled, ipWhitelistEnabled } = request.body as any;

    const db = await getDb(id, userId);
    if (!db) return reply.status(404).send({ error: 'Not Found' });

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (storageSize !== undefined) data.storageSize = storageSize;
    if (sslEnabled !== undefined) data.sslEnabled = sslEnabled;
    if (ipWhitelistEnabled !== undefined) data.ipWhitelistEnabled = ipWhitelistEnabled;

    if (storageSize && storageSize !== db.storageSize && (db.status === 'RUNNING' || db.status === 'PROVISIONING')) {
      try {
        await k8sDatabaseManager.resizeStorage(db.name, db.namespace, db.type as DatabaseType, storageSize);
      } catch (k8sError: any) {
        log.warn(`Storage resize failed for ${db.name}: ${k8sError.message}`);
      }
    }

    const updated = await prisma.databaseInstance.update({ where: { id }, data });
    reply.send({ ...updated, dbPassword: undefined });
  } catch (error: any) {
    log.error('Failed to update database:', error);
    reply.status(500).send({ error: 'Internal Server Error' });
  }
}

const VALID_PERMISSIONS = ['READ_ONLY', 'READ_WRITE', 'ADMIN', 'DBA'];

export async function createDatabaseUser(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as any;
    const userId = (request as any).userId;
    const { username, password: userPassword, permission } = request.body as any;

    const db = await getDb(id, userId);
    if (!db) return reply.status(404).send({ error: 'Not Found' });

    const base = username || `user_${db.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const actualUsername = base.slice(0, 16);
    const actualPassword = userPassword || generatePassword();
    const actualPermission = VALID_PERMISSIONS.includes(permission) ? permission : 'READ_WRITE';

    const prismaUser = await prisma.databaseUser.create({
      data: { databaseId: id, username: actualUsername, password: actualPassword, permission: actualPermission as any },
    });

    await k8sDatabaseManager.addDatabaseUser(db.name, db.namespace, db.type as DatabaseType, actualUsername, actualPassword);

    reply.send({ ...prismaUser, password: actualPassword });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return reply.status(409).send({ error: 'Conflict', message: 'Username already exists for this database' });
    }
    log.error('Failed to create database user:', error);
    reply.status(500).send({ error: 'Internal Server Error' });
  }
}

export async function listDatabaseUsers(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as any;
    const userId = (request as any).userId;

    const db = await getDb(id, userId);
    if (!db) return reply.status(404).send({ error: 'Not Found' });

    const users = await prisma.databaseUser.findMany({
      where: { databaseId: id },
      orderBy: { createdAt: 'desc' },
    });

    reply.send(users);
  } catch (error: any) {
    log.error('Failed to list database users:', error);
    reply.status(500).send({ error: 'Internal Server Error' });
  }
}

export async function deleteDatabaseUser(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id, userId: userIdParam } = request.params as any;
    const userId = (request as any).userId;

    const db = await getDb(id, userId);
    if (!db) return reply.status(404).send({ error: 'Not Found' });

    await prisma.databaseUser.delete({ where: { id: userIdParam } });
    reply.send({ message: 'User deleted' });
  } catch (error: any) {
    log.error('Failed to delete database user:', error);
    reply.status(500).send({ error: 'Internal Server Error' });
  }
}

export async function addIpWhitelist(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as any;
    const userId = (request as any).userId;
    const { cidr, description } = request.body as any;

    if (!cidr) return reply.status(400).send({ error: 'Bad Request', message: 'cidr is required' });

    const db = await getDb(id, userId);
    if (!db) return reply.status(404).send({ error: 'Not Found' });

    const entry = await prisma.databaseIpWhitelist.create({
      data: { databaseId: id, cidr, description: description || null },
    });

    await k8sDatabaseManager.updateNetworkPolicy(db.name, db.namespace, db.type as DatabaseType,
      await prisma.databaseIpWhitelist.findMany({ where: { databaseId: id } })
    );

    reply.send(entry);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return reply.status(409).send({ error: 'Conflict', message: 'CIDR already exists for this database' });
    }
    log.error('Failed to add IP whitelist entry:', error);
    reply.status(500).send({ error: 'Internal Server Error' });
  }
}

export async function removeIpWhitelist(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id, whitelistId } = request.params as any;
    const userId = (request as any).userId;

    const db = await getDb(id, userId);
    if (!db) return reply.status(404).send({ error: 'Not Found' });

    await prisma.databaseIpWhitelist.delete({ where: { id: whitelistId } });

    const remaining = await prisma.databaseIpWhitelist.findMany({ where: { databaseId: id } });
    await k8sDatabaseManager.updateNetworkPolicy(db.name, db.namespace, db.type as DatabaseType, remaining);

    reply.send({ message: 'IP whitelist entry removed' });
  } catch (error: any) {
    log.error('Failed to remove IP whitelist entry:', error);
    reply.status(500).send({ error: 'Internal Server Error' });
  }
}

export async function listIpWhitelist(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as any;
    const userId = (request as any).userId;

    const db = await getDb(id, userId);
    if (!db) return reply.status(404).send({ error: 'Not Found' });

    const entries = await prisma.databaseIpWhitelist.findMany({
      where: { databaseId: id },
      orderBy: { createdAt: 'desc' },
    });

    reply.send(entries);
  } catch (error: any) {
    log.error('Failed to list IP whitelist:', error);
    reply.status(500).send({ error: 'Internal Server Error' });
  }
}

export async function getDatabaseCredentials(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as any;
    const userId = (request as any).userId;

    const db = await prisma.databaseInstance.findUnique({ where: { id } });
    if (!db) return reply.status(404).send({ error: 'Not Found' });

    const ws = await prisma.workspace.findFirst({
      where: { id: db.workspaceId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    });
    if (!ws) return reply.status(403).send({ error: 'Forbidden' });

    reply.send({
      type: db.type,
      host: `${db.connectionString.split('://')[1]?.split('@')[1]?.split(':')[0] || 'localhost'}`,
      port: db.port,
      database: db.dbName,
      username: db.dbUser,
      password: db.dbPassword,
      connectionString: db.connectionString,
      sslEnabled: db.sslEnabled,
    });
  } catch (error: any) {
    log.error('Failed to get database credentials:', error);
    reply.status(500).send({ error: 'Internal Server Error' });
  }
}

export async function executeQuery(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as any;
    const { query } = request.body as any;
    const userId = (request as any).userId;

    if (!query) {
      return reply.status(400).send({ error: 'Bad Request', message: 'query is required' });
    }

    const db = await prisma.databaseInstance.findUnique({ where: { id } });
    if (!db) return reply.status(404).send({ error: 'Not Found' });

    const ws = await prisma.workspace.findFirst({
      where: { id: db.workspaceId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    });
    if (!ws) return reply.status(403).send({ error: 'Forbidden' });

    if (db.type === 'SQLITE') {
      return reply.status(400).send({ error: 'Bad Request', message: 'SQLite queries are not supported via API. Use kubectl exec.' });
    }

    reply.send({ message: 'Query execution not yet implemented for this database type. Use your preferred database client with the connection string.' });
  } catch (error: any) {
    log.error('Failed to execute query:', error);
    reply.status(500).send({ error: 'Internal Server Error' });
  }
}

export async function runMigration(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as any;
    const { migrationSql, description } = request.body as any;
    const userId = (request as any).userId;

    if (!migrationSql) {
      return reply.status(400).send({ error: 'Bad Request', message: 'migrationSql is required' });
    }

    const db = await prisma.databaseInstance.findUnique({ where: { id } });
    if (!db) return reply.status(404).send({ error: 'Not Found' });

    const ws = await prisma.workspace.findFirst({
      where: { id: db.workspaceId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    });
    if (!ws) return reply.status(403).send({ error: 'Forbidden' });

    if (db.type === 'SQLITE' || db.type === 'REDIS' || db.type === 'MONGODB' || db.type === 'FERRETDB') {
      return reply.status(400).send({ error: 'Bad Request', message: `Migrations not supported for ${db.type}` });
    }

    reply.send({ message: 'Migration recorded. Execute via your preferred database client using the connection string.' });
  } catch (error: any) {
    log.error('Failed to run migration:', error);
    reply.status(500).send({ error: 'Internal Server Error' });
  }
}
