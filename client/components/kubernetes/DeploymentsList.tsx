'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Boxes, Trash2, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { K8sDeployment } from '@/lib/types';

interface DeploymentsListProps {
  deployments: K8sDeployment[];
  canEdit: boolean;
  onDelete: (name: string) => void;
}

export default function DeploymentsList({ deployments, canEdit, onDelete }: DeploymentsListProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-400" />;
      case 'deploying':
      case 'pending': return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'failed': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'deploying':
      case 'pending': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  return (
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
              <div key={dep.name} className={`flex items-center justify-between rounded-lg border p-3 ${getStatusColor(dep.status)}`}>
                <div className="flex items-center gap-3">
                  {getStatusIcon(dep.status)}
                  <div>
                    <p className="font-medium text-white">{dep.name}</p>
                    <p className="text-xs text-gray-500">Replicas: {dep.readyReplicas || 0}/{dep.replicas} | Images: {dep.images?.join(', ')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span>{dep.age}</span>
                  {canEdit && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-400" onClick={() => onDelete(dep.name)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
