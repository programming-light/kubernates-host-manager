import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Workspace, Cluster, Project, Deployment, PricingPlan, Subscription, BillingInfo } from '@/lib/types';
import api from '@/lib/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  initialized: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
  initAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      loading: true,
      initialized: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setLoading: (loading) => set({ loading }),
      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          document.cookie = 'accessToken=; Max-Age=0; path=/';
          document.cookie = 'refreshToken=; Max-Age=0; path=/';
        }
        set({ user: null, isAuthenticated: false, loading: false });
      },
      initAuth: async () => {
        if (get().initialized) return;
        
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        if (!token) {
          set({ user: null, isAuthenticated: false, loading: false, initialized: true });
          return;
        }
        try {
          const response = await api.get('/auth/me');
          if (response.ok) {
            const user = await response.json();
            set({ user, isAuthenticated: true, loading: false, initialized: true });
          } else {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            set({ user: null, isAuthenticated: false, loading: false, initialized: true });
          }
        } catch {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          set({ user: null, isAuthenticated: false, loading: false, initialized: true });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);

interface WorkspaceState {
  workspaces: Workspace[];
  setWorkspaces: (workspaces: Workspace[]) => void;
  addWorkspace: (workspace: Workspace) => void;
  updateWorkspace: (id: string, data: Partial<Workspace>) => void;
  removeWorkspace: (id: string) => void;
}

interface ClusterState {
  clusters: Cluster[];
  setClusters: (clusters: Cluster[]) => void;
  addCluster: (cluster: Cluster) => void;
  updateCluster: (id: string, data: Partial<Cluster>) => void;
  removeCluster: (id: string) => void;
}

interface ProjectState {
  projects: Project[];
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, data: Partial<Project>) => void;
  removeProject: (id: string) => void;
}

interface DeploymentState {
  deployments: Deployment[];
  setDeployments: (deployments: Deployment[]) => void;
  addDeployment: (deployment: Deployment) => void;
  updateDeployment: (id: string, data: Partial<Deployment>) => void;
}

interface BillingState {
  plans: PricingPlan[];
  subscription: Subscription | null;
  resources: { resourceType: string; allocated: number; used: number; unit: string }[];
  setPlans: (plans: PricingPlan[]) => void;
  setSubscription: (subscription: Subscription | null) => void;
  setResources: (resources: { resourceType: string; allocated: number; used: number; unit: string }[]) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: [],
  setWorkspaces: (workspaces) => set({ workspaces }),
  addWorkspace: (workspace) => set((state) => ({ workspaces: [...state.workspaces, workspace] })),
  updateWorkspace: (id, data) => set((state) => ({
    workspaces: state.workspaces.map((ws) => (ws.id === id ? { ...ws, ...data } : ws)),
  })),
  removeWorkspace: (id) => set((state) => ({
    workspaces: state.workspaces.filter((ws) => ws.id !== id),
  })),
}));

export const useClusterStore = create<ClusterState>((set) => ({
  clusters: [],
  setClusters: (clusters) => set({ clusters }),
  addCluster: (cluster) => set((state) => ({ clusters: [...state.clusters, cluster] })),
  updateCluster: (id, data) => set((state) => ({
    clusters: state.clusters.map((c) => (c.id === id ? { ...c, ...data } : c)),
  })),
  removeCluster: (id) => set((state) => ({
    clusters: state.clusters.filter((c) => c.id !== id),
  })),
}));

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  setProjects: (projects) => set({ projects }),
  addProject: (project) => set((state) => ({ projects: [...state.projects, project] })),
  updateProject: (id, data) => set((state) => ({
    projects: state.projects.map((p) => (p.id === id ? { ...p, ...data } : p)),
  })),
  removeProject: (id) => set((state) => ({
    projects: state.projects.filter((p) => p.id !== id),
  })),
}));

export const useDeploymentStore = create<DeploymentState>((set) => ({
  deployments: [],
  setDeployments: (deployments) => set({ deployments }),
  addDeployment: (deployment) => set((state) => ({ deployments: [...state.deployments, deployment] })),
  updateDeployment: (id, data) => set((state) => ({
    deployments: state.deployments.map((d) => (d.id === id ? { ...d, ...data } : d)),
  })),
}));

export const useBillingStore = create<BillingState>((set) => ({
  plans: [],
  subscription: null,
  resources: [],
  setPlans: (plans) => set({ plans }),
  setSubscription: (subscription) => set({ subscription }),
  setResources: (resources) => set({ resources }),
}));