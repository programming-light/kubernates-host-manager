// User and Authentication Types
export enum UserRole {
  ADMIN = 'admin',
  DEVELOPER = 'developer',
  VIEWER = 'viewer',
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Tenant and Workspace
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Plans and Billing
export enum PlanType {
  FREE = 'free',
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}

export interface Plan {
  id: string;
  name: string;
  type: PlanType;
  price: number;
  projectLimit: number;
  deploymentSlots: number;
  storageGB: number;
  bandwidthGB: number;
  features: string[];
  createdAt: Date;
}

export interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  status: 'active' | 'cancelled' | 'pending';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelledAt: Date | null;
}

// Kubernetes Cluster
export interface ClusterCredentials {
  clusterId: string;
  apiEndpoint: string;
  caCertificate: string;
  clientCertificate: string;
  clientKey: string;
  token?: string;
}

export interface Cluster {
  id: string;
  name: string;
  provider: 'eks' | 'gke' | 'aks' | 'digital-ocean' | 'custom';
  region: string;
  status: 'active' | 'inactive' | 'error';
  createdAt: Date;
  updatedAt: Date;
}

// Projects and Deployments
export interface Project {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string;
  gitUrl: string;
  status: 'active' | 'archived';
  clusterId: string;
  namespace: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum DeploymentStatus {
  QUEUED = 'queued',
  BUILDING = 'building',
  DEPLOYING = 'deploying',
  RUNNING = 'running',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
}

export interface Deployment {
  id: string;
  projectId: string;
  version: number;
  status: DeploymentStatus;
  commitSha: string;
  commitMessage: string;
  deployedBy: string;
  startedAt: Date;
  completedAt?: Date;
  logs?: string;
  createdAt: Date;
}

export interface Environment {
  id: string;
  projectId: string;
  name: string;
  variables: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

// Domain and SSL
export interface Domain {
  id: string;
  projectId: string;
  domain: string;
  status: 'pending' | 'verified' | 'error';
  dnsRecord?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SSLCertificate {
  id: string;
  domainId: string;
  provider: 'letsencrypt' | 'custom';
  issuer: string;
  expiresAt: Date;
  status: 'active' | 'expired' | 'renewing';
  createdAt: Date;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Audit Log
export interface AuditLog {
  id: string;
  tenantId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes: Record<string, unknown>;
  ipAddress: string;
  createdAt: Date;
}
