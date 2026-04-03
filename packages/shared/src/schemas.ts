import { z } from 'zod';
import { UserRole, PlanType, DeploymentStatus } from './types';

// Authentication Schemas
export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string(),
});

// User Schemas
export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  role: z.nativeEnum(UserRole).optional(),
});

export const UpdateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(2).optional(),
  role: z.nativeEnum(UserRole).optional(),
});

// Tenant Schemas
export const CreateTenantSchema = z.object({
  name: z.string().min(2, 'Tenant name must be at least 2 characters'),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
});

// Plan Schemas
export const CreatePlanSchema = z.object({
  name: z.string().min(2),
  type: z.nativeEnum(PlanType),
  price: z.number().min(0),
  projectLimit: z.number().min(1),
  deploymentSlots: z.number().min(1),
  storageGB: z.number().min(1),
  bandwidthGB: z.number().min(1),
  features: z.array(z.string()),
});

// Cluster Schemas
export const CreateClusterSchema = z.object({
  name: z.string().min(2),
  provider: z.enum(['eks', 'gke', 'aks', 'digital-ocean', 'custom']),
  region: z.string().min(2),
  apiEndpoint: z.string().url(),
  caCertificate: z.string(),
  clientCertificate: z.string(),
  clientKey: z.string(),
  token: z.string().optional(),
});

// Project Schemas
export const CreateProjectSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  gitUrl: z.string().url('Invalid Git URL'),
  clusterId: z.string().optional(),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'archived']).optional(),
});

// Deployment Schemas
export const CreateDeploymentSchema = z.object({
  projectId: z.string(),
  commitSha: z.string(),
  commitMessage: z.string().optional(),
});

// Environment Schemas
export const CreateEnvironmentSchema = z.object({
  name: z.string().min(2),
  variables: z.record(z.string()),
});

// Domain Schemas
export const CreateDomainSchema = z.object({
  domain: z.string().min(3),
});

// Query Schemas
export const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateTenantInput = z.infer<typeof CreateTenantSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type CreateDeploymentInput = z.infer<typeof CreateDeploymentSchema>;
