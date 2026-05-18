import { FastifySchema, RouteGenericInterface } from 'fastify';

export const errorResponse = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    message: { type: 'string' },
  },
};

export const paginationQuery = {
  type: 'object',
  properties: {
    page: { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    search: { type: 'string' },
  },
};

export const paginationResponse = {
  type: 'object',
  properties: {
    page: { type: 'integer' },
    limit: { type: 'integer' },
    total: { type: 'integer' },
    pages: { type: 'integer' },
  },
};

export const auth = {
  login: {
    tags: ['Auth'],
    description: 'Login with email and password',
    body: {
      type: 'object',
      required: ['email'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string' },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          refreshToken: { type: 'string' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              name: { type: 'string' },
              role: { type: 'string' },
            },
          },
        },
      },
      400: errorResponse,
      401: errorResponse,
    },
  } satisfies FastifySchema,

  register: {
    tags: ['Auth'],
    description: 'Register a new user',
    body: {
      type: 'object',
      required: ['email', 'name'],
      properties: {
        email: { type: 'string', format: 'email' },
        name: { type: 'string', minLength: 2 },
        password: { type: 'string', minLength: 6 },
        company: { type: 'string' },
      },
    },
    response: {
      201: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          userId: { type: 'string' },
        },
      },
      400: errorResponse,
    },
  } satisfies FastifySchema,

  sendOtp: {
    tags: ['Auth'],
    description: 'Send OTP to email for verification',
    body: {
      type: 'object',
      required: ['email'],
      properties: {
        email: { type: 'string', format: 'email' },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          requiresOTP: { type: 'boolean' },
          emailSent: { type: 'boolean' },
          devMode: { type: 'boolean' },
          otp: { type: 'string' },
          isNewUser: { type: 'boolean' },
        },
      },
      400: errorResponse,
    },
  } satisfies FastifySchema,

  verifyOtp: {
    tags: ['Auth'],
    description: 'Verify OTP code',
    body: {
      type: 'object',
      required: ['email', 'otp'],
      properties: {
        email: { type: 'string', format: 'email' },
        otp: { type: 'string', minLength: 4, maxLength: 8 },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          expiresIn: { type: 'string' },
          isNewUser: { type: 'boolean' },
          isComplete: { type: 'boolean' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              name: { type: 'string' },
              role: { type: 'string' },
              status: { type: 'string' },
            },
          },
        },
      },
      400: errorResponse,
      401: errorResponse,
    },
  } satisfies FastifySchema,

  completeProfile: {
    tags: ['Auth'],
    description: 'Complete user profile after registration',
    body: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', minLength: 2 },
        email: { type: 'string' },
        company: { type: 'string' },
        role: { type: 'string' },
        phone: { type: 'string' },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          redirectTo: { type: 'string' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              name: { type: 'string' },
              role: { type: 'string' },
              status: { type: 'string' },
            },
          },
        },
      },
      400: errorResponse,
    },
  } satisfies FastifySchema,

  refresh: {
    tags: ['Auth'],
    description: 'Refresh access token',
    body: {
      type: 'object',
      properties: {
        refreshToken: { type: 'string' },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          expiresIn: { type: 'string' },
        },
      },
      401: errorResponse,
    },
  } satisfies FastifySchema,

  me: {
    tags: ['Auth'],
    description: 'Get current user profile',
    response: {
      200: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string' },
          name: { type: 'string' },
          role: { type: 'string' },
          status: { type: 'string' },
          company: { type: 'string' },
          avatar: { type: 'string' },
          phone: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  } satisfies FastifySchema,

  devLogin: {
    tags: ['Auth'],
    description: 'Dev-only: login as any user',
    body: {
      type: 'object',
      required: ['email'],
      properties: {
        email: { type: 'string', format: 'email' },
        role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'DEVELOPER', 'VIEWER', 'BILLING'] },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          expiresIn: { type: 'integer' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              name: { type: 'string' },
              role: { type: 'string' },
              status: { type: 'string' },
            },
          },
        },
      },
    },
  } satisfies FastifySchema,
};

export const container = {
  buildDeploy: {
    tags: ['Container'],
    description: 'Build and deploy from GitHub repository',
    body: {
      type: 'object',
      required: ['name', 'gitUrl'],
      properties: {
        name: { type: 'string', minLength: 2 },
        gitUrl: { type: 'string' },
        branch: { type: 'string', default: 'main' },
        description: { type: 'string' },
        workspaceId: { type: 'string' },
        buildCommand: { type: 'string' },
        runCommand: { type: 'string' },
        rootDir: { type: 'string' },
        replicas: { type: 'integer', default: 1 },
        autoDeploy: { type: 'boolean', default: true },
        envVars: { type: 'object', additionalProperties: { type: 'string' } },
      },
    },
    response: { 200: { type: 'object', properties: { project: { type: 'object' }, buildConfig: { type: 'object' }, buildLog: { type: 'string' } } } },
  } satisfies FastifySchema,

  deployImage: {
    tags: ['Container'],
    description: 'Deploy from Docker Hub image',
    body: {
      type: 'object',
      required: ['name', 'image'],
      properties: {
        name: { type: 'string', minLength: 2 },
        image: { type: 'string', description: 'Docker image (e.g. nginx:latest)' },
        description: { type: 'string' },
        workspaceId: { type: 'string' },
        replicas: { type: 'integer', default: 1 },
        port: { type: 'integer', default: 80 },
        envVars: { type: 'object', additionalProperties: { type: 'string' } },
      },
    },
    response: { 200: { type: 'object', properties: { project: { type: 'object' }, image: { type: 'string' }, port: { type: 'integer' } } } },
  } satisfies FastifySchema,

  detectLanguage: {
    tags: ['Container'],
    description: 'Detect language/framework from GitHub repo',
    body: {
      type: 'object',
      required: ['gitUrl'],
      properties: {
        gitUrl: { type: 'string', format: 'uri' },
      },
    },
    response: { 200: { type: 'object', properties: { language: { type: 'string' }, framework: { type: 'string' }, dockerfile: { type: 'string' } } } },
  } satisfies FastifySchema,

  projectIdParam: {
    type: 'object',
    required: ['projectId'],
    properties: { projectId: { type: 'string', description: 'Project ID' } },
  },

  scale: {
    tags: ['Container'],
    description: 'Scale deployment horizontally',
    params: { type: 'object', required: ['projectId'], properties: { projectId: { type: 'string' } } },
    body: {
      type: 'object',
      required: ['replicas'],
      properties: {
        replicas: { type: 'integer', minimum: 0, maximum: 50 },
      },
    },
    response: { 200: { type: 'object', properties: { message: { type: 'string' }, replicas: { type: 'integer' } } } },
  } satisfies FastifySchema,

  updateResources: {
    tags: ['Container'],
    description: 'Update vertical resource limits',
    params: { type: 'object', required: ['projectId'], properties: { projectId: { type: 'string' } } },
    body: {
      type: 'object',
      properties: {
        cpu: { type: 'string', description: 'CPU limit (e.g. 500m, 1, 2)' },
        memory: { type: 'string', description: 'Memory limit (e.g. 512Mi, 1Gi)' },
      },
    },
    response: { 200: { type: 'object', properties: { message: { type: 'string' } } } },
  } satisfies FastifySchema,

  enableAutoScaling: {
    tags: ['Container'],
    description: 'Enable HPA autoscaling',
    params: { type: 'object', required: ['projectId'], properties: { projectId: { type: 'string' } } },
    body: {
      type: 'object',
      properties: {
        minReplicas: { type: 'integer', minimum: 1, default: 1 },
        maxReplicas: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
        targetCpuUtilization: { type: 'integer', minimum: 0, maximum: 100, default: 80 },
      },
    },
    response: { 200: { type: 'object', properties: { message: { type: 'string' }, hpa: { type: 'object' } } } },
  } satisfies FastifySchema,

  disableAutoScaling: {
    tags: ['Container'],
    description: 'Disable HPA autoscaling',
    params: { type: 'object', required: ['projectId'], properties: { projectId: { type: 'string' } } },
    response: { 200: { type: 'object', properties: { message: { type: 'string' } } } },
  } satisfies FastifySchema,

  getHPAStatus: {
    tags: ['Container'],
    description: 'Get HPA status for a project',
    params: { type: 'object', required: ['projectId'], properties: { projectId: { type: 'string' } } },
    response: { 200: { type: 'object', properties: { enabled: { type: 'boolean' }, hpa: { type: 'object' } } } },
  } satisfies FastifySchema,

  getDeploymentResources: {
    tags: ['Container'],
    description: 'Get deployment resource info',
    params: { type: 'object', required: ['projectId'], properties: { projectId: { type: 'string' } } },
    response: { 200: { type: 'object', additionalProperties: true } },
  } satisfies FastifySchema,

  getBuildLogs: {
    tags: ['Container'],
    description: 'Get build logs for a project',
    params: { type: 'object', required: ['projectId'], properties: { projectId: { type: 'string' } } },
    response: { 200: { type: 'string' } },
  } satisfies FastifySchema,

  execCommand: {
    tags: ['Container'],
    description: 'Execute command in running pod',
    params: { type: 'object', required: ['projectId'], properties: { projectId: { type: 'string' } } },
    body: {
      type: 'object',
      required: ['command'],
      properties: {
        command: { type: 'string', description: 'Shell command to execute' },
        podName: { type: 'string', description: 'Target pod (defaults to first running)' },
      },
    },
    response: { 200: { type: 'object', properties: { stdout: { type: 'string' }, stderr: { type: 'string' } } } },
  } satisfies FastifySchema,

  getPods: {
    tags: ['Container'],
    description: 'List pods for a project',
    params: { type: 'object', required: ['projectId'], properties: { projectId: { type: 'string' } } },
    response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
  } satisfies FastifySchema,

  suggestDomain: {
    tags: ['Container'],
    description: 'Get suggested auto-domain (nip.io)',
    params: { type: 'object', required: ['projectId'], properties: { projectId: { type: 'string' } } },
    response: { 200: { type: 'object', properties: { domain: { type: 'string' } } } },
  } satisfies FastifySchema,

  addCustomDomain: {
    tags: ['Container'],
    description: 'Add custom domain to project',
    params: { type: 'object', required: ['projectId'], properties: { projectId: { type: 'string' } } },
    body: {
      type: 'object',
      required: ['domain'],
      properties: {
        domain: { type: 'string', description: 'Custom domain name' },
      },
    },
    response: { 200: { type: 'object', properties: { message: { type: 'string' }, domain: { type: 'object' } } } },
  } satisfies FastifySchema,

  getProjectDomains: {
    tags: ['Container'],
    description: 'List all domains for project',
    params: { type: 'object', required: ['projectId'], properties: { projectId: { type: 'string' } } },
    response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
  } satisfies FastifySchema,

  removeDomain: {
    tags: ['Container'],
    description: 'Remove a domain from project',
    params: {
      type: 'object',
      required: ['projectId', 'domainId'],
      properties: { projectId: { type: 'string' }, domainId: { type: 'string' } },
    },
    response: { 200: { type: 'object', properties: { message: { type: 'string' } } } },
  } satisfies FastifySchema,
};

export const projects = {
  create: {
    tags: ['Projects'],
    description: 'Create a new project',
    body: {
      type: 'object',
      required: ['name', 'gitUrl'],
      properties: {
        name: { type: 'string', minLength: 2 },
        gitUrl: { type: 'string' },
        description: { type: 'string' },
        branch: { type: 'string', default: 'main' },
        buildCommand: { type: 'string' },
        runCommand: { type: 'string' },
        rootDir: { type: 'string' },
        replicas: { type: 'integer', default: 1 },
        autoDeploy: { type: 'boolean', default: true },
      },
    },
    response: { 201: { type: 'object', additionalProperties: true }, 400: errorResponse },
  } satisfies FastifySchema,

  list: {
    tags: ['Projects'],
    description: 'List projects',
    querystring: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string' },
        clusterId: { type: 'string' },
        status: { type: 'string' },
      },
    },
    response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
  } satisfies FastifySchema,

  getById: {
    tags: ['Projects'],
    description: 'Get project by ID',
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    response: { 200: { type: 'object', additionalProperties: true } },
  } satisfies FastifySchema,

  update: {
    tags: ['Projects'],
    description: 'Update project',
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    body: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        gitUrl: { type: 'string' },
        status: { type: 'string' },
        branch: { type: 'string' },
        buildCommand: { type: 'string' },
        runCommand: { type: 'string' },
        rootDir: { type: 'string' },
        replicas: { type: 'integer' },
        imageTag: { type: 'string' },
        autoDeploy: { type: 'boolean' },
      },
    },
    response: { 200: { type: 'object', additionalProperties: true } },
  } satisfies FastifySchema,

  remove: {
    tags: ['Projects'],
    description: 'Delete project',
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    response: { 200: { type: 'object', properties: { message: { type: 'string' } } } },
  } satisfies FastifySchema,
};

export const workspaces = {
  create: {
    tags: ['Workspaces'],
    description: 'Create a workspace',
    body: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', minLength: 2 },
        slug: { type: 'string' },
        description: { type: 'string' },
      },
    },
    response: { 201: { type: 'object', additionalProperties: true }, 400: errorResponse },
  } satisfies FastifySchema,

  list: {
    tags: ['Workspaces'],
    description: 'List workspaces',
    response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
  } satisfies FastifySchema,

  getById: {
    tags: ['Workspaces'],
    description: 'Get workspace by ID',
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    response: { 200: { type: 'object', additionalProperties: true } },
  } satisfies FastifySchema,

  update: {
    tags: ['Workspaces'],
    description: 'Update workspace',
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    body: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
      },
    },
    response: { 200: { type: 'object', additionalProperties: true } },
  } satisfies FastifySchema,

  remove: {
    tags: ['Workspaces'],
    description: 'Delete workspace',
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    response: { 204: { type: 'null' } },
  } satisfies FastifySchema,

  addMember: {
    tags: ['Workspaces'],
    description: 'Add member to workspace',
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    body: {
      type: 'object',
      required: ['email', 'role'],
      properties: {
        email: { type: 'string', format: 'email' },
        role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'DEVELOPER', 'VIEWER', 'BILLING'] },
      },
    },
    response: { 201: { type: 'object', additionalProperties: true } },
  } satisfies FastifySchema,

  updateMember: {
    tags: ['Workspaces'],
    description: 'Update member role',
    params: { type: 'object', required: ['id', 'memberId'], properties: { id: { type: 'string' }, memberId: { type: 'string' } } },
    body: { type: 'object', required: ['role'], properties: { role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'DEVELOPER', 'VIEWER', 'BILLING'] } } },
    response: { 200: { type: 'object', additionalProperties: true } },
  } satisfies FastifySchema,

  removeMember: {
    tags: ['Workspaces'],
    description: 'Remove member from workspace',
    params: { type: 'object', required: ['id', 'memberId'], properties: { id: { type: 'string' }, memberId: { type: 'string' } } },
    response: { 204: { type: 'null' } },
  } satisfies FastifySchema,

  getMembers: {
    tags: ['Workspaces'],
    description: 'List workspace members',
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
  } satisfies FastifySchema,
};

export const clusters = {
  create: {
    tags: ['Clusters'],
    description: 'Register a cluster',
    body: {
      type: 'object',
      required: ['name', 'provider', 'region', 'workspaceId'],
      properties: {
        name: { type: 'string' },
        provider: { type: 'string', enum: ['kubeconfig', 'eks', 'gke', 'aks', 'custom'] },
        region: { type: 'string' },
        workspaceId: { type: 'string' },
        config: { type: 'object' },
        isDefault: { type: 'boolean', default: false },
      },
    },
    response: { 201: { type: 'object', additionalProperties: true } },
  } satisfies FastifySchema,

  list: {
    tags: ['Clusters'],
    description: 'List clusters',
    querystring: { type: 'object', properties: { workspaceId: { type: 'string' } } },
    response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
  } satisfies FastifySchema,

  getById: {
    tags: ['Clusters'],
    description: 'Get cluster by ID',
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    response: { 200: { type: 'object', additionalProperties: true } },
  } satisfies FastifySchema,

  update: {
    tags: ['Clusters'],
    description: 'Update cluster',
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    body: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        config: { type: 'object' },
        isDefault: { type: 'boolean' },
      },
    },
    response: { 200: { type: 'object', additionalProperties: true } },
  } satisfies FastifySchema,

  remove: {
    tags: ['Clusters'],
    description: 'Remove cluster',
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    response: { 200: { type: 'object', properties: { message: { type: 'string' } } } },
  } satisfies FastifySchema,
};

export const deployments = {
  list: {
    tags: ['Deployments'],
    description: 'List deployments',
    querystring: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        environment: { type: 'string' },
        ...paginationQuery.properties,
      },
    },
    response: { 200: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', additionalProperties: true } }, pagination: paginationResponse } } },
  } satisfies FastifySchema,

  create: {
    tags: ['Deployments'],
    description: 'Create a deployment',
    body: {
      type: 'object',
      required: ['projectId'],
      properties: {
        projectId: { type: 'string' },
        version: { type: 'string' },
        environment: { type: 'string', default: 'production' },
        config: { type: 'object' },
      },
    },
    response: { 201: { type: 'object', additionalProperties: true } },
  } satisfies FastifySchema,

  getById: {
    tags: ['Deployments'],
    description: 'Get deployment by ID',
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    response: { 200: { type: 'object', additionalProperties: true } },
  } satisfies FastifySchema,

  rollback: {
    tags: ['Deployments'],
    description: 'Rollback deployment',
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    body: { type: 'object', properties: { version: { type: 'string' } } },
    response: { 200: { type: 'object', properties: { message: { type: 'string' }, deployment: { type: 'object' } } } },
  } satisfies FastifySchema,

  redeploy: {
    tags: ['Deployments'],
    description: 'Redeploy deployment',
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    response: { 200: { type: 'object', properties: { message: { type: 'string' } } } },
  } satisfies FastifySchema,
};

export const kubernetes = {
  getNamespaces: {
    tags: ['Kubernetes'],
    description: 'Get K8s namespaces',
    response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
  } satisfies FastifySchema,

  getNodes: {
    tags: ['Kubernetes'],
    description: 'Get cluster nodes',
    response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
  } satisfies FastifySchema,

  getPods: {
    tags: ['Kubernetes'],
    description: 'Get pods in namespace',
    querystring: { type: 'object', properties: { namespace: { type: 'string' }, labelSelector: { type: 'string' } } },
    response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
  } satisfies FastifySchema,

  getServices: {
    tags: ['Kubernetes'],
    description: 'Get services in namespace',
    querystring: { type: 'object', properties: { namespace: { type: 'string' } } },
    response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
  } satisfies FastifySchema,

  getDeployments: {
    tags: ['Kubernetes'],
    description: 'Get deployments in namespace',
    querystring: { type: 'object', properties: { namespace: { type: 'string' } } },
    response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
  } satisfies FastifySchema,

  getEvents: {
    tags: ['Kubernetes'],
    description: 'Get cluster events',
    querystring: { type: 'object', properties: { namespace: { type: 'string' } } },
    response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
  } satisfies FastifySchema,
};

export const cicd = {
  listPipelines: {
    tags: ['CI/CD'],
    description: 'List pipelines',
    querystring: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        ...paginationQuery.properties,
      },
    },
    response: { 200: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', additionalProperties: true } }, pagination: paginationResponse } } },
  } satisfies FastifySchema,

  triggerPipeline: {
    tags: ['CI/CD'],
    description: 'Trigger a new pipeline run',
    params: {
      type: 'object',
      required: ['projectId'],
      properties: {
        projectId: { type: 'string' },
      },
    },
    body: {
      type: 'object',
      properties: {
        branch: { type: 'string', default: 'main' },
      },
    },
    response: { 201: { type: 'object', additionalProperties: true } },
  } satisfies FastifySchema,

  getPipeline: {
    tags: ['CI/CD'],
    description: 'Get pipeline details',
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    response: { 200: { type: 'object', additionalProperties: true } },
  } satisfies FastifySchema,

  cancelPipeline: {
    tags: ['CI/CD'],
    description: 'Cancel pipeline',
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    response: { 200: { type: 'object', properties: { message: { type: 'string' } } } },
  } satisfies FastifySchema,
};

export const users = {
  getMe: {
    tags: ['Users'],
    description: 'Get current user profile',
    response: { 200: { type: 'object', additionalProperties: true } },
  } satisfies FastifySchema,

  updateMe: {
    tags: ['Users'],
    description: 'Update current user profile',
    body: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        company: { type: 'string' },
        phone: { type: 'string' },
        avatar: { type: 'string' },
      },
    },
    response: { 200: { type: 'object', additionalProperties: true } },
  } satisfies FastifySchema,

  list: {
    tags: ['Users'],
    description: 'List all users (admin)',
    querystring: { type: 'object', properties: { search: { type: 'string' }, page: { type: 'integer', default: 1 }, limit: { type: 'integer', default: 20 } } },
    response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
  } satisfies FastifySchema,

  getById: {
    tags: ['Users'],
    description: 'Get user by ID',
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    response: { 200: { type: 'object', additionalProperties: true } },
  } satisfies FastifySchema,

  updateRole: {
    tags: ['Users'],
    description: 'Update user role (admin)',
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    body: {
      type: 'object',
      required: ['role'],
      properties: { role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'DEVELOPER', 'VIEWER', 'BILLING'] } },
    },
    response: { 200: { type: 'object', additionalProperties: true } },
  } satisfies FastifySchema,

  updateStatus: {
    tags: ['Users'],
    description: 'Update user status (admin)',
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    body: {
      type: 'object',
      required: ['status'],
      properties: { status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING'] } },
    },
    response: { 200: { type: 'object', additionalProperties: true } },
  } satisfies FastifySchema,

  remove: {
    tags: ['Users'],
    description: 'Delete user (admin)',
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    response: { 200: { type: 'object', properties: { message: { type: 'string' } } } },
  } satisfies FastifySchema,
};

export const plans = {
  list: {
    tags: ['Plans'],
    description: 'List pricing plans',
    response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
  } satisfies FastifySchema,

  create: {
    tags: ['Plans'],
    description: 'Create pricing plan',
    body: {
      type: 'object',
      required: ['name', 'price'],
      properties: {
        name: { type: 'string' },
        price: { type: 'number' },
        description: { type: 'string' },
        interval: { type: 'string', default: 'monthly' },
        features: { type: 'object' },
        limits: { type: 'object' },
        isActive: { type: 'boolean', default: true },
        isFeatured: { type: 'boolean', default: false },
      },
    },
    response: { 201: { type: 'object', additionalProperties: true } },
  } satisfies FastifySchema,

  update: {
    tags: ['Plans'],
    description: 'Update pricing plan',
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    body: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        price: { type: 'number' },
        description: { type: 'string' },
        features: { type: 'object' },
        limits: { type: 'object' },
        isActive: { type: 'boolean' },
        isFeatured: { type: 'boolean' },
      },
    },
    response: { 200: { type: 'object', additionalProperties: true } },
  } satisfies FastifySchema,

  remove: {
    tags: ['Plans'],
    description: 'Delete pricing plan',
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    response: { 200: { type: 'object', properties: { message: { type: 'string' } } } },
  } satisfies FastifySchema,
};

export const payments = {
  initiate: {
    tags: ['Payments'],
    description: 'Initiate a payment',
    body: {
      type: 'object',
      required: ['planId', 'paymentMethod'],
      properties: {
        planId: { type: 'string' },
        paymentMethod: { type: 'string', enum: ['sslcommerz', 'stripe'] },
        couponCode: { type: 'string' },
      },
    },
    response: { 200: { type: 'object', additionalProperties: true } },
  } satisfies FastifySchema,

  subscription: {
    tags: ['Payments'],
    description: 'Get current subscription',
    response: { 200: { type: 'object', additionalProperties: true } },
  } satisfies FastifySchema,

  cancelSubscription: {
    tags: ['Payments'],
    description: 'Cancel subscription',
    response: { 200: { type: 'object', properties: { message: { type: 'string' } } } },
  } satisfies FastifySchema,

  resources: {
    tags: ['Payments'],
    description: 'Get user resource usage',
    response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
  } satisfies FastifySchema,

  webhook: {
    tags: ['Payments'],
    description: 'Payment gateway webhook',
    body: { type: 'object', properties: { tran_id: { type: 'string' }, status: { type: 'string' } } },
    response: { 200: { type: 'object', properties: { status: { type: 'string' } } } },
  } satisfies FastifySchema,

  history: {
    tags: ['Payments'],
    description: 'Get payment history',
    querystring: { type: 'object', properties: { page: { type: 'integer', default: 1 }, limit: { type: 'integer', default: 20 } } },
    response: { 200: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', additionalProperties: true } }, pagination: paginationResponse } } },
  } satisfies FastifySchema,
};
