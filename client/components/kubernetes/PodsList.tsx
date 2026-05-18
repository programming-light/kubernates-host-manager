'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { K8sPod } from '@/lib/types';

interface PodsListProps {
  pods: K8sPod[];
  canEdit: boolean;
  namespace: string;
  onCreateClick: () => void;
  onDelete: (name: string) => void;
}

export default function PodsList({ pods, canEdit, namespace, onCreateClick, onDelete }: PodsListProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Ready': return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'Running': return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'Pending': return <Loader2 className="h-4 w-4 text-yellow-400 animate-spin" />;
      case 'Failed': return <XCircle className="h-4 w-4 text-red-400" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <Card className="border-gray-800 bg-gray-900/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white">Pods</CardTitle>
          {canEdit && (
            <Button onClick={onCreateClick} size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" />
              New Deployment
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {pods.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-4 h-10 w-10 text-gray-500" />
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
                  {canEdit && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-400" onClick={() => onDelete(pod.name)}>
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
