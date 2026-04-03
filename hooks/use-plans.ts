import useSWR from 'swr';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export interface Plan {
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
  supportLevel: string;
  trialDays: number;
  isPublic: boolean;
  isDefault: boolean;
  sortOrder: number;
  icon?: string;
  color?: string;
  features: string[];
  overages: Array<{ overage: string; pricePerUnit: number }>;
  createdAt: Date;
  updatedAt: Date;
}

async function fetcher(url: string) {
  const res = await fetch(url, {
    credentials: 'include',
  });

  if (!res.ok) {
    const error = new Error('Failed to fetch');
    throw error;
  }

  return res.json();
}

export function usePlans() {
  const { data, error, isLoading, mutate } = useSWR<{ plans: Plan[] }>(
    `${API_BASE}/billing/plans`,
    fetcher,
  );

  return {
    plans: data?.plans ?? [],
    isLoading,
    error,
    mutate,
  };
}

export function usePlan(planId: string) {
  const { data, error, isLoading, mutate } = useSWR<{ plan: Plan }>(
    planId ? `${API_BASE}/billing/plans/${planId}` : null,
    fetcher,
  );

  return {
    plan: data?.plan,
    isLoading,
    error,
    mutate,
  };
}

export function usePublicPlans() {
  const { data, error, isLoading, mutate } = useSWR<{ plans: Plan[] }>(
    `${API_BASE}/billing/plans/public`,
    fetcher,
  );

  return {
    plans: data?.plans ?? [],
    isLoading,
    error,
    mutate,
  };
}

// API functions for mutations
export async function createPlan(planData: Partial<Plan>) {
  const res = await fetch(`${API_BASE}/billing/plans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(planData),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to create plan');
  }

  return res.json();
}

export async function updatePlan(planId: string, planData: Partial<Plan>) {
  const res = await fetch(`${API_BASE}/billing/plans/${planId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(planData),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to update plan');
  }

  return res.json();
}

export async function deletePlan(planId: string) {
  const res = await fetch(`${API_BASE}/billing/plans/${planId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to delete plan');
  }

  return res.json();
}
