'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Github, GitlabIcon as GitLab, GitCommit, Container, Globe, Link as LinkIcon, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import GitHubRepoSelector from './GitHubRepoSelector';
import GitLabRepoSelector from './GitLabRepoSelector';
import GiteaRepoSelector from './GiteaRepoSelector';
import DockerHubSelector from './DockerHubSelector';

export interface SourceRepo {
  provider: 'github' | 'gitlab' | 'gitea' | 'dockerhub' | 'manual';
  id: string | number;
  name: string;
  fullName: string;
  description?: string;
  htmlUrl?: string;
  cloneUrl?: string;
  defaultBranch?: string;
  language?: string;
  private?: boolean;
  image?: string;
  tag?: string;
}

interface SourceSelectorProps {
  onSelect: (source: SourceRepo) => void;
  selectedSource?: SourceRepo | null;
}

type SourceTab = 'github' | 'gitlab' | 'gitea' | 'dockerhub' | 'manual';

export default function SourceSelector({ onSelect, selectedSource }: SourceSelectorProps) {
  const [activeTab, setActiveTab] = useState<SourceTab>('github');
  const [manualUrl, setManualUrl] = useState('');
  const [manualBranch, setManualBranch] = useState('main');
  const [sourcesStatus, setSourcesStatus] = useState<any>(null);

  useEffect(() => {
    fetchSourcesStatus();
  }, []);

  const fetchSourcesStatus = async () => {
    try {
      const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';
      const res = await fetch(`${baseUrl}/sources/status`, { credentials: 'include' });
      if (res.ok) {
        setSourcesStatus(await res.json());
      }
    } catch (err) { console.error('[SourceSelector] fetchSourcesStatus error:', err); }
  };

  const tabs: { id: SourceTab; label: string; icon: any; color: string }[] = [
    { id: 'github', label: 'GitHub', icon: Github, color: 'text-gray-300' },
    { id: 'gitlab', label: 'GitLab', icon: GitLab, color: 'text-orange-400' },
    { id: 'gitea', label: 'Gitea', icon: GitCommit, color: 'text-green-400' },
    { id: 'dockerhub', label: 'Docker Hub', icon: Container, color: 'text-blue-400' },
    { id: 'manual', label: 'Manual URL', icon: LinkIcon, color: 'text-purple-400' },
  ];

  const handleGitHubSelect = (repo: any) => {
    onSelect({
      provider: 'github',
      id: repo.id,
      name: repo.name,
      fullName: repo.fullName,
      description: repo.description,
      htmlUrl: repo.htmlUrl,
      cloneUrl: repo.cloneUrl,
      defaultBranch: repo.defaultBranch,
      language: repo.language,
      private: repo.private,
    });
  };

  const handleGitLabSelect = (repo: any) => {
    onSelect({
      provider: 'gitlab',
      id: repo.id,
      name: repo.name,
      fullName: repo.fullName,
      description: repo.description,
      htmlUrl: repo.htmlUrl,
      cloneUrl: repo.cloneUrl,
      defaultBranch: repo.defaultBranch,
      language: repo.language,
    });
  };

  const handleGiteaSelect = (repo: any) => {
    onSelect({
      provider: 'gitea',
      id: repo.id,
      name: repo.name,
      fullName: repo.fullName,
      description: repo.description,
      htmlUrl: repo.htmlUrl,
      cloneUrl: repo.cloneUrl,
      defaultBranch: repo.defaultBranch,
      language: repo.language,
      private: repo.private,
    });
  };

  const handleDockerHubSelect = (image: string, tag: string) => {
    onSelect({
      provider: 'dockerhub',
      id: image,
      name: image.split('/').pop() || image,
      fullName: image,
      description: `Docker image: ${image}:${tag}`,
      cloneUrl: image,
      image,
      tag: tag || 'latest',
    });
  };

  const handleManualSelect = () => {
    if (!manualUrl.trim()) {
      toast.error('Please enter a Git URL');
      return;
    }
    onSelect({
      provider: 'manual',
      id: manualUrl,
      name: manualUrl.split('/').pop()?.replace('.git', '') || 'project',
      fullName: manualUrl,
      cloneUrl: manualUrl,
      defaultBranch: manualBranch || 'main',
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-gray-800/50 border border-gray-700">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isConnected = sourcesStatus?.[tab.id]?.connected;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              <Icon className={`h-4 w-4 ${tab.color}`} />
              <span>{tab.label}</span>
              {tab.id !== 'dockerhub' && tab.id !== 'manual' && (
                isConnected ? (
                  <CheckCircle className="h-3 w-3 text-green-400" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-gray-600" />
                )
              )}
            </button>
          );
        })}
      </div>

      <div className="min-h-[300px]">
        {activeTab === 'github' && (
          <GitHubRepoSelector onSelect={handleGitHubSelect} selectedRepo={selectedSource?.provider === 'github' ? selectedSource : null} />
        )}

        {activeTab === 'gitlab' && (
          <GitLabRepoSelector onSelect={handleGitLabSelect} selectedRepo={selectedSource?.provider === 'gitlab' ? selectedSource : null} />
        )}

        {activeTab === 'gitea' && (
          <GiteaRepoSelector onSelect={handleGiteaSelect} selectedRepo={selectedSource?.provider === 'gitea' ? selectedSource : null} />
        )}

        {activeTab === 'dockerhub' && (
          <DockerHubSelector onSelect={handleDockerHubSelect} selectedSource={selectedSource?.provider === 'dockerhub' ? selectedSource : null} />
        )}

        {activeTab === 'manual' && (
          <div className="p-4 space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <LinkIcon className="h-5 w-5 text-purple-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-white">Manual Git URL</p>
                <p className="text-xs text-gray-400 mt-1">
                  Enter any public or private Git repository URL (GitHub, GitLab, Bitbucket, or self-hosted)
                </p>
              </div>
            </div>

            {selectedSource?.provider === 'manual' && (
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-xs text-gray-400 mb-1">Selected Source</p>
                <div className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-blue-400" />
                  <span className="text-white font-medium text-sm truncate">{selectedSource.cloneUrl}</span>
                  <span className="text-xs text-gray-500">({selectedSource.defaultBranch})</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="manual-url" className="text-gray-300">Git Repository URL</Label>
              <Input
                id="manual-url"
                placeholder="https://github.com/user/repo.git or git@github.com:user/repo.git"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                className="border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 font-mono text-sm"
              />
              <p className="text-xs text-gray-500">Supports HTTPS and SSH URLs</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-branch" className="text-gray-300">Branch</Label>
              <Input
                id="manual-branch"
                placeholder="main"
                value={manualBranch}
                onChange={(e) => setManualBranch(e.target.value)}
                className="border-gray-700 bg-gray-800 text-white"
              />
            </div>

            <Button
              onClick={handleManualSelect}
              disabled={!manualUrl.trim()}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              Use This URL
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
