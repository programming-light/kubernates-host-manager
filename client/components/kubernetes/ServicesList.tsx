'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Globe } from 'lucide-react';
import { K8sService } from '@/lib/types';

interface ServicesListProps {
  services: K8sService[];
  canEdit: boolean;
  onCreateClick: () => void;
  onDelete: (name: string) => void;
}

export default function ServicesList({ services, canEdit, onCreateClick, onDelete }: ServicesListProps) {
  return (
    <Card className="border-gray-800 bg-gray-900/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white">Services</CardTitle>
          {canEdit && (
            <Button onClick={onCreateClick} size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" />
              New Service
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {services.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Globe className="mb-4 h-10 w-10 text-gray-500" />
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
                  {canEdit && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-400" onClick={() => onDelete(svc.name)}>
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
