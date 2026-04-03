import { IsString, IsNumber, IsOptional, IsBoolean, Min, Max, IsUrl, ValidateNested, Type, IsEnum } from 'class-validator';

// Enum for deployment sources
export enum DeploymentSourceEnum {
  DOCKER_IMAGE = 'DOCKER_IMAGE',
  GIT_REPOSITORY = 'GIT_REPOSITORY',
  UPLOADED_TAR = 'UPLOADED_TAR',
  TEMPLATE = 'TEMPLATE',
}

// ===== Project Creation & Update DTOs =====

export class CreateProjectDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  clusterId: string;

  @IsString()
  workspaceId: string;

  // Container image (for direct deployment)
  @IsOptional()
  @IsString()
  imageUrl?: string;

  // Git repo (for building from source)
  @IsOptional()
  @IsString()
  gitUrl?: string;

  @IsOptional()
  @IsString()
  gitBranch?: string = 'main';

  @IsOptional()
  @IsString()
  buildCommand?: string;

  @IsOptional()
  @IsString()
  startCommand?: string;

  @IsOptional()
  @IsNumber()
  containerPort?: number = 3000;

  // Resource limits
  @IsOptional()
  @IsNumber()
  cpuRequest?: number = 0.1;

  @IsOptional()
  @IsNumber()
  cpuLimit?: number = 0.5;

  @IsOptional()
  @IsNumber()
  memoryRequest?: number = 128;

  @IsOptional()
  @IsNumber()
  memoryLimit?: number = 512;

  @IsOptional()
  @IsNumber()
  storageGb?: number = 0;

  // Replicas
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  replicas?: number = 1;

  // Autoscaling
  @IsOptional()
  @IsBoolean()
  autoscale?: boolean = false;

  @IsOptional()
  @IsNumber()
  @Min(1)
  minReplicas?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxReplicas?: number = 5;

  @IsOptional()
  @IsNumber()
  cpuThreshold?: number = 70;

  // Health check
  @IsOptional()
  @IsBoolean()
  healthCheckEnabled?: boolean = true;

  @IsOptional()
  @IsString()
  healthCheckPath?: string = '/health';

  @IsOptional()
  @IsNumber()
  healthCheckInterval?: number = 10;

  @IsOptional()
  @IsNumber()
  healthCheckTimeout?: number = 5;

  // Private registry credentials
  @IsOptional()
  @IsString()
  imagePullSecret?: string;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  gitBranch?: string;

  @IsOptional()
  @IsString()
  buildCommand?: string;

  @IsOptional()
  @IsString()
  startCommand?: string;

  @IsOptional()
  @IsNumber()
  containerPort?: number;

  @IsOptional()
  @IsNumber()
  cpuRequest?: number;

  @IsOptional()
  @IsNumber()
  cpuLimit?: number;

  @IsOptional()
  @IsNumber()
  memoryRequest?: number;

  @IsOptional()
  @IsNumber()
  memoryLimit?: number;

  @IsOptional()
  @IsNumber()
  replicas?: number;

  @IsOptional()
  @IsBoolean()
  autoscale?: boolean;

  @IsOptional()
  @IsNumber()
  minReplicas?: number;

  @IsOptional()
  @IsNumber()
  maxReplicas?: number;

  @IsOptional()
  @IsString()
  healthCheckPath?: string;
}

// ===== Deployment Creation DTOs =====

export class DeployFromDockerImageDto {
  @IsString()
  imageUrl: string; // e.g., docker.io/nginx:latest

  @IsOptional()
  @IsString()
  imagePullSecret?: string; // K8s secret for private registries

  @IsOptional()
  @IsString()
  message?: string; // Deployment message
}

export class DeployFromGitDto {
  @IsString()
  gitUrl: string;

  @IsOptional()
  @IsString()
  branch?: string = 'main';

  @IsOptional()
  @IsString()
  commitSha?: string;

  @IsOptional()
  @IsString()
  buildCommand?: string;

  @IsOptional()
  @IsString()
  dockerfilePath?: string = 'Dockerfile';
}

export class DeployFromTemplateDto {
  @IsString()
  templateSlug: string;

  @IsOptional()
  @IsString()
  message?: string;
}

// ===== Environment Variable DTO =====

export class CreateEnvironmentVariableDto {
  @IsString()
  key: string;

  @IsString()
  value: string;

  @IsOptional()
  @IsBoolean()
  isSecret?: boolean = false;
}

export class UpdateEnvironmentVariableDto {
  @IsString()
  value: string;

  @IsOptional()
  @IsBoolean()
  isSecret?: boolean;
}

// ===== Domain Mapping DTO =====

export class CreateDomainMappingDto {
  @IsString()
  domain: string;

  @IsOptional()
  @IsString()
  path?: string = '/';
}

// ===== Deployment Response DTOs =====

export class ProjectResponseDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: string;
  imageUrl: string;
  containerPort: number;
  cpuRequest: number;
  cpuLimit: number;
  memoryRequest: number;
  memoryLimit: number;
  replicas: number;
  autoscale: boolean;
  deploymentCount: number;
  lastDeploymentAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class DeploymentResponseDto {
  id: string;
  projectId: string;
  revision: number;
  status: string;
  imageUrl: string;
  deploymentSource: string;
  gitCommitSha: string;
  deployedBy: string;
  deployedAt: Date;
  completedAt: Date;
  logs: string;
}

export class EnvironmentVariableResponseDto {
  key: string;
  value?: string; // Don't expose secret values in response
  isSecret: boolean;
}

export class DeploymentEventResponseDto {
  id: string;
  type: string;
  message: string;
  createdAt: Date;
}

// ===== Bulk Operations DTOs =====

export class BulkUpdateEnvironmentVariablesDto {
  @ValidateNested({ each: true })
  @Type(() => CreateEnvironmentVariableDto)
  variables: CreateEnvironmentVariableDto[];
}

export class RestartDeploymentDto {
  @IsOptional()
  @IsString()
  message?: string;
}

export class RollbackDeploymentDto {
  @IsNumber()
  targetRevision: number;

  @IsOptional()
  @IsString()
  message?: string;
}

export class ScaleProjectDto {
  @IsNumber()
  @Min(1)
  @Max(100)
  replicas: number;
}

export class UpdateResourceLimitsDto {
  @IsOptional()
  @IsNumber()
  cpuRequest?: number;

  @IsOptional()
  @IsNumber()
  cpuLimit?: number;

  @IsOptional()
  @IsNumber()
  memoryRequest?: number;

  @IsOptional()
  @IsNumber()
  memoryLimit?: number;

  @IsOptional()
  @IsBoolean()
  autoscale?: boolean;

  @IsOptional()
  @IsNumber()
  minReplicas?: number;

  @IsOptional()
  @IsNumber()
  maxReplicas?: number;
}
