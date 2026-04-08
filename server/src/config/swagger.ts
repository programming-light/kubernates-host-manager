import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'K8s Platform API',
      version: '1.0.0',
      description: 'API documentation for K8s Hosting Platform - Multi-tenant Kubernetes management',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'cuid123' },
            email: { type: 'string', example: 'user@example.com' },
            name: { type: 'string', example: 'John Doe' },
            role: { type: 'string', enum: ['admin', 'developer', 'viewer'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        AuthTokens: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            expiresIn: { type: 'number', example: 900 },
          },
        },
        Workspace: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string', example: 'My Workspace' },
            slug: { type: 'string', example: 'my-workspace' },
            ownerId: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Cluster: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            workspaceId: { type: 'string' },
            name: { type: 'string', example: 'production-cluster' },
            provider: { type: 'string', enum: ['minikube', 'kind', 'k3s', 'eks', 'gke', 'aks', 'custom'] },
            region: { type: 'string', example: 'us-east-1' },
            status: { type: 'string', enum: ['active', 'inactive', 'error'] },
            apiServer: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Project: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            workspaceId: { type: 'string' },
            clusterId: { type: 'string' },
            name: { type: 'string', example: 'my-app' },
            slug: { type: 'string', example: 'my-app' },
            description: { type: 'string' },
            gitUrl: { type: 'string' },
            status: { type: 'string', enum: ['active', 'archived'] },
            namespace: { type: 'string' },
            replicas: { type: 'number' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Deployment: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            projectId: { type: 'string' },
            version: { type: 'number' },
            status: { type: 'string', enum: ['pending', 'building', 'deploying', 'running', 'failed'] },
            imageUrl: { type: 'string' },
            commitSha: { type: 'string' },
            deployedBy: { type: 'string' },
            startedAt: { type: 'string', format: 'date-time' },
            completedAt: { type: 'string', format: 'date-time' },
          },
        },
        Namespace: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            status: { type: 'string' },
            labels: { type: 'object' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Pod: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            namespace: { type: 'string' },
            status: { type: 'string' },
            ready: { type: 'string', example: '2/2' },
            restarts: { type: 'number' },
            age: { type: 'string' },
            containers: { type: 'array', items: { type: 'string' } },
          },
        },
        Service: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            namespace: { type: 'string' },
            type: { type: 'string', enum: ['ClusterIP', 'NodePort', 'LoadBalancer'] },
            clusterIP: { type: 'string' },
            externalIP: { type: 'array', items: { type: 'string' } },
            ports: { type: 'array', items: { type: 'string' } },
          },
        },
        Node: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            status: { type: 'string', example: 'Ready' },
            roles: { type: 'array', items: { type: 'string' } },
            cpu: { type: 'string' },
            memory: { type: 'string' },
            age: { type: 'string' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Users', description: 'User management' },
      { name: 'Workspaces', description: 'Workspace management' },
      { name: 'Clusters', description: 'Kubernetes cluster management' },
      { name: 'Projects', description: 'Project management' },
      { name: 'Deployments', description: 'Deployment management' },
      { name: 'Kubernetes', description: 'Kubernetes cluster operations' },
    ],
  },
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
