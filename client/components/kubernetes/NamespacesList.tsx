'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, HardDrive, Trash2 } from 'lucide-react';
import { K8sNamespace } from '@/lib/types';

interface NamespacesListProps {
  namespaces: K8sNamespace[];
  canEdit: boolean;
  userRole: string;
  onDelete: (name: string) => void;
}

export default function NamespacesList({ namespaces, canEdit, userRole, onDelete }: NamespacesListProps) {
  return (
    <Card className="border-gray-800 bg-gray-900/50">
      <CardHeader>
        <CardTitle className="text-white">Namespaces</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {namespaces.map((ns) => (
            <div key={ns.name} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 p-3 hover:bg-gray-800/50">
              <div className="flex items-center gap-3">
                <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-gray-400/10">
                  <HardDrive className="h-5 w-5 text-gray-400" />
                </div>
                <div>
                  <p className="font-medium text-white">{ns.name}</p>
                  <p className="text-xs text-gray-500">Status: {ns.status}</p>
                </div>
              </div>
              {canEdit && userRole !== 'DEVELOPER' && ns.name !== 'default' && ns.name !== 'kube-system' && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-400" onClick={() => onDelete(ns.name)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
