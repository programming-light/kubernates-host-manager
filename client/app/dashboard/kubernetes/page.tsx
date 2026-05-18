'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { apiClient } from '@/lib/api-client';
import { useSocket } from '@/lib/socket-context';
import { Project, K8sPod, K8sService, K8sDeployment, K8sNamespace, K8sNode, K8sIngress } from '@/lib/types';
import { toast } from 'sonner';
import {
  Loader2, RefreshCw, Plus, Eye, LayoutGrid, List, Boxes, GitBranch, Server,
  CheckCircle, XCircle, AlertCircle, Globe, HardDrive, Cpu, MemoryStick, Trash2, Search, ExternalLink,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import InfiniteScrollList from '@/components/ui/infinite-scroll';
import StatsCards from '@/components/kubernetes/StatsCards';
import CreateResourceModal from '@/components/kubernetes/CreateResourceModal';
import { k8sKeys } from '@/lib/queries/kubernetes';

const TAB_ICONS: Record<string, any> = {
  pods: Boxes, services: Globe, deployments: Server,
  namespaces: HardDrive, nodes: Server, ingresses: Globe, projects: Boxes,
};

export default function KubernetesPage() {
  const qc = useQueryClient();
  const [namespace, setNamespace] = useState('default');
  const [activeTab, setActiveTab] = useState('pods');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<'namespace' | 'deployment' | 'service'>('deployment');
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [canEdit, setCanEdit] = useState(false);
  const [userRole, setUserRole] = useState<string>('DEVELOPER');
  const [userEmail, setUserEmail] = useState<string>('');
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [projectView, setProjectView] = useState<'grid' | 'list'>('grid');
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; name: string } | null>(null);

  const { connected: socketConnected, subscribe, joinK8sUpdates } = useSocket();

  const statusQ = useQuery({
    queryKey: k8sKeys.status(),
    queryFn: () => apiClient.get<{ connected: boolean; provider?: string; error?: string }>('/kubernetes/status'),
    refetchInterval: 15000,
  });
  const podsQ = useQuery({
    queryKey: k8sKeys.pods(namespace),
    queryFn: () => apiClient.get<K8sPod[]>(`/kubernetes/pods?namespace=${namespace}`),
    refetchInterval: 15000,
  });
  const servicesQ = useQuery({
    queryKey: k8sKeys.services(namespace),
    queryFn: () => apiClient.get<K8sService[]>(`/kubernetes/services?namespace=${namespace}`),
    refetchInterval: 15000,
  });
  const namespacesQ = useQuery({
    queryKey: k8sKeys.namespaces(),
    queryFn: () => apiClient.get<K8sNamespace[]>('/kubernetes/namespaces'),
    refetchInterval: 30000,
  });
  const nodesQ = useQuery({
    queryKey: k8sKeys.nodes(),
    queryFn: () => apiClient.get<K8sNode[]>('/kubernetes/nodes'),
    refetchInterval: 30000,
  });
  const deploymentsQ = useQuery({
    queryKey: k8sKeys.deployments(namespace),
    queryFn: () => apiClient.get<K8sDeployment[]>(`/kubernetes/deployments?namespace=${namespace}`),
    refetchInterval: 15000,
  });
  const ingressesQ = useQuery({
    queryKey: k8sKeys.ingresses(namespace),
    queryFn: () => apiClient.get<K8sIngress[]>(`/kubernetes/ingresses?namespace=${namespace}`),
    refetchInterval: 15000,
  });
  const traefikQ = useQuery({
    queryKey: ['traefik', 'status'],
    queryFn: () => apiClient.get<{ installed: boolean; dashboardUrl: string | null }>('/kubernetes/traefik'),
    refetchInterval: 30000,
  });
  const projectsQ = useQuery({
    queryKey: ['projects', 'list'],
    queryFn: () => apiClient.get<Project[]>('/projects'),
  });

  const isLoading = statusQ.isLoading && podsQ.isLoading;

  useEffect(() => { fetchUserRole(); }, []);

  useEffect(() => {
    if (socketConnected) joinK8sUpdates(namespace);
  }, [socketConnected, namespace, joinK8sUpdates]);

  useEffect(() => {
    const invalidate = () => {
      qc.invalidateQueries({ queryKey: k8sKeys.all });
      qc.invalidateQueries({ queryKey: ['projects', 'list'] });
    };
    subscribe('k8s:namespace:created', invalidate);
    subscribe('k8s:namespace:deleted', invalidate);
    subscribe('k8s:deployment:created', invalidate);
    subscribe('k8s:deployment:deleted', invalidate);
    subscribe('k8s:service:created', invalidate);
    subscribe('k8s:service:deleted', invalidate);
    subscribe('k8s:pod:deleted', invalidate);
  }, [subscribe, qc]);

  const fetchUserRole = async () => {
    try {
      const userRes = await api.get('/auth/me');
      const userData = await userRes.json();
      setUserEmail(userData.email || '');
      if (userData.role === 'ADMIN') { setUserRole('ADMIN'); setCanEdit(true); return; }
      const wsRes = await api.get('/workspaces');
      const wsData = await wsRes.json();
      if (Array.isArray(wsData) && wsData.length > 0) {
        const role = wsData[0].memberRole || 'DEVELOPER';
        setUserRole(role);
        setCanEdit(['OWNER', 'ADMIN', 'MANAGER'].includes(role));
      }
    } catch { setCanEdit(false); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      let endpoint = '';
      let body: Record<string, any> = {};
      if (createType === 'namespace') {
        endpoint = '/kubernetes/create-namespace';
        body = { name: formData.name };
      } else if (createType === 'deployment') {
        endpoint = '/kubernetes/create-deployment';
        body = {
          name: formData.name, image: formData.image || 'nginx:latest', namespace,
          replicas: parseInt(formData.replicas) || 1, port: parseInt(formData.port) || 80,
          ...(isAdvanced && {
            resources: {
              limits: { cpu: formData.cpuLimit || '500m', memory: formData.memoryLimit || '256Mi' },
              requests: { cpu: formData.cpuRequest || '100m', memory: formData.memoryRequest || '128Mi' },
            },
            env: formData.envVars ? JSON.parse(formData.envVars) : undefined,
          }),
        };
      } else if (createType === 'service') {
        endpoint = '/kubernetes/create-service';
        body = {
          name: formData.name, namespace, type: formData.type || 'ClusterIP',
          servicePort: parseInt(formData.port) || 80, targetPort: parseInt(formData.targetPort) || 80,
        };
      }
      await api.post(endpoint, body);
      setShowCreateModal(false); setFormData({}); setIsAdvanced(false);
      qc.invalidateQueries({ queryKey: k8sKeys.all });
    } catch (error: any) {
      toast.error(error.message || `Failed to create ${createType}`);
    } finally { setCreating(false); }
  };

  const handleDelete = (type: string, name: string) => setDeleteConfirm({ type, name });

  const confirmDeleteResource = async () => {
    if (!deleteConfirm) return;
    try {
      await api.delete(`/kubernetes/delete-resource?type=${deleteConfirm.type}&name=${deleteConfirm.name}&namespace=${namespace}`);
      qc.invalidateQueries({ queryKey: k8sKeys.all });
    } catch (error: any) { toast.error(error.message || 'Failed to delete resource'); }
  };

  const openCreate = (type: 'namespace' | 'deployment' | 'service') => {
    setCreateType(type);
    setShowCreateModal(true);
  };

  const podStatusIcon = (s: string) => {
    switch (s) {
      case 'Running': return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'Pending': return <Loader2 className="h-4 w-4 text-yellow-400 animate-spin" />;
      case 'Failed': return <XCircle className="h-4 w-4 text-red-400" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const tabs = useMemo(() => [
    { id: 'pods', label: 'Pods', count: podsQ.data?.length || 0, data: podsQ.data || [] },
    { id: 'services', label: 'Services', count: servicesQ.data?.length || 0, data: servicesQ.data || [] },
    { id: 'deployments', label: 'Deployments', count: deploymentsQ.data?.length || 0, data: deploymentsQ.data || [] },
    { id: 'namespaces', label: 'Namespaces', count: namespacesQ.data?.length || 0, data: namespacesQ.data || [] },
    { id: 'nodes', label: 'Nodes', count: nodesQ.data?.length || 0, data: nodesQ.data || [] },
    { id: 'ingresses', label: 'Ingresses', count: ingressesQ.data?.length || 0, data: ingressesQ.data || [] },
    { id: 'traefik', label: 'Traefik', count: 0, data: [] },
    { id: 'projects', label: 'Projects', count: projectsQ.data?.length || 0 },
  ], [podsQ.data, servicesQ.data, deploymentsQ.data, namespacesQ.data, nodesQ.data, ingressesQ.data, projectsQ.data, traefikQ.data]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
          <p className="text-gray-400">Loading Kubernetes resources...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Kubernetes</h1>
          <p className="mt-1 text-sm text-gray-400">
            {userRole === 'ADMIN' ? 'Full cluster access' : 'Your namespace'}
          </p>
          <div className="mt-1 flex items-center gap-3">
            <div className={`h-2 w-2 rounded-full ${socketConnected ? 'bg-green-400' : 'bg-yellow-400'}`} />
            <span className="text-xs text-gray-500">{socketConnected ? 'Real-time' : 'Polling'}</span>
            {userEmail && (
              <span className="text-xs text-gray-500">
                | <code className="rounded bg-gray-800 px-1.5 py-0.5">{userEmail.toLowerCase().replace(/[^a-z0-9]/g, '-')}</code>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {userRole === 'ADMIN' && (
            <select value={namespace} onChange={(e) => setNamespace(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-2 text-sm text-white focus:border-blue-500 focus:outline-none">
              {(namespacesQ.data || []).map((ns: any) => (
                <option key={ns.name} value={ns.name}>{ns.name}</option>
              ))}
            </select>
          )}
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: k8sKeys.all })}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
          {canEdit && userRole !== 'DEVELOPER' && (
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700"
              onClick={() => openCreate(activeTab === 'services' ? 'service' : 'deployment')}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Create
            </Button>
          )}
        </div>
      </div>

      {userRole === 'DEVELOPER' && (
        <div className="rounded-lg border border-blue-900/50 bg-blue-900/10 p-3">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-blue-400 shrink-0" />
            <p className="text-sm text-blue-300">View-only mode. Contact an admin to manage resources.</p>
          </div>
        </div>
      )}

      <StatsCards status={statusQ.data || null} pods={podsQ.data || []} services={servicesQ.data || []} nodes={nodesQ.data || []} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto pb-1 scrollbar-thin">
          <TabsList className="h-auto flex-nowrap gap-1 p-1">
            {tabs.map(tab => {
              const Icon = TAB_ICONS[tab.id];
              return (
                <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs">
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  {tab.label}
                  <span className="ml-1 rounded-full bg-gray-700 px-1.5 py-0.5 text-[10px] tabular-nums">{tab.count}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <TabsContent value="pods" className="mt-3">
          <Card className="border-gray-800 bg-gray-900/50">
            <CardContent className="p-4">
              <InfiniteScrollList<K8sPod> items={podsQ.data || []} pageSize={30}
                searchPlaceholder="Search pods by name, status, namespace..."
                emptyMessage={namespace !== 'all' ? `No pods found in ${namespace}` : 'No pods found'}
                renderItem={(pod) => (
                  <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 p-3 hover:bg-gray-800/50">
                    <div className="flex items-center gap-3 min-w-0">
                      {podStatusIcon(pod.status)}
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate">{pod.name}</p>
                        <p className="text-xs text-gray-500">{pod.namespace} | Ready: {pod.ready} | Restarts: {pod.restarts}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <span className="text-sm text-gray-500">{pod.age}</span>
                      {canEdit && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:text-red-400"
                          onClick={() => handleDelete('pod', pod.name)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                )} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="mt-3">
          <Card className="border-gray-800 bg-gray-900/50">
            <CardContent className="p-4">
              <InfiniteScrollList<K8sService> items={servicesQ.data || []} pageSize={30}
                searchPlaceholder="Search services by name, type, clusterIP..."
                emptyMessage="No services found"
                renderItem={(svc) => (
                  <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 p-3 hover:bg-gray-800/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <Globe className="h-5 w-5 text-purple-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate">{svc.name}</p>
                        <p className="text-xs text-gray-500">Type: {svc.type} | ClusterIP: {svc.clusterIP}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <span className="text-xs text-gray-500">{svc.ports?.join(', ') || ''}</span>
                      {canEdit && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:text-red-400"
                          onClick={() => handleDelete('service', svc.name)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                )} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deployments" className="mt-3">
          <Card className="border-gray-800 bg-gray-900/50">
            <CardContent className="p-4">
              <InfiniteScrollList<K8sDeployment> items={deploymentsQ.data || []} pageSize={30}
                searchPlaceholder="Search deployments by name, image..."
                emptyMessage="No deployments found"
                renderItem={(dep) => (
                  <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 p-3 hover:bg-gray-800/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <Server className="h-5 w-5 text-blue-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate">{dep.name}</p>
                        <p className="text-xs text-gray-500">Replicas: {dep.readyReplicas || 0}/{dep.replicas} | {dep.images?.join(', ')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <span className="text-sm text-gray-500">{dep.age}</span>
                      {canEdit && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:text-red-400"
                          onClick={() => handleDelete('deployment', dep.name)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                )} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="namespaces" className="mt-3">
          <Card className="border-gray-800 bg-gray-900/50">
            <CardContent className="p-4">
              <InfiniteScrollList<K8sNamespace> items={namespacesQ.data || []} pageSize={30}
                searchable={true} searchPlaceholder="Search namespaces..."
                emptyMessage="No namespaces found"
                renderItem={(ns) => (
                  <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 p-3 hover:bg-gray-800/50">
                    <div className="flex items-center gap-3">
                      <HardDrive className="h-5 w-5 text-gray-400 shrink-0" />
                      <div>
                        <p className="font-medium text-white">{ns.name}</p>
                        <p className="text-xs text-gray-500">Status: {ns.status}</p>
                      </div>
                    </div>
                    {canEdit && userRole !== 'DEVELOPER' && ns.name !== 'default' && ns.name !== 'kube-system' && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:text-red-400"
                        onClick={() => handleDelete('namespace', ns.name)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nodes" className="mt-3">
          <Card className="border-gray-800 bg-gray-900/50">
            <CardContent className="p-4">
              {userRole !== 'ADMIN' ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Server className="mb-3 h-8 w-8 text-gray-500" />
                  <p className="text-sm text-gray-400">Node information is only available to admins</p>
                </div>
              ) : (
                <InfiniteScrollList<K8sNode> items={nodesQ.data || []} pageSize={20}
                  searchable={true} searchPlaceholder="Search nodes..."
                  emptyMessage="No nodes found"
                  renderItem={(node) => (
                    <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-3">
                      <div className="flex items-center gap-3 mb-2">
                        {node.status === 'Ready' ?
                          <CheckCircle className="h-4 w-4 text-green-400" /> :
                          <XCircle className="h-4 w-4 text-red-400" />
                        }
                        <p className="font-medium text-white">{node.name}</p>
                        <span className="ml-auto text-xs text-gray-500">{node.age}</span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><Cpu className="h-3 w-3" /> CPU: {node.cpu}</span>
                        <span className="flex items-center gap-1"><MemoryStick className="h-3 w-3" /> Mem: {node.memory}</span>
                        <span>v{node.version}</span>
                        {node.roles && <span>Roles: {node.roles}</span>}
                      </div>
                    </div>
                  )} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ingresses" className="mt-3">
          <Card className="border-gray-800 bg-gray-900/50">
            <CardContent className="p-4">
              <InfiniteScrollList<K8sIngress> items={ingressesQ.data || []} pageSize={30}
                searchable={true} searchPlaceholder="Search ingresses by name, host..."
                emptyMessage="No ingresses found"
                renderItem={(ing) => (
                  <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 p-3 hover:bg-gray-800/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <Globe className="h-5 w-5 text-green-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate">{ing.name}</p>
                        <p className="text-xs text-gray-500 truncate">Hosts: {ing.hosts?.join(', ') || 'None'}</p>
                      </div>
                    </div>
                    <span className="text-sm text-gray-500 shrink-0 ml-3">{ing.age}</span>
                  </div>
                )} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="traefik" className="mt-3">
          <Card className="border-gray-800 bg-gray-900/50">
            <CardContent className="p-4">
              {traefikQ.isLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-500" /></div>
              ) : traefikQ.data?.installed ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-lg border border-green-500/20 bg-green-500/10 p-4">
                    <CheckCircle className="h-6 w-6 text-green-400" />
                    <div>
                      <p className="font-medium text-green-400">Traefik Running</p>
                      <p className="text-sm text-green-400/70">Reverse proxy & SSL manager active</p>
                    </div>
                  </div>
                  {traefikQ.data.dashboardUrl && (
                    <a href={traefikQ.data.dashboardUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/50 p-3 text-blue-400 hover:bg-gray-800">
                      <Globe className="h-5 w-5" />
                      <span>Traefik Dashboard</span>
                      <span className="ml-auto text-xs text-gray-500">External link</span>
                    </a>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center py-8 text-center">
                  <Server className="mb-3 h-8 w-8 text-gray-600" />
                  <p className="text-sm text-gray-400">Traefik not installed</p>
                  <p className="mt-1 text-xs text-gray-500">Deploy a project to auto-install Traefik</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects" className="mt-3">
          <Card className="border-gray-800 bg-gray-900/50">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex rounded-lg border border-gray-700 bg-gray-800 p-0.5">
                    <button onClick={() => setProjectView('grid')}
                      className={`rounded-md p-1.5 transition-colors ${projectView === 'grid' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>
                      <LayoutGrid className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setProjectView('list')}
                      className={`rounded-md p-1.5 transition-colors ${projectView === 'list' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>
                      <List className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <Link href="/dashboard/projects/new"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                  <Plus className="h-3.5 w-3.5" /> New Project
                </Link>
              </div>
              {!projectsQ.data || projectsQ.data.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <Boxes className="mb-3 h-8 w-8 text-gray-600" />
                  <p className="text-sm text-gray-400">No projects yet</p>
                  <Link href="/dashboard/projects/new" className="mt-2 text-xs font-medium text-blue-400 hover:text-blue-300">
                    Create your first project
                  </Link>
                </div>
              ) : projectView === 'grid' ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {projectsQ.data.map((project) => (
                    <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
                      <div className="group rounded-lg border border-gray-800 bg-gray-800/30 p-3 transition-all hover:border-gray-700 hover:bg-gray-800/50">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-green-700">
                              <Boxes className="h-4 w-4 text-white" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white truncate">{project.name}</p>
                              <p className="text-[10px] text-gray-500">/{project.slug}</p>
                            </div>
                          </div>
                          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                            project.status === 'active' ? 'text-green-400 bg-green-500/10' : 'text-gray-400 bg-gray-500/10'
                          }`}>{project.status}</span>
                        </div>
                        <p className="mt-1.5 text-xs text-gray-500 line-clamp-1">{project.description || 'No description'}</p>
                        <div className="mt-2 flex items-center gap-2 text-[10px] text-gray-600">
                          {project.gitUrl && (
                            <span className="flex items-center gap-1 truncate max-w-[140px]">
                              <GitBranch className="h-3 w-3 shrink-0" />
                              <span className="truncate">{project.gitUrl}</span>
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Server className="h-3 w-3 shrink-0" />
                            <span className="truncate">{project.namespace}</span>
                          </span>
                          {(project.status === 'deployed' || project.status === 'active') && (project as any).previewUrl && (
                            <a
                              href={`https://${(project as any).previewUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>Preview</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                    <div className="overflow-x-auto rounded-lg border border-gray-800">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="border-b border-gray-800 bg-gray-900/80">
                        <th className="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-gray-500">Name</th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-gray-500">Namespace</th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-gray-500">Preview URL</th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-gray-500">Status</th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-gray-500">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {projectsQ.data.map((project) => (
                        <tr key={project.id} className="group cursor-pointer transition-colors hover:bg-gray-800/50">
                          <td className="px-3 py-2.5">
                            <Link href={`/dashboard/projects/${project.id}`} className="flex items-center gap-2">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-green-700">
                                <Boxes className="h-3.5 w-3.5 text-white" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-white truncate">{project.name}</p>
                                <p className="text-[10px] text-gray-500">/{project.slug}</p>
                              </div>
                            </Link>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-gray-400"><code className="rounded bg-gray-800 px-1.5 py-0.5">{project.namespace}</code></td>
                          <td className="px-3 py-2.5">
                            {(project.status === 'deployed' || project.status === 'active') && (project as any).previewUrl ? (
                              <a href={`https://${(project as any).previewUrl}`} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs"
                                onClick={(e) => e.stopPropagation()}>
                                <ExternalLink className="h-3 w-3" />
                                <span className="truncate max-w-[120px]">{(project as any).previewUrl}</span>
                              </a>
                            ) : (
                              <span className="text-xs text-gray-600">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                              project.status === 'active' || project.status === 'deployed' ? 'text-green-400 bg-green-500/10' : 'text-gray-400 bg-gray-500/10'
                            }`}>{project.status}</span>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-gray-400">{new Date(project.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {showCreateModal && canEdit && userRole !== 'DEVELOPER' && (
        <CreateResourceModal
          show={showCreateModal} createType={createType}
          onCreateTypeChange={setCreateType}
          formData={formData} onFormDataChange={setFormData}
          isAdvanced={isAdvanced} onAdvancedToggle={() => setIsAdvanced(!isAdvanced)}
          creating={creating}
          onCreate={(e) => { e.preventDefault(); handleCreate(e); }}
          onCancel={() => setShowCreateModal(false)} />
      )}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}
        title={`Delete ${deleteConfirm?.type || 'Resource'}`}
        message={`Are you sure you want to delete ${deleteConfirm?.type || 'resource'} "${deleteConfirm?.name}"?`}
        onConfirm={confirmDeleteResource}
      />
    </div>
  );
}
