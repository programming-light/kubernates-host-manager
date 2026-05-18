const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';

export interface PricingPlan {
  id: string;
  name: string;
  price: number;
  billing: 'monthly' | 'yearly';
  features: string[];
  maxProjects: number;
  maxDeployments: number;
  maxClusters: number;
  storage: string;
  cpu: string;
  memory: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  features: string[];
}

export interface Service {
  id: string;
  title: string;
  description: string;
  icon: string;
  features: string[];
}

export async function fetchPricingPlans(): Promise<PricingPlan[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/plans`, {
      next: { revalidate: 3600 }, // ISR: Revalidate every hour
    });
    if (!res.ok) throw new Error('Failed to fetch pricing');
    return res.json();
  } catch {
    // Return static fallback data
    return [
      {
        id: 'starter',
        name: 'Starter',
        price: 0,
        billing: 'monthly',
        features: ['1 Project', '1 Deployment', '512MB Memory', '0.5 CPU'],
        maxProjects: 1,
        maxDeployments: 1,
        maxClusters: 0,
        storage: '1GB',
        cpu: '0.5',
        memory: '512Mi',
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 29,
        billing: 'monthly',
        features: ['10 Projects', '20 Deployments', '2GB Memory', '2 CPU', 'Custom Domains'],
        maxProjects: 10,
        maxDeployments: 20,
        maxClusters: 2,
        storage: '10GB',
        cpu: '2',
        memory: '2Gi',
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: 99,
        billing: 'monthly',
        features: ['Unlimited Projects', 'Unlimited Deployments', '8GB Memory', '4 CPU', 'Dedicated Support'],
        maxProjects: -1,
        maxDeployments: -1,
        maxClusters: -1,
        storage: '100GB',
        cpu: '4',
        memory: '8Gi',
      },
    ];
  }
}

export async function fetchProducts(): Promise<Product[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/products`, {
      next: { revalidate: 86400 }, // ISR: Revalidate every 24 hours
    });
    if (!res.ok) throw new Error('Failed to fetch products');
    return res.json();
  } catch {
    return [];
  }
}

export async function fetchServices(): Promise<Service[]> {
  return [
    {
      id: 'deployment',
      title: 'Managed Deployments',
      description: 'Deploy your applications with zero downtime using our managed Kubernetes deployment service.',
      icon: 'Rocket',
      features: ['Auto-scaling', 'Rolling updates', 'Health checks', 'Rollback support'],
    },
    {
      id: 'monitoring',
      title: 'Monitoring & Logging',
      description: 'Real-time monitoring and centralized logging for all your Kubernetes workloads.',
      icon: 'Activity',
      features: ['Real-time metrics', 'Log aggregation', 'Alert notifications', 'Custom dashboards'],
    },
    {
      id: 'ci-cd',
      title: 'CI/CD Pipelines',
      description: 'Automated build and deployment pipelines integrated with your Git repository.',
      icon: 'GitBranch',
      features: ['GitHub integration', 'Automated testing', 'Multi-stage pipelines', 'Environment promotion'],
    },
    {
      id: 'storage',
      title: 'Persistent Storage',
      description: 'Reliable persistent storage solutions for stateful applications.',
      icon: 'HardDrive',
      features: ['SSD storage', 'Automatic backups', 'Snapshot support', 'High availability'],
    },
  ];
}
