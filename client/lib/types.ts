export enum UserRole {
  ADMIN = 'admin',
  DEVELOPER = 'developer',
  VIEWER = 'viewer',
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
