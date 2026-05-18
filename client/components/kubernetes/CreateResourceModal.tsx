'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Zap, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';

interface CreateResourceModalProps {
  show: boolean;
  createType: 'namespace' | 'deployment' | 'service';
  onCreateTypeChange: (type: 'namespace' | 'deployment' | 'service') => void;
  formData: Record<string, string>;
  onFormDataChange: (data: Record<string, string>) => void;
  isAdvanced: boolean;
  onAdvancedToggle: () => void;
  creating: boolean;
  onCreate: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export default function CreateResourceModal({
  show,
  createType,
  onCreateTypeChange,
  formData,
  onFormDataChange,
  isAdvanced,
  onAdvancedToggle,
  creating,
  onCreate,
  onCancel
}: CreateResourceModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto border-gray-800 bg-gray-900">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">
              Create {createType.charAt(0).toUpperCase() + createType.slice(1)}
            </CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onAdvancedToggle}
              className="text-gray-400 hover:text-white"
            >
              {isAdvanced ? <Zap className="h-4 w-4 mr-1" /> : <SlidersHorizontal className="h-4 w-4 mr-1" />}
              {isAdvanced ? 'Simple' : 'Advanced'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="space-y-4">
            {createType === 'namespace' && (
              <div className="space-y-2">
                <Label htmlFor="create-name" className="text-gray-300">Name</Label>
                <Input
                  id="create-name"
                  placeholder="my-namespace"
                  value={formData.name || ''}
                  onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
                  required
                  className="border-gray-700 bg-gray-800 text-white"
                />
              </div>
            )}

            {createType === 'deployment' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="create-name" className="text-gray-300">Name</Label>
                  <Input
                    id="create-name"
                    placeholder="my-deployment"
                    value={formData.name || ''}
                    onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
                    required
                    className="border-gray-700 bg-gray-800 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-image" className="text-gray-300">Image</Label>
                  <Input
                    id="create-image"
                    placeholder="nginx:latest"
                    value={formData.image || ''}
                    onChange={(e) => onFormDataChange({ ...formData, image: e.target.value })}
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
                      onChange={(e) => onFormDataChange({ ...formData, replicas: e.target.value })}
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
                      onChange={(e) => onFormDataChange({ ...formData, port: e.target.value })}
                      className="border-gray-700 bg-gray-800 text-white"
                    />
                  </div>
                </div>

                {isAdvanced && (
                  <div className="rounded-lg border border-gray-700 p-4 space-y-4">
                    <Label className="text-gray-300 font-medium">Resource Limits</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cpu-limit" className="text-xs text-gray-500">CPU Limit</Label>
                        <Input
                          id="cpu-limit"
                          placeholder="500m"
                          value={formData.cpuLimit || '500m'}
                          onChange={(e) => onFormDataChange({ ...formData, cpuLimit: e.target.value })}
                          className="border-gray-700 bg-gray-800 text-white text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="memory-limit" className="text-xs text-gray-500">Memory Limit</Label>
                        <Input
                          id="memory-limit"
                          placeholder="256Mi"
                          value={formData.memoryLimit || '256Mi'}
                          onChange={(e) => onFormDataChange({ ...formData, memoryLimit: e.target.value })}
                          className="border-gray-700 bg-gray-800 text-white text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cpu-request" className="text-xs text-gray-500">CPU Request</Label>
                        <Input
                          id="cpu-request"
                          placeholder="100m"
                          value={formData.cpuRequest || '100m'}
                          onChange={(e) => onFormDataChange({ ...formData, cpuRequest: e.target.value })}
                          className="border-gray-700 bg-gray-800 text-white text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="memory-request" className="text-xs text-gray-500">Memory Request</Label>
                        <Input
                          id="memory-request"
                          placeholder="128Mi"
                          value={formData.memoryRequest || '128Mi'}
                          onChange={(e) => onFormDataChange({ ...formData, memoryRequest: e.target.value })}
                          className="border-gray-700 bg-gray-800 text-white text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="env-vars" className="text-gray-300">Environment Variables (JSON)</Label>
                      <textarea
                        id="env-vars"
                        placeholder='[{"name": "NODE_ENV", "value": "production"}]'
                        value={formData.envVars || ''}
                        onChange={(e) => onFormDataChange({ ...formData, envVars: e.target.value })}
                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
                        rows={3}
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {createType === 'service' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="create-name" className="text-gray-300">Name</Label>
                  <Input
                    id="create-name"
                    placeholder="my-service"
                    value={formData.name || ''}
                    onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
                    required
                    className="border-gray-700 bg-gray-800 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-type" className="text-gray-300">Type</Label>
                  <select
                    id="create-type"
                    value={formData.type || 'ClusterIP'}
                    onChange={(e) => onFormDataChange({ ...formData, type: e.target.value })}
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
                      onChange={(e) => onFormDataChange({ ...formData, port: e.target.value })}
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
                      onChange={(e) => onFormDataChange({ ...formData, targetPort: e.target.value })}
                      className="border-gray-700 bg-gray-800 text-white"
                    />
                  </div>
                </div>

                {isAdvanced && (
                  <div className="rounded-lg border border-gray-700 p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="external-traffic-policy" className="text-gray-300">External Traffic Policy</Label>
                        <select
                          id="external-traffic-policy"
                          value={formData.externalTrafficPolicy || 'Cluster'}
                          onChange={(e) => onFormDataChange({ ...formData, externalTrafficPolicy: e.target.value })}
                          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                        >
                          <option value="Cluster" className="bg-gray-800">Cluster</option>
                          <option value="Local" className="bg-gray-800">Local</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="session-affinity" className="text-gray-300">Session Affinity</Label>
                        <select
                          id="session-affinity"
                          value={formData.sessionAffinity || 'None'}
                          onChange={(e) => onFormDataChange({ ...formData, sessionAffinity: e.target.value })}
                          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                        >
                          <option value="None" className="bg-gray-800">None</option>
                          <option value="ClientIP" className="bg-gray-800">ClientIP</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onCancel} className="flex-1 border-gray-700 text-gray-300">
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
  );
}
