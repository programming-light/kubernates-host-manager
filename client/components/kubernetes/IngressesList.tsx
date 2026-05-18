'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe } from 'lucide-react';
import { K8sIngress } from '@/lib/types';

interface IngressesListProps {
  ingresses: K8sIngress[];
}

export default function IngressesList({ ingresses }: IngressesListProps) {
  return (
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
              <div key={ing.name} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 p-3 hover:bg-gray-800/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-green-500/10">
                    <Globe className="h-5 w-5 text-green-400" />
                  </div>
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
  );
}
