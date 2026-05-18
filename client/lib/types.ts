export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  DEVELOPER = 'DEVELOPER',
  VIEWER = 'VIEWER',
  BILLING = 'BILLING',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING = 'PENDING',
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  memberRole?: 'OWNER' | 'ADMIN' | 'DEVELOPER' | 'VIEWER' | 'BILLING' | 'MANAGER';
  _count?: {
    projects: number;
    members: number;
  };
}

export interface Cluster {
  id: string;
  workspaceId: string;
  name: string;
  provider: string;
  region: string;
  status: 'active' | 'inactive' | 'error';
  createdAt: string;
  updatedAt: string;
  workspace?: Workspace;
}

export interface Domain {
  id: string;
  projectId: string;
  domain: string;
  isCustom: boolean;
  isPrimary: boolean;
  sslEnabled: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  clusterId: string;
  name: string;
  slug: string;
  description?: string;
  gitUrl?: string;
  status: string;
  namespace: string;
  replicas: number;
  domains?: Domain[];
  previewUrl?: string | null;
  createdAt: string;
  updatedAt: string;
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
  startedAt: string;
  completedAt?: string;
}

export interface K8sStatus {
  connected: boolean;
  provider?: string;
  apiServer?: string;
  namespace?: string;
  error?: string;
}

export interface K8sNamespace {
  name: string;
  status: string;
  labels: Record<string, string>;
  createdAt: string;
}

export interface K8sPod {
  name: string;
  namespace: string;
  status: string;
  ready: string;
  restarts: number;
  age: string;
  containers: string[];
  node?: string;
}

export interface K8sService {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  externalIP: string[];
  ports: string[];
  selector: Record<string, string>;
}

export interface K8sNode {
  name: string;
  status: string;
  roles: string[];
  cpu?: string;
  memory?: string;
  pods?: string;
  age: string;
  version?: string;
}

export interface K8sDeployment {
  name: string;
  namespace: string;
  replicas?: number;
  readyReplicas?: number;
  availableReplicas?: number;
  status: string;
  age: string;
  images: string[];
}

export interface K8sIngress {
  name: string;
  namespace: string;
  hosts: string[];
  tls: string[][];
  age: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  interval: string;
  isActive: boolean;
  features: string[];
  limits: Record<string, number>;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: string;
  startDate: string;
  endDate?: string;
  plan?: PricingPlan;
}

export interface UserResource {
  id: string;
  userId: string;
  resourceType: string;
  allocated: number;
  used: number;
  unit: string;
}

export interface Payment {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  method: string;
  transactionId?: string;
  status: string;
  createdAt: string;
}

export interface BillingInfo {
  subscription: Subscription | null;
  resources: UserResource[];
}
