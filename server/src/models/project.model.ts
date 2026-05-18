export interface ProjectProfile {
  id: string;
  name: string;
  slug: string;
  description?: string;
  gitUrl: string;
  status: string;
  clusterId: string;
  namespace: string;
  replicas: number;
  currentImageTag?: string;
  autoDeploy: boolean;
  workspaceId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectDto {
  name: string;
  description?: string;
  gitUrl: string;
  replicas?: number;
  autoDeploy?: boolean;
  deploymentConfig?: {
    branch?: string;
  };
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  gitUrl?: string;
  status?: string;
  replicas?: number;
}

export interface ProjectEnvDto {
  key?: string;
  value?: string;
  isSecret?: boolean;
  envContent?: string;
}

export interface AddDomainDto {
  domain: string;
  isCustom?: boolean;
  isPrimary?: boolean;
}

export interface ManagedNamespaceDto {
  id: string;
  projectId: string;
  name: string;
  status: string;
  labels?: any;
  resourceQuota?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResourceQuotaDto {
  cpu: string;
  memory: string;
  storage: string;
  pods: number;
  services: number;
  configmaps: number;
  secrets: number;
}
