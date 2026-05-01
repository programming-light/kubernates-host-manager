'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { K8sStatus, K8sPod, K8sService, K8sNamespace, K8sNode, K8sDeployment, K8sIngress } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Server, 
  Boxes, 
  Network, 
  Globe, 
  Activity,
  Loader2,
  RefreshCw,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
  XCircle,
  HardDrive,
  Cpu,
  MemoryStick
} from 'lucide-react';
import { toast } from 'sonner';

export default function KubernetesPage() {
  const [status, setStatus] = useState<K8sStatus | null>(null);
  const [pods, setPods] = useState<K8sPod[]>([]);
  const [services, setServices] = useState<K8sService[]>([]);
  const [namespaces, setNamespaces] = useState<K8sNamespace[]>([]);
  const [nodes, setNodes] = useState<K8sNode[]>([]);
  const [deployments, setDeployments] = useState<K8sDeployment[]>([]);
  const [ingresses, setIngresses] = useState<K8sIngress[]>([]);
  const [loading, setLoading] = useState(true);
  const [namespace, setNamespace] = useState('default');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<'namespace' | 'deployment' | 'service'>('namespace');
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchAll();
  }, [namespace]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [statusRes, podsRes, servicesRes, namespacesRes, nodesRes, deploymentsRes, ingressesRes] = await Promise.all([
        api.get('/kubernetes/status'),
        api.get(`/kubernetes/pods?namespace=${namespace}`),
        api.get(`/kubernetes/services?namespace=${namespace}`),
        api.get('/kubernetes/namespaces'),
        api.get('/kubernetes/nodes'),
        api.get(`/kubernetes/deployments?namespace=${namespace}`),
        api.get(`/kubernetes/ingresses?namespace=${namespace}`),
      ]);

      const [statusData, podsData, servicesData, namespacesData, nodesData, deploymentsData, ingressesData] = await Promise.all([
        statusRes.json(),
        podsRes.json(),
        servicesRes.json(),
        namespacesRes.json(),
        nodesRes.json(),
        deploymentsRes.json(),
        ingressesRes.json(),
      ]);

      setStatus(statusData);
      setPods(Array.isArray(podsData) ? podsData : []);
      setServices(Array.isArray(servicesData) ? servicesData : []);
      setNamespaces(Array.isArray(namespacesData) ? namespacesData : []);
      setNodes(Array.isArray(nodesData) ? nodesData : []);
      setDeployments(Array.isArray(deploymentsData) ? deploymentsData : []);
      setIngresses(Array.isArray(ingressesData) ? ingressesData : []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load Kubernetes data');
    } finally {
      setLoading(false);
    }
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
          name: formData.name,
          image: formData.image,
          namespace,
          replicas: parseInt(formData.replicas) || 1,
          port: parseInt(formData.port) || 80,
        };
      } else if (createType === 'service') {
        endpoint = '/kubernetes/create-service';
        body = {
          name: formData.name,
          namespace,
          type: formData.type || 'ClusterIP',
          selector: { app: formData.selector || formData.name },
          port: parseInt(formData.port) || 80,
          targetPort: parseInt(formData.targetPort) || 80,
        };
      }

      await api.post(endpoint, body);
      toast.success(`${createType} created successfully`);
      setShowCreateModal(false);
      setFormData({});
      fetchAll();
    } catch (error: any) {
      toast.error(error.message || `Failed to create ${createType}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (type: string, name: string) => {
    if (!confirm(`Delete ${type} "${name}"?`)) return;
    try {
      await api.delete(`/kubernetes/delete-resource?type=${type}&name=${name}&namespace=${namespace}`);
      toast.success(`${type} deleted`);
      fetchAll();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete resource');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Ready': return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'Running': return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'Pending': return <Loader2 className="h-4 w-4 text-yellow-400 animate-spin" />;
      case 'Failed': return <XCircle className="h-4 w-4 text-red-400" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Ready':
      case 'Running': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'Pending': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'Failed': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  if (loading) {
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
          <p className="mt-1 text-gray-400">Manage cluster resources</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={namespace}
            onChange={(e) => setNamespace(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
          >
            {namespaces.map((ns) => (
              <option key={ns.name} value={ns.name} className="bg-gray-800">
                {ns.name}
              </option>
            ))}
          </select>
          <Button onClick={fetchAll} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => { setCreateType('namespace'); setShowCreateModal(true); }} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" />
            Create
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-gray-800 bg-gray-900/50">
          <CardContent className="flex items-center gap-4 p-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${status?.connected ? 'bg-gradient-to-br from-green-500/20 to-green-600/20' : 'bg-gradient-to-br from-red-500/20 to-red-600/20'}`}>
              <Activity className={`h-6 w-6 ${status?.connected ? 'text-green-400' : 'text-red-400'}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${status?.connected ? 'text-green-400' : 'text-red-400'}`}>
                {status?.connected ? 'Connected' : 'Disconnected'}
              </p>
              <p className="text-sm text-gray-500">
                {status?.provider ? `Provider: ${status.provider}` : 'No cluster detected'}
              </p>
              {status?.error && (
                <p className="text-xs text-red-400 mt-1">{status.error}</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-800 bg-gray-900/50">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20">
              <Boxes className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{pods.length}</p>
              <p className="text-sm text-gray-500">Pods</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-800 bg-gray-900/50">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20">
              <Network className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{services.length}</p>
              <p className="text-sm text-gray-500">Services</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-800 bg-gray-900/50">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/20">
              <Server className="h-6 w-6 text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{nodes.length}</p>
              <p className="text-sm text-gray-500">Nodes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pods" className="space-y-4">
        <TabsList className="bg-gray-800">
          <TabsTrigger value="pods" className="data-[state=active]:bg-blue-600">Pods ({pods.length})</TabsTrigger>
          <TabsTrigger value="services" className="data-[state=active]:bg-blue-600">Services ({services.length})</TabsTrigger>
          <TabsTrigger value="deployments" className="data-[state=active]:bg-blue-600">Deployments ({deployments.length})</TabsTrigger>
          <TabsTrigger value="namespaces" className="data-[state=active]:bg-blue-600">Namespaces ({namespaces.length})</TabsTrigger>
          <TabsTrigger value="nodes" className="data-[state=active]:bg-blue-600">Nodes ({nodes.length})</TabsTrigger>
          <TabsTrigger value="ingresses" className="data-[state=active]:bg-blue-600">Ingresses ({ingresses.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pods">
          <Card className="border-gray-800 bg-gray-900/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">Pods</CardTitle>
                <Button onClick={() => { setCreateType('deployment'); setShowCreateModal(true); }} size="sm" className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="mr-2 h-4 w-4" />
                  New Deployment
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {pods.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Boxes className="mb-4 h-10 w-10 text-gray-500" />
                  <p className="text-gray-400">No pods found in {namespace}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pods.map((pod) => (
                    <div key={pod.name} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 p-3 hover:bg-gray-800/50">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(pod.status)}
                        <div>
                          <p className="font-medium text-white">{pod.name}</p>
                          <p className="text-xs text-gray-500">{pod.namespace} | Ready: {pod.ready} | Restarts: {pod.restarts}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span>{pod.age}</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-400" onClick={() => handleDelete('pod', pod.name)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services">
          <Card className="border-gray-800 bg-gray-900/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">Services</CardTitle>
                <Button onClick={() => { setCreateType('service'); setShowCreateModal(true); }} size="sm" className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="mr-2 h-4 w-4" />
                  New Service
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {services.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Network className="mb-4 h-10 w-10 text-gray-500" />
                  <p className="text-gray-400">No services found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {services.map((svc) => (
                    <div key={svc.name} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 p-3 hover:bg-gray-800/50">
                      <div className="flex items-center gap-3">
                        <Globe className="h-5 w-5 text-purple-400" />
                        <div>
                          <p className="font-medium text-white">{svc.name}</p>
                          <p className="text-xs text-gray-500">Type: {svc.type} | ClusterIP: {svc.clusterIP}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span>{svc.ports.join(', ') || 'No ports'}</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-400" onClick={() => handleDelete('service', svc.name)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deployments">
          <Card className="border-gray-800 bg-gray-900/50">
            <CardHeader>
              <CardTitle className="text-white">Deployments</CardTitle>
            </CardHeader>
            <CardContent>
              {deployments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Boxes className="mb-4 h-10 w-10 text-gray-500" />
                  <p className="text-gray-400">No deployments found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {deployments.map((dep) => (
                    <div key={dep.name} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 p-3 hover:bg-gray-800/50">
                      <div className="flex items-center gap-3">
                        <Boxes className="h-5 w-5 text-blue-400" />
                        <div>
                          <p className="font-medium text-white">{dep.name}</p>
                          <p className="text-xs text-gray-500">Replicas: {dep.readyReplicas || 0}/{dep.replicas} | Images: {dep.images?.join(', ')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span>{dep.age}</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-400" onClick={() => handleDelete('deployment', dep.name)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="namespaces">
          <Card className="border-gray-800 bg-gray-900/50">
            <CardHeader>
              <CardTitle className="text-white">Namespaces</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {namespaces.map((ns) => (
                  <div key={ns.name} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 p-3 hover:bg-gray-800/50">
                    <div className="flex items-center gap-3">
                      <HardDrive className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-white">{ns.name}</p>
                        <p className="text-xs text-gray-500">Status: {ns.status}</p>
                      </div>
                    </div>
                    {ns.name !== 'default' && ns.name !== 'kube-system' && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-400" onClick={() => handleDelete('namespace', ns.name)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nodes">
          <Card className="border-gray-800 bg-gray-900/50">
            <CardHeader>
              <CardTitle className="text-white">Nodes</CardTitle>
            </CardHeader>
            <CardContent>
              {nodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Server className="mb-4 h-10 w-10 text-gray-500" />
                  <p className="text-gray-400">No nodes found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {nodes.map((node) => (
                    <div key={node.name} className="rounded-lg border border-gray-800 bg-gray-800/30 p-4">
                      <div className="flex items-center gap-3 mb-3">
                        {getStatusIcon(node.status)}
                        <p className="font-medium text-white">{node.name}</p>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-gray-400">
                          <Cpu className="h-4 w-4" />
                          <span>CPU: {node.cpu}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400">
                          <MemoryStick className="h-4 w-4" />
                          <span>Memory: {node.memory}</span>
                        </div>
                        <p className="text-gray-500">Version: {node.version}</p>
                        <p className="text-gray-500">Age: {node.age}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ingresses">
          <Card className="border-gray-800 bg-gray-900/50">
            <CardHeader>
              <CardTitle className="text-white">Ingresses</CardTitle>
            </CardHeader>
            <CardContent>
              {ingresses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Globe className="mb-4 h-10 w-10 text-gray-500" />
                  <p className="text-gray-400">No ingresses found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {ingresses.map((ing) => (
                    <div key={ing.name} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 p-3">
                      <div className="flex items-center gap-3">
                        <Globe className="h-5 w-5 text-green-400" />
                        <div>
                          <p className="font-medium text-white">{ing.name}</p>
                          <p className="text-xs text-gray-500">Hosts: {ing.hosts?.join(', ') || 'None'}</p>
                        </div>
                      </div>
                      <span className="text-sm text-gray-400">{ing.age}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-md border-gray-800 bg-gray-900">
            <CardHeader>
              <CardTitle className="text-white">
                Create {createType.charAt(0).toUpperCase() + createType.slice(1)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="create-name" className="text-gray-300">Name</Label>
                  <Input
                    id="create-name"
                    placeholder={`my-${createType}`}
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="border-gray-700 bg-gray-800 text-white"
                  />
                </div>

                {createType === 'deployment' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="create-image" className="text-gray-300">Image</Label>
                      <Input
                        id="create-image"
                        placeholder="nginx:latest"
                        value={formData.image || ''}
                        onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                        required
                        className="border-gray-700 bg-gray-800 text-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="create-replicas" className="text-gray-300">Replicas</Label>
                        <Input
                          id="create-replicas"
                          type="number"
                          min={1}
                          value={formData.replicas || '1'}
                          onChange={(e) => setFormData({ ...formData, replicas: e.target.value })}
                          className="border-gray-700 bg-gray-800 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="create-port" className="text-gray-300">Port</Label>
                        <Input
                          id="create-port"
                          type="number"
                          min={1}
                          value={formData.port || '80'}
                          onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                          className="border-gray-700 bg-gray-800 text-white"
                        />
                      </div>
                    </div>
                  </>
                )}

                {createType === 'service' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="create-type" className="text-gray-300">Type</Label>
                      <select
                        id="create-type"
                        value={formData.type || 'ClusterIP'}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                      >
                        <option value="ClusterIP" className="bg-gray-800">ClusterIP</option>
                        <option value="NodePort" className="bg-gray-800">NodePort</option>
                        <option value="LoadBalancer" className="bg-gray-800">LoadBalancer</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="create-port" className="text-gray-300">Port</Label>
                        <Input
                          id="create-port"
                          type="number"
                          min={1}
                          value={formData.port || '80'}
                          onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                          className="border-gray-700 bg-gray-800 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="create-target-port" className="text-gray-300">Target Port</Label>
                        <Input
                          id="create-target-port"
                          type="number"
                          min={1}
                          value={formData.targetPort || '80'}
                          onChange={(e) => setFormData({ ...formData, targetPort: e.target.value })}
                          className="border-gray-700 bg-gray-800 text-white"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1 border-gray-700 text-gray-300">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating} className="flex-1 bg-blue-600">
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}