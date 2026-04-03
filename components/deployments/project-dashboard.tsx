'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useProject, useDeployments, useRestartDeployment, useScaleDeployment } from '@/hooks/use-deployments';

export function ProjectDashboard({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const { project, isLoading: projectLoading } = useProject(workspaceId, projectId);
  const { deployments, isLoading: deploymentsLoading } = useDeployments(workspaceId, projectId);
  const { restart, isLoading: restarting } = useRestartDeployment();
  const { scale, isLoading: scaling } = useScaleDeployment();
  const [scaleInput, setScaleInput] = useState('1');

  if (projectLoading) return <div>Loading project...</div>;
  if (!project) return <div>Project not found</div>;

  const latestDeployment = deployments[0];

  const handleRestart = async () => {
    try {
      await restart(workspaceId, projectId);
      alert('Deployment restarted successfully');
    } catch (err) {
      alert('Failed to restart deployment');
    }
  };

  const handleScale = async () => {
    try {
      const replicas = parseInt(scaleInput);
      if (replicas < 1 || replicas > 100) {
        alert('Replicas must be between 1 and 100');
        return;
      }
      await scale(workspaceId, projectId, replicas);
      alert('Scaling initiated');
    } catch (err) {
      alert('Failed to scale deployment');
    }
  };

  return (
    <div className="space-y-8">
      {/* Project Header */}
      <div className="border-b pb-6">
        <h1 className="text-3xl font-bold mb-2">{project.name}</h1>
        <p className="text-gray-600">{project.description}</p>
        <div className="mt-4 flex gap-4">
          <div>
            <span className="text-sm text-gray-500">Status:</span>
            <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
              {project.status || 'Active'}
            </span>
          </div>
          <div>
            <span className="text-sm text-gray-500">Image:</span>
            <span className="ml-2 font-mono text-sm">{project.imageUrl}</span>
          </div>
        </div>
      </div>

      {/* Latest Deployment */}
      {latestDeployment && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Latest Deployment</h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <span className="text-sm text-gray-500">Status:</span>
              <div className="mt-1 px-3 py-1 bg-green-100 text-green-800 rounded text-sm inline-block">
                {latestDeployment.status}
              </div>
            </div>

            <div>
              <span className="text-sm text-gray-500">Revision:</span>
              <span className="ml-2 font-semibold">#{latestDeployment.revision}</span>
            </div>

            <div>
              <span className="text-sm text-gray-500">Deployed by:</span>
              <span className="ml-2">{latestDeployment.deployedBy || 'System'}</span>
            </div>

            <div>
              <span className="text-sm text-gray-500">Image:</span>
              <span className="ml-2 font-mono text-sm">{latestDeployment.imageUrl}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleRestart} disabled={restarting} variant="outline" size="sm">
              {restarting ? 'Restarting...' : 'Restart'}
            </Button>
          </div>
        </div>
      )}

      {/* Resource Configuration */}
      <div className="border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Resource Configuration</h2>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <span className="text-sm text-gray-500">CPU Request:</span>
            <span className="block text-lg font-semibold">{project.cpuRequest} cores</span>
          </div>

          <div>
            <span className="text-sm text-gray-500">CPU Limit:</span>
            <span className="block text-lg font-semibold">{project.cpuLimit} cores</span>
          </div>

          <div>
            <span className="text-sm text-gray-500">Memory Request:</span>
            <span className="block text-lg font-semibold">{project.memoryRequest} MB</span>
          </div>

          <div>
            <span className="text-sm text-gray-500">Memory Limit:</span>
            <span className="block text-lg font-semibold">{project.memoryLimit} MB</span>
          </div>
        </div>

        {/* Scaling */}
        <div className="border-t pt-6">
          <h3 className="font-semibold mb-3">Scaling</h3>

          <div className="flex gap-3 items-center">
            <div className="flex-1">
              <label className="block text-sm text-gray-500 mb-1">Replicas</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={scaleInput}
                  onChange={(e) => setScaleInput(e.target.value)}
                  min="1"
                  max="100"
                  className="px-3 py-2 border rounded w-20"
                />
                <Button onClick={handleScale} disabled={scaling} variant="outline" size="sm">
                  {scaling ? 'Scaling...' : 'Scale'}
                </Button>
              </div>
            </div>

            <div>
              <span className="text-sm text-gray-500">Current:</span>
              <span className="block text-lg font-semibold">{project.replicas}</span>
            </div>
          </div>

          {project.autoscale && (
            <p className="text-sm text-gray-600 mt-3">
              Autoscaling enabled (min: {project.minReplicas}, max: {project.maxReplicas}, threshold:{' '}
              {project.cpuThreshold}%)
            </p>
          )}
        </div>
      </div>

      {/* Deployment History */}
      <div className="border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Deployment History</h2>

        {deploymentsLoading ? (
          <div>Loading deployments...</div>
        ) : deployments.length === 0 ? (
          <div className="text-gray-500 text-center py-6">No deployments yet</div>
        ) : (
          <div className="space-y-3">
            {deployments.map((deployment) => (
              <div key={deployment.id} className="border rounded p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold">
                      Revision #{deployment.revision}
                      <span className="ml-2 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                        {deployment.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{deployment.imageUrl}</p>
                    {deployment.gitCommitSha && (
                      <p className="text-xs text-gray-500 mt-1">
                        Commit: {deployment.gitCommitSha.substring(0, 7)}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      {new Date(deployment.createdAt).toLocaleString()}
                    </p>
                    {deployment.completedAt && (
                      <p className="text-xs text-gray-500 mt-1">
                        Duration: {Math.round((new Date(deployment.completedAt).getTime() - new Date(deployment.createdAt).getTime()) / 1000)}s
                      </p>
                    )}
                  </div>
                </div>

                {deployment.events && deployment.events.length > 0 && (
                  <div className="mt-3 text-xs">
                    <p className="font-semibold text-gray-600">Events:</p>
                    <ul className="list-disc list-inside text-gray-500 mt-1">
                      {deployment.events.slice(0, 3).map((event) => (
                        <li key={event.id}>{event.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
