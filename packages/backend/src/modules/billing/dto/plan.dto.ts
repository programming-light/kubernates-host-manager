import { IsString, IsNumber, IsBoolean, IsOptional, IsEnum, Min, Max, IsInt } from 'class-validator';
import { SupportLevel, OverageType } from '@prisma/client';

export class CreatePlanDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(0)
  monthlyPriceCents: number;

  @IsInt()
  @Min(0)
  yearlyPriceCents: number;

  @IsNumber()
  @Min(0.1)
  cpuLimit: number;

  @IsInt()
  @Min(128)
  memoryLimitMb: number;

  @IsInt()
  @Min(1)
  storageLimitGb: number;

  @IsInt()
  @Min(1)
  bandwidthLimitGb: number;

  @IsInt()
  @Min(1)
  maxApps: number;

  @IsInt()
  @Min(1)
  maxDomains: number;

  @IsBoolean()
  autoscalingEnabled: boolean;

  @IsBoolean()
  backupEnabled: boolean;

  @IsBoolean()
  databaseEnabled: boolean;

  @IsBoolean()
  redisEnabled: boolean;

  @IsEnum(SupportLevel)
  supportLevel: SupportLevel;

  @IsInt()
  @Min(0)
  trialDays: number;

  @IsBoolean()
  isPublic: boolean;

  @IsBoolean()
  isDefault: boolean;

  @IsInt()
  sortOrder: number;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  features?: string[];

  @IsOptional()
  overages?: OverageRuleDto[];
}

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyPriceCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  yearlyPriceCents?: number;

  @IsOptional()
  @IsNumber()
  cpuLimit?: number;

  @IsOptional()
  @IsInt()
  memoryLimitMb?: number;

  @IsOptional()
  @IsInt()
  storageLimitGb?: number;

  @IsOptional()
  @IsInt()
  bandwidthLimitGb?: number;

  @IsOptional()
  @IsInt()
  maxApps?: number;

  @IsOptional()
  @IsInt()
  maxDomains?: number;

  @IsOptional()
  @IsBoolean()
  autoscalingEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  backupEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  databaseEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  redisEnabled?: boolean;

  @IsOptional()
  @IsEnum(SupportLevel)
  supportLevel?: SupportLevel;

  @IsOptional()
  @IsInt()
  trialDays?: number;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  color?: string;
}

export class OverageRuleDto {
  @IsEnum(OverageType)
  overage: OverageType;

  @IsNumber()
  @Min(0)
  pricePerUnit: number;
}

export class PlanResponseDto {
  id: string;
  name: string;
  slug: string;
  description?: string;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  cpuLimit: number;
  memoryLimitMb: number;
  storageLimitGb: number;
  bandwidthLimitGb: number;
  maxApps: number;
  maxDomains: number;
  autoscalingEnabled: boolean;
  backupEnabled: boolean;
  databaseEnabled: boolean;
  redisEnabled: boolean;
  supportLevel: SupportLevel;
  trialDays: number;
  isPublic: boolean;
  isDefault: boolean;
  sortOrder: number;
  icon?: string;
  color?: string;
  features: string[];
  overages: OverageRuleDto[];
  createdAt: Date;
  updatedAt: Date;
}

export class SubscribePlanDto {
  @IsString()
  planId: string;

  @IsBoolean()
  isYearly: boolean;
}

export class WorkspacePlanResponseDto {
  workspaceId: string;
  planId: string;
  planName: string;
  monthlyPrice: number;
  yearlyPrice: number;
  billingCycle: 'monthly' | 'yearly';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  status: string;
  resourceUsage: {
    cpuUsed: number;
    cpuLimit: number;
    memoryUsedMb: number;
    memoryLimitMb: number;
    storageUsedGb: number;
    storageLimitGb: number;
  };
}

export class PlanLimitsDto {
  cpuLimit: number;
  memoryLimitMb: number;
  storageLimitGb: number;
  bandwidthLimitGb: number;
  maxApps: number;
  maxDomains: number;
  autoscalingEnabled: boolean;
  backupEnabled: boolean;
  databaseEnabled: boolean;
  redisEnabled: boolean;
  supportLevel: SupportLevel;
}
