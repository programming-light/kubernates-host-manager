'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateProject } from '@/hooks/use-deployments';

export function CreateProjectForm({ workspaceId, clusterId }: { workspaceId: string; clusterId: string }) {
  const router = useRouter();
  const { createProject, isLoading, error } = useCreateProject();

  const [deploymentMode, setDeploymentMode] = useState<'docker' | 'git'>('docker');
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    imageUrl: '',
    gitUrl: '',
    gitBranch: 'main',
    buildCommand: '',
    containerPort: '3000',
    cpuRequest: '0.1',
    cpuLimit: '0.5',
    memoryRequest: '128',
    memoryLimit: '512',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.slug) {
      alert('Name and slug are required');
      return;
    }

    if (deploymentMode === 'docker' && !formData.imageUrl) {
      alert('Docker image URL is required');
      return;
    }

    if (deploymentMode === 'git' && !formData.gitUrl) {
      alert('Git repository URL is required');
      return;
    }

    try {
      const projectData = {
        workspaceId,
        clusterId,
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        ...(deploymentMode === 'docker' && { imageUrl: formData.imageUrl }),
        ...(deploymentMode === 'git' && {
          gitUrl: formData.gitUrl,
          gitBranch: formData.gitBranch,
          buildCommand: formData.buildCommand,
        }),
        containerPort: parseInt(formData.containerPort),
        cpuRequest: parseFloat(formData.cpuRequest),
        cpuLimit: parseFloat(formData.cpuLimit),
        memoryRequest: parseInt(formData.memoryRequest),
        memoryLimit: parseInt(formData.memoryLimit),
      };

      const project = await createProject(workspaceId, projectData);
      router.push(`/dashboard/workspaces/${workspaceId}/projects/${project.id}`);
    } catch (err) {
      console.error('Failed to create project:', err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Create New Project</h2>

        {/* Project Info */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Project Information</h3>

          <div>
            <label className="block text-sm font-medium mb-1">Project Name</label>
            <Input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="My Web App"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Project Slug</label>
            <Input
              type="text"
              name="slug"
              value={formData.slug}
              onChange={handleChange}
              placeholder="my-web-app"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <Input
              type="text"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Optional description"
            />
          </div>
        </div>

        {/* Deployment Mode */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Deployment Source</h3>

          <div className="flex gap-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="docker"
                checked={deploymentMode === 'docker'}
                onChange={(e) => setDeploymentMode('docker')}
                className="mr-2"
              />
              <span>Docker Image (Registry)</span>
            </label>

            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="git"
                checked={deploymentMode === 'git'}
                onChange={(e) => setDeploymentMode('git')}
                className="mr-2"
              />
              <span>Git Repository (Build)</span>
            </label>
          </div>

          {deploymentMode === 'docker' && (
            <div>
              <label className="block text-sm font-medium mb-1">Docker Image URL</label>
              <Input
                type="text"
                name="imageUrl"
                value={formData.imageUrl}
                onChange={handleChange}
                placeholder="docker.io/nginx:latest"
                required={deploymentMode === 'docker'}
              />
              <p className="text-xs text-gray-500 mt-1">
                Examples: docker.io/nginx:latest, ghcr.io/user/repo:v1.0
              </p>
            </div>
          )}

          {deploymentMode === 'git' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Git Repository URL</label>
                <Input
                  type="url"
                  name="gitUrl"
                  value={formData.gitUrl}
                  onChange={handleChange}
                  placeholder="https://github.com/user/repo"
                  required={deploymentMode === 'git'}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Branch</label>
                  <Input
                    type="text"
                    name="gitBranch"
                    value={formData.gitBranch}
                    onChange={handleChange}
                    placeholder="main"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Build Command</label>
                  <Input
                    type="text"
                    name="buildCommand"
                    value={formData.buildCommand}
                    onChange={handleChange}
                    placeholder="docker build -t {image} ."
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Container Configuration */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Container Configuration</h3>

          <div>
            <label className="block text-sm font-medium mb-1">Container Port</label>
            <Input
              type="number"
              name="containerPort"
              value={formData.containerPort}
              onChange={handleChange}
              min="1"
              max="65535"
            />
          </div>
        </div>

        {/* Resource Limits */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Resource Limits</h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">CPU Request (cores)</label>
              <Input
                type="number"
                name="cpuRequest"
                value={formData.cpuRequest}
                onChange={handleChange}
                step="0.1"
                min="0.1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">CPU Limit (cores)</label>
              <Input
                type="number"
                name="cpuLimit"
                value={formData.cpuLimit}
                onChange={handleChange}
                step="0.1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Memory Request (MB)</label>
              <Input
                type="number"
                name="memoryRequest"
                value={formData.memoryRequest}
                onChange={handleChange}
                step="128"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Memory Limit (MB)</label>
              <Input
                type="number"
                name="memoryLimit"
                value={formData.memoryLimit}
                onChange={handleChange}
                step="128"
              />
            </div>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 p-3 rounded text-red-700 text-sm">{error}</div>}
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create Project'}
        </Button>
      </div>
    </form>
  );
}
