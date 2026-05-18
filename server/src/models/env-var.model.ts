export interface EnvVar {
  key: string;
  value: string;
  isSecret?: boolean;
}

export interface EnvFile {
  [key: string]: EnvVar;
}

export interface DeployConfig {
  image: string;
  tag?: string;
  port?: number;
  replicas?: number;
  env?: Array<{ name: string; value: string }>;
  resources?: {
    limits?: { cpu: string; memory: string };
    requests?: { cpu: string; memory: string };
  };
  domain?: string;
  healthCheck?: {
    path: string;
    port: number;
  };
}
