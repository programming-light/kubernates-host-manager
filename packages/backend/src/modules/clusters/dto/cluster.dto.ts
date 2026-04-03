import { IsString, IsOptional, IsEnum, IsBase64, ValidateIf, IsNotEmpty } from 'class-validator';

export enum ConnectionModeDto {
  TOKEN = 'TOKEN',
  KUBECONFIG = 'KUBECONFIG',
}

export enum ClusterProviderDto {
  EKS = 'EKS',
  GKE = 'GKE',
  AKS = 'AKS',
  DIGITAL_OCEAN = 'DIGITAL_OCEAN',
  CIVO = 'CIVO',
  LINODE = 'LINODE',
  VULTR = 'VULTR',
  CUSTOM = 'CUSTOM',
  MINIKUBE = 'MINIKUBE',
  DOCKER_DESKTOP = 'DOCKER_DESKTOP',
  KIND = 'KIND',
  K3D = 'K3D',
}

export enum ClusterEnvironmentDto {
  LOCAL = 'LOCAL',
  STAGING = 'STAGING',
  PRODUCTION = 'PRODUCTION',
}

export class CreateClusterTokenDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ClusterProviderDto)
  provider: ClusterProviderDto;

  @IsString()
  @IsNotEmpty()
  region: string;

  @IsEnum(ClusterEnvironmentDto)
  @IsOptional()
  environment?: ClusterEnvironmentDto;

  @IsString()
  @IsNotEmpty()
  apiEndpoint: string;

  @IsBase64()
  @IsNotEmpty()
  caCertificateBase64: string;

  @IsString()
  @IsNotEmpty()
  token: string;
}

export class CreateClusterKubeconfigDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ClusterProviderDto)
  provider: ClusterProviderDto;

  @IsString()
  @IsNotEmpty()
  region: string;

  @IsEnum(ClusterEnvironmentDto)
  @IsOptional()
  environment?: ClusterEnvironmentDto;

  @IsBase64()
  @IsNotEmpty()
  kubeconfigBase64: string;

  @IsString()
  @IsOptional()
  defaultNamespace?: string;
}

export class UpdateClusterDto {
  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ClusterEnvironmentDto)
  @IsOptional()
  environment?: ClusterEnvironmentDto;

  // For updating credentials (token mode)
  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.token !== undefined)
  apiEndpoint?: string;

  @IsBase64()
  @IsOptional()
  @ValidateIf((o) => o.caCertificateBase64 !== undefined)
  caCertificateBase64?: string;

  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.token !== undefined)
  token?: string;

  // For updating credentials (kubeconfig mode)
  @IsBase64()
  @IsOptional()
  @ValidateIf((o) => o.kubeconfigBase64 !== undefined)
  kubeconfigBase64?: string;
}

export class TestClusterConnectionDto {
  // Empty DTO - just testing the cluster identified by ID in route
}

export class ClusterHealthCheckDto {
  // Empty DTO - just checking health of cluster by ID
}

export class ClusterResponseDto {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  provider: string;
  region: string;
  environment: string;
  status: string;
  connectionMode: string;
  kubernetesVersion?: string;
  nodeCount: number;
  lastHealthCheckAt?: Date;
  lastHealthCheckStatus?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ClusterDetailResponseDto extends ClusterResponseDto {
  // Includes all public info but NOT sensitive credentials
  // Credentials are never exposed in API responses
}

export class ClusterListResponseDto {
  id: string;
  name: string;
  provider: string;
  environment: string;
  status: string;
  nodeCount: number;
  lastHealthCheckAt?: Date;
  lastHealthCheckStatus?: string;
  createdAt: Date;
}

export class NamespacesResponseDto {
  namespaces: string[];
}

export class NodesResponseDto {
  nodes: Array<{
    name: string;
    status: string;
    roles: string[];
    cpuCapacity: string;
    memoryCapacity: string;
    kubeletVersion: string;
  }>;
}

export class IngressClassesResponseDto {
  ingressClasses: string[];
}

export class StorageClassesResponseDto {
  storageClasses: Array<{
    name: string;
    provisioner: string;
    isDefault: boolean;
  }>;
}
