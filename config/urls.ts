/**
 * Centralized URL configuration for the entire monorepo
 * All app/server URLs should be referenced from here
 */

const isDev = process.env.NODE_ENV !== 'production';

export const URLS = {
  // Server (Express API)
  SERVER: {
    URL: process.env.SERVER_URL || 'http://localhost:3001',
    PORT: process.env.PORT || '3001',
    API_BASE: process.env.SERVER_URL ? `${process.env.SERVER_URL}/api/v1` : 'http://localhost:3001/api/v1',
    API_DOCS: process.env.SERVER_URL ? `${process.env.SERVER_URL}/api-docs` : 'http://localhost:3001/api-docs',
    HEALTH: process.env.SERVER_URL ? `${process.env.SERVER_URL}/api/health` : 'http://localhost:3001/api/health',
  },

  // Client (Next.js Dashboard)
  CLIENT: {
    URL: process.env.CLIENT_URL || 'http://localhost:3000',
    PORT: '3000',
    DASHBOARD: process.env.CLIENT_URL ? `${process.env.CLIENT_URL}/dashboard` : 'http://localhost:3000/dashboard',
  },

  // Public Client (Marketing Site)
  PUBLIC_CLIENT: {
    URL: process.env.PUBLIC_CLIENT_URL || 'http://localhost:3002',
    PORT: '3002',
  },

  // API URL for client-side requests (used by Next.js apps)
  API: {
    BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    API_V1: process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1` : 'http://localhost:3001/api/v1',
    SOCKET_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },

  // Kubernetes
  K8S: {
    K3S_URL: process.env.K3S_URL || 'https://localhost:6443',
    KUBERNETES_API: process.env.KUBERNETES_API || 'https://localhost:6443',
  },

  // Docker
  DOCKER: {
    REGISTRY: process.env.DOCKER_REGISTRY || 'localhost:5000',
  },
} as const;

export default URLS;
