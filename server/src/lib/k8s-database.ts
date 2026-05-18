import * as k8s from '@kubernetes/client-node';
import { k8sConfigManager } from './k8s-config.js';
import { emitK8sEvent } from './socket.js';
import log from './logger.js';

export type DatabaseType = 'POSTGRESQL' | 'MYSQL' | 'MARIADB' | 'MONGODB' | 'FERRETDB' | 'REDIS' | 'SQLITE';

interface DbSpec {
  image: string;
  port: number;
  dataDir: string;
  envVars: (dbName: string, dbUser: string, dbPassword: string) => k8s.V1EnvVar[];
}

const DB_SPECS: Record<DatabaseType, DbSpec> = {
  POSTGRESQL: {
    image: 'postgres:16-alpine',
    port: 5432,
    dataDir: '/var/lib/postgresql/data',
    envVars: (dbName, dbUser, dbPassword) => [
      { name: 'POSTGRES_DB', value: dbName },
      { name: 'POSTGRES_USER', value: dbUser },
      { name: 'POSTGRES_PASSWORD', value: dbPassword },
    ],
  },
  MYSQL: {
    image: 'mysql:8.0',
    port: 3306,
    dataDir: '/var/lib/mysql',
    envVars: (dbName, dbUser, dbPassword) => [
      { name: 'MYSQL_DATABASE', value: dbName },
      { name: 'MYSQL_USER', value: dbUser },
      { name: 'MYSQL_PASSWORD', value: dbPassword },
      { name: 'MYSQL_ROOT_PASSWORD', value: dbPassword },
    ],
  },
  MARIADB: {
    image: 'mariadb:11.4',
    port: 3306,
    dataDir: '/var/lib/mysql',
    envVars: (dbName, dbUser, dbPassword) => [
      { name: 'MARIADB_DATABASE', value: dbName },
      { name: 'MARIADB_USER', value: dbUser },
      { name: 'MARIADB_PASSWORD', value: dbPassword },
      { name: 'MARIADB_ROOT_PASSWORD', value: dbPassword },
    ],
  },
  MONGODB: {
    image: 'mongo:7',
    port: 27017,
    dataDir: '/data/db',
    envVars: (dbName, dbUser, dbPassword) => [
      { name: 'MONGO_INITDB_DATABASE', value: dbName },
      { name: 'MONGO_INITDB_ROOT_USERNAME', value: dbUser },
      { name: 'MONGO_INITDB_ROOT_PASSWORD', value: dbPassword },
    ],
  },
  FERRETDB: {
    image: 'ferretdb/ferretdb:2',
    port: 27017,
    dataDir: '/var/lib/postgresql/data',
    envVars: (_dbName, _dbUser, _dbPassword) => [],
  },
  REDIS: {
    image: 'redis:7-alpine',
    port: 6379,
    dataDir: '/data',
    envVars: (_dbName, _dbUser, dbPassword) => [
      { name: 'REDIS_PASSWORD', value: dbPassword },
    ],
  },
  SQLITE: {
    image: 'alpine:latest',
    port: 0,
    dataDir: '/data',
    envVars: () => [],
  },
};

function buildConnectionString(type: DatabaseType, serviceName: string, namespace: string, port: number, dbName: string, dbUser: string, dbPassword: string): string {
  const host = `${serviceName}.${namespace}.svc.cluster.local`;
  switch (type) {
    case 'POSTGRESQL':
      return `postgresql://${dbUser}:${dbPassword}@${host}:${port}/${dbName}`;
    case 'MYSQL':
    case 'MARIADB':
      return `mysql://${dbUser}:${dbPassword}@${host}:${port}/${dbName}`;
    case 'MONGODB':
      return `mongodb://${dbUser}:${dbPassword}@${host}:${port}/${dbName}?authSource=admin`;
    case 'FERRETDB':
      return `mongodb://${dbUser}:${dbPassword}@${host}:${port}/${dbName}?authSource=admin`;
    case 'REDIS':
      return `redis://:${dbPassword}@${host}:${port}/0`;
    case 'SQLITE':
      return `sqlite:///${serviceName}-pv/data/db.sqlite`;
    default:
      return '';
  }
}

export class K8sDatabaseManager {
  private kubeConfig: k8s.KubeConfig | null = null;

  private async getApi(): Promise<{
    coreApi: k8s.CoreV1Api;
    appsApi: k8s.AppsV1Api;
    networkingApi: k8s.NetworkingV1Api;
  }> {
    const config = await k8sConfigManager.loadConfig();
    if (!config.connected || !config.kubeConfig) {
      throw new Error('Kubernetes not connected');
    }
    this.kubeConfig = config.kubeConfig as k8s.KubeConfig;
    return {
      coreApi: k8sConfigManager.coreApi,
      appsApi: k8sConfigManager.appsApi,
      networkingApi: k8sConfigManager.networkingApi,
    };
  }

  private async waitForPodReady(serviceName: string, namespace: string, type: DatabaseType, timeoutMs = 5000): Promise<void> {
    const start = Date.now();
    const { appsApi } = await this.getApi();
    while (Date.now() - start < timeoutMs) {
      try {
        if (type === 'SQLITE' || type === 'REDIS') {
          const dep = await appsApi.readNamespacedDeployment(serviceName, namespace);
          const ready = dep.body.status?.readyReplicas || 0;
          if (ready > 0) return;
        } else {
          const sts = await appsApi.readNamespacedStatefulSet(serviceName, namespace);
          const ready = sts.body.status?.readyReplicas || 0;
          if (ready > 0) return;
        }
      } catch (error) { log.warn(`[k8s-database] waitForPodReady check failed: ${(error as Error).message}`); }
      await new Promise(r => setTimeout(r, 500));
    }
  }

  async provisionDatabase(params: {
    instanceId: string;
    name: string;
    type: DatabaseType;
    namespace: string;
    dbName: string;
    dbUser: string;
    dbPassword: string;
    storageSize: string;
    storageClass?: string;
  }): Promise<{ serviceName: string; connectionString: string }> {
    const { coreApi, appsApi } = await this.getApi();
    const spec = DB_SPECS[params.type];
    const safeName = params.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const serviceName = `db-${safeName}`;
    const labels = {
      'managed-by': 'k8s-platform',
      'db-instance': params.instanceId,
      'db-type': params.type.toLowerCase(),
    };

    await this.ensureNamespace(params.namespace);

    const secretName = `${serviceName}-credentials`;
    const secretData: Record<string, string> = {
      database: params.dbName,
      username: params.dbUser,
      password: params.dbPassword,
    };
    const secret: k8s.V1Secret = {
      metadata: { name: secretName, namespace: params.namespace, labels },
      type: 'Opaque',
      data: Object.fromEntries(
        Object.entries(secretData).map(([k, v]) => [k, Buffer.from(v).toString('base64')])
      ),
    };

    try {
      await coreApi.replaceNamespacedSecret(secretName, params.namespace, secret);
    } catch {
      await coreApi.createNamespacedSecret(params.namespace, secret);
    }

    if (params.type === 'SQLITE') {
      const deployment: k8s.V1Deployment = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: serviceName, namespace: params.namespace, labels },
        spec: {
          replicas: 1,
          selector: { matchLabels: { app: serviceName } },
          template: {
            metadata: { labels: { app: serviceName, ...labels } },
            spec: {
              containers: [{
                name: 'sqlite',
                image: 'nixery.dev/shell/sqlite',
                command: ['sh', '-c', 'sleep infinity'],
                volumeMounts: [{ name: 'data', mountPath: '/data' }],
              }],
              volumes: [{
                name: 'data',
                persistentVolumeClaim: { claimName: `${serviceName}-pvc` },
              }],
            },
          },
        },
      };

      const pvc: k8s.V1PersistentVolumeClaim = {
        metadata: { name: `${serviceName}-pvc`, namespace: params.namespace, labels },
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: { requests: { storage: params.storageSize } },
          storageClassName: params.storageClass || undefined,
        },
      };

      try {
        await coreApi.replaceNamespacedPersistentVolumeClaim(`${serviceName}-pvc`, params.namespace, pvc);
      } catch {
        await coreApi.createNamespacedPersistentVolumeClaim(params.namespace, pvc);
      }

      try {
        await appsApi.replaceNamespacedDeployment(serviceName, params.namespace, deployment);
      } catch {
        await appsApi.createNamespacedDeployment(params.namespace, deployment);
      }

      return {
        serviceName,
        connectionString: `sqlite:///${params.namespace}/${serviceName}/data/db.sqlite`,
      };
    }

    const env = spec.envVars(params.dbName, params.dbUser, params.dbPassword);

    if (params.type === 'REDIS') {
      const redisPasswordEnv = env.find(e => e.name === 'REDIS_PASSWORD');
      const deployment: k8s.V1Deployment = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: serviceName, namespace: params.namespace, labels },
        spec: {
          replicas: 1,
          selector: { matchLabels: { app: serviceName } },
          template: {
            metadata: { labels: { app: serviceName, ...labels } },
            spec: {
              containers: [{
                name: 'redis',
                image: spec.image,
                args: redisPasswordEnv
                  ? ['redis-server', '--requirepass', params.dbPassword, '--appendonly', 'yes']
                  : ['redis-server', '--appendonly', 'yes'],
                ports: [{ containerPort: spec.port }],
                volumeMounts: [{ name: 'data', mountPath: spec.dataDir }],
              }],
              volumes: [{
                name: 'data',
                persistentVolumeClaim: { claimName: `${serviceName}-pvc` },
              }],
            },
          },
        },
      };

      const pvc: k8s.V1PersistentVolumeClaim = {
        metadata: { name: `${serviceName}-pvc`, namespace: params.namespace, labels },
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: { requests: { storage: params.storageSize } },
          storageClassName: params.storageClass || undefined,
        },
      };

      try {
        await coreApi.replaceNamespacedPersistentVolumeClaim(`${serviceName}-pvc`, params.namespace, pvc);
      } catch {
        await coreApi.createNamespacedPersistentVolumeClaim(params.namespace, pvc);
      }

      try {
        await appsApi.replaceNamespacedDeployment(serviceName, params.namespace, deployment);
      } catch {
        await appsApi.createNamespacedDeployment(params.namespace, deployment);
      }
    } else if (params.type === 'FERRETDB') {
      const pgUser = params.dbUser;
      const pgPassword = params.dbPassword;
      const pgDb = params.dbName;
      const statefulSet: k8s.V1StatefulSet = {
        apiVersion: 'apps/v1',
        kind: 'StatefulSet',
        metadata: { name: serviceName, namespace: params.namespace, labels },
        spec: {
          serviceName,
          replicas: 1,
          selector: { matchLabels: { app: serviceName } },
          template: {
            metadata: { labels: { app: serviceName, ...labels } },
            spec: {
              containers: [
                {
                  name: 'postgresql',
                  image: 'postgres:16-alpine',
                  ports: [{ containerPort: 5432 }],
                  env: [
                    { name: 'POSTGRES_DB', value: pgDb },
                    { name: 'POSTGRES_USER', value: pgUser },
                    { name: 'POSTGRES_PASSWORD', value: pgPassword },
                  ],
                  volumeMounts: [{ name: 'data', mountPath: '/var/lib/postgresql/data' }],
                },
                {
                  name: 'ferretdb',
                  image: spec.image,
                  ports: [{ containerPort: spec.port }],
                  env: [
                    {
                      name: 'FERRETDB_POSTGRESQL_URL',
                      value: `postgres://${pgUser}:${pgPassword}@localhost:5432/${pgDb}`,
                    },
                  ],
                },
              ],
            },
          },
          volumeClaimTemplates: [{
            metadata: { name: 'data' },
            spec: {
              accessModes: ['ReadWriteOnce'],
              resources: { requests: { storage: params.storageSize } },
              storageClassName: params.storageClass || undefined,
            },
          }],
        },
      };

      try {
        await appsApi.replaceNamespacedStatefulSet(serviceName, params.namespace, statefulSet);
        log.info(`Updated StatefulSet ${serviceName} in ${params.namespace}`);
      } catch {
        await appsApi.createNamespacedStatefulSet(params.namespace, statefulSet);
        log.info(`Created StatefulSet ${serviceName} in ${params.namespace}`);
      }
    } else {
      const statefulSet: k8s.V1StatefulSet = {
        apiVersion: 'apps/v1',
        kind: 'StatefulSet',
        metadata: { name: serviceName, namespace: params.namespace, labels },
        spec: {
          serviceName,
          replicas: 1,
          selector: { matchLabels: { app: serviceName } },
          template: {
            metadata: { labels: { app: serviceName, ...labels } },
            spec: {
              containers: [{
                name: params.type.toLowerCase(),
                image: spec.image,
                ports: [{ containerPort: spec.port }],
                env,
                volumeMounts: [{ name: 'data', mountPath: spec.dataDir }],
              }],
            },
          },
          volumeClaimTemplates: [{
            metadata: { name: 'data' },
            spec: {
              accessModes: ['ReadWriteOnce'],
              resources: { requests: { storage: params.storageSize } },
              storageClassName: params.storageClass || undefined,
            },
          }],
        },
      };

      try {
        await appsApi.replaceNamespacedStatefulSet(serviceName, params.namespace, statefulSet);
        log.info(`Updated StatefulSet ${serviceName} in ${params.namespace}`);
      } catch {
        await appsApi.createNamespacedStatefulSet(params.namespace, statefulSet);
        log.info(`Created StatefulSet ${serviceName} in ${params.namespace}`);
      }
    }

    const svc: k8s.V1Service = {
      metadata: { name: serviceName, namespace: params.namespace, labels },
      spec: {
        selector: { app: serviceName },
        ports: [{ port: spec.port, targetPort: spec.port, protocol: 'TCP', name: 'db' }],
        type: 'ClusterIP',
      },
    };

    try {
      await coreApi.replaceNamespacedService(serviceName, params.namespace, svc);
    } catch {
      await coreApi.createNamespacedService(params.namespace, svc);
    }

    emitK8sEvent('k8s:database:provisioning', {
      name: params.name,
      type: params.type,
      namespace: params.namespace,
      instanceId: params.instanceId,
      status: 'PROVISIONING',
    }, params.namespace);

    this.waitForPodReady(serviceName, params.namespace, params.type, 5000).then(() => {
      emitK8sEvent('k8s:database:running', {
        name: params.name,
        type: params.type,
        namespace: params.namespace,
        instanceId: params.instanceId,
        status: 'RUNNING',
      }, params.namespace);
    });

    const connectionString = buildConnectionString(
      params.type, serviceName, params.namespace, spec.port,
      params.dbName, params.dbUser, params.dbPassword
    );

    return { serviceName, connectionString };
  }

  async deleteDatabase(name: string, namespace: string, type: DatabaseType): Promise<void> {
    const { coreApi, appsApi } = await this.getApi();
    const safeName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const serviceName = `db-${safeName}`;

    const deleteOpts = new k8s.V1DeleteOptions();

    try {
      if (type === 'SQLITE' || type === 'REDIS') {
        await appsApi.deleteNamespacedDeployment(serviceName, namespace, undefined, undefined, undefined, undefined, undefined, deleteOpts);
      } else {
        await appsApi.deleteNamespacedStatefulSet(serviceName, namespace, undefined, undefined, undefined, undefined, undefined, deleteOpts);
      }
    } catch (e: any) {
      if (e.response?.statusCode !== 404) log.warn(`Failed to delete workload ${serviceName}: ${e.message}`);
    }

    try {
      await coreApi.deleteNamespacedService(serviceName, namespace, undefined, undefined, undefined, undefined, undefined, deleteOpts);
    } catch (e: any) {
      if (e.response?.statusCode !== 404) log.warn(`Failed to delete service ${serviceName}: ${e.message}`);
    }

    try {
      await coreApi.deleteNamespacedSecret(`${serviceName}-credentials`, namespace, undefined, undefined, undefined, undefined, undefined, deleteOpts);
    } catch (e: any) {
      if (e.response?.statusCode !== 404) log.warn(`Failed to delete secret: ${e.message}`);
    }

    try {
      await coreApi.deleteNamespacedPersistentVolumeClaim(`${serviceName}-pvc`, namespace, undefined, undefined, undefined, undefined, undefined, deleteOpts);
    } catch (e: any) {
      if (e.response?.statusCode !== 404) log.warn(`Failed to delete PVC: ${e.message}`);
    }
  }

  async getDatabaseStatus(namespace: string, name: string, type: DatabaseType): Promise<string> {
    const { coreApi, appsApi } = await this.getApi();
    const safeName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const serviceName = `db-${safeName}`;

    try {
      if (type === 'SQLITE' || type === 'REDIS') {
        const dep = await appsApi.readNamespacedDeployment(serviceName, namespace);
        const ready = dep.body.status?.readyReplicas || 0;
        return ready > 0 ? 'RUNNING' : 'PROVISIONING';
      } else {
        const sts = await appsApi.readNamespacedStatefulSet(serviceName, namespace);
        const ready = sts.body.status?.readyReplicas || 0;
        return ready > 0 ? 'RUNNING' : 'PROVISIONING';
      }
    } catch (e: any) {
      if (e.response?.statusCode === 404) return 'DELETED';
      return 'FAILED';
    }
  }

  private async ensureNamespace(namespace: string): Promise<void> {
    const { coreApi } = await this.getApi();
    try {
      await coreApi.readNamespace(namespace);
    } catch {
      await coreApi.createNamespace({
        metadata: {
          name: namespace,
          labels: { 'managed-by': 'k8s-platform', 'purpose': 'databases' },
        },
      });
      log.info(`Created namespace for databases: ${namespace}`);
    }
  }

  async resizeStorage(name: string, namespace: string, type: DatabaseType, size: string): Promise<void> {
    const { coreApi } = await this.getApi();
    const safeName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const serviceName = `db-${safeName}`;
    const pvcName = `${serviceName}-pvc`;

    try {
      const pvc = await coreApi.readNamespacedPersistentVolumeClaim(pvcName, namespace);
      pvc.body.spec!.resources!.requests!['storage'] = size as any;
      await coreApi.replaceNamespacedPersistentVolumeClaim(pvcName, namespace, pvc.body);
      log.info(`Resized PVC ${pvcName} to ${size}`);
    } catch (e: any) {
      if (e.response?.statusCode === 404) {
        log.warn(`PVC ${pvcName} not found, attempting StatefulSet volumeClaimTemplate resize`);
        const { appsApi } = await this.getApi();
        if (type !== 'SQLITE' && type !== 'REDIS') {
          try {
            const sts = await appsApi.readNamespacedStatefulSet(serviceName, namespace);
            if (sts.body.spec?.volumeClaimTemplates?.length) {
              sts.body.spec.volumeClaimTemplates[0].spec!.resources!.requests!['storage'] = size as any;
              await appsApi.replaceNamespacedStatefulSet(serviceName, namespace, sts.body);
              log.info(`Updated StatefulSet ${serviceName} volumeClaimTemplate to ${size}`);
            }
          } catch (error) { log.warn(`[k8s-database] resizeStorage StatefulSet update failed: ${(error as Error).message}`); }
        }
      }
    }
  }

  async addDatabaseUser(name: string, namespace: string, type: DatabaseType, username: string, password: string): Promise<void> {
    const { coreApi } = await this.getApi();
    const safeName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const secretName = `db-${safeName}-credentials`;

    const existing: any = {};
    try {
      const secret = await coreApi.readNamespacedSecret(secretName, namespace);
      if (secret.body.data) {
        for (const [k, v] of Object.entries(secret.body.data)) {
          existing[k] = v;
        }
      }
    } catch (error) { log.warn(`[k8s-database] Failed to read secret ${secretName}: ${(error as Error).message}`); }

    existing[`${username}_password`] = Buffer.from(password).toString('base64');
    existing[`${username}_username`] = Buffer.from(username).toString('base64');

    try {
      await coreApi.replaceNamespacedSecret(secretName, namespace, {
        metadata: { name: secretName, namespace },
        data: existing,
      });
    } catch {
      await coreApi.createNamespacedSecret(namespace, {
        metadata: { name: secretName, namespace },
        data: existing,
      });
    }
    log.info(`Added user ${username} to secret ${secretName}`);
  }

  async updateNetworkPolicy(name: string, namespace: string, type: DatabaseType, whitelist: { cidr: string }[]): Promise<void> {
    const { networkingApi } = await this.getApi();
    const safeName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const policyName = `db-${safeName}-network-policy`;

    if (!whitelist.length) {
      try {
        await networkingApi.deleteNamespacedNetworkPolicy(policyName, namespace);
        log.info(`Deleted network policy ${policyName}`);
      } catch (error) { log.warn(`[k8s-database] Failed to delete network policy ${policyName}: ${(error as Error).message}`); }
      return;
    }

    const policy: any = {
      metadata: { name: policyName, namespace },
      spec: {
        podSelector: { matchLabels: { app: `db-${safeName}` } },
        policyTypes: ['Ingress'],
        ingress: [{
          from: whitelist.map((w) => ({
            ipBlock: { cidr: w.cidr },
          })),
          ports: [{ port: DB_SPECS[type].port }],
        }],
      },
    };

    try {
      await networkingApi.replaceNamespacedNetworkPolicy(policyName, namespace, policy);
    } catch {
      await networkingApi.createNamespacedNetworkPolicy(namespace, policy);
    }
    log.info(`Updated network policy ${policyName} with ${whitelist.length} entries`);
  }
}

export const k8sDatabaseManager = new K8sDatabaseManager();
