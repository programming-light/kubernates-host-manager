'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Activity, Boxes, Network, Server } from 'lucide-react';
import { K8sStatus } from '@/lib/types';

interface StatsCardsProps {
  status: K8sStatus | null;
  pods: any[];
  services: any[];
  nodes: any[];
}

export default function StatsCards({ status, pods, services, nodes }: StatsCardsProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <div className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${status?.connected ? 'border-green-900/50 bg-green-950/20' : 'border-red-900/50 bg-red-950/20'}`}>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${status?.connected ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
          <Activity className={`h-4 w-4 ${status?.connected ? 'text-green-400' : 'text-red-400'}`} />
        </div>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wider ${status?.connected ? 'text-green-400' : 'text-red-400'}`}>
            {status?.connected ? 'Connected' : 'Disconnected'}
          </p>
          <p className="text-[10px] text-gray-500 leading-tight">
            {status?.provider ? status.provider : 'No cluster'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20">
          <Boxes className="h-4 w-4 text-blue-400" />
        </div>
        <div>
          <p className="text-xs font-semibold text-white">{pods.length}</p>
          <p className="text-[10px] text-gray-500 leading-tight">Pods</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20">
          <Network className="h-4 w-4 text-purple-400" />
        </div>
        <div>
          <p className="text-xs font-semibold text-white">{services.length}</p>
          <p className="text-[10px] text-gray-500 leading-tight">Services</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/20">
          <Server className="h-4 w-4 text-orange-400" />
        </div>
        <div>
          <p className="text-xs font-semibold text-white">{nodes.length}</p>
          <p className="text-[10px] text-gray-500 leading-tight">Nodes</p>
        </div>
      </div>
    </div>
  );
}
