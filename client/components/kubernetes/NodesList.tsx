'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Server, Cpu, MemoryStick } from 'lucide-react';
import { K8sNode } from '@/lib/types';

interface NodesListProps {
  nodes: K8sNode[];
  userRole: string;
}

export default function NodesList({ nodes, userRole }: NodesListProps) {
  return (
    <Card className="border-gray-800 bg-gray-900/50">
      <CardHeader>
        <CardTitle className="text-white">Nodes</CardTitle>
      </CardHeader>
      <CardContent>
        {userRole !== 'ADMIN' ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Server className="mb-4 h-10 w-10 text-gray-500" />
            <p className="text-gray-400">Node information is only available to admins</p>
          </div>
        ) : nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Server className="mb-4 h-10 w-10 text-gray-500" />
            <p className="text-gray-400">No nodes found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {nodes.map((node) => (
              <div key={node.name} className="rounded-lg border border-gray-800 bg-gray-800/30 p-4">
                <div className="flex items-center gap-3 mb-3">
                  {node.status === 'Ready' ? 
                    <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-green-500/10">
                      <Server className="h-5 w-5 text-green-400" />
                    </div> :
                    <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-red-500/10">
                      <Server className="h-5 w-5 text-red-400" />
                    </div>
                  }
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
                  {node.roles && <p className="text-gray-500">Roles: {node.roles}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
