'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, GitlabIcon as GitLab, Search, CheckCircle, ExternalLink, RefreshCw, Globe, Lock } from 'lucide-react';
import { toast } from 'sonner';

interface GitLabRepo {
  id: number;
  name: string;
  fullName: string;
  description: string;
  htmlUrl: string;
  cloneUrl: string;
  language: string;
  defaultBranch: string;
  updatedAt: string;
  visibility: string;
}

interface GitLabRepoSelectorProps {
  onSelect: (repo: GitLabRepo) => void;
  selectedRepo?: any | null;
}

export default function GitLabRepoSelector({ onSelect, selectedRepo }: GitLabRepoSelectorProps) {
  const [repos, setRepos] = useState<GitLabRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';

  const checkConnection = async () => {
    try {
      const res = await fetch(`${baseUrl}/sources/status`, { credentials: 'include' });
      if (res.ok) {
        const status = await res.json();
        if (status.gitlab?.connected) {
          setConnected(true);
          setUsername(status.gitlab.username);
          fetchRepos();
        }
      }
    } catch (err) { console.error('[GitLabRepoSelector] checkConnection error:', err); }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('gitlab') === 'connected') {
      setConnected(true);
      toast.success('GitLab connected successfully!');
      fetchRepos();
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('error')?.includes('gitlab')) {
      toast.error(`GitLab connection failed: ${params.get('error')}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const fetchRepos = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/sources/gitlab/repos`, { credentials: 'include' });
      if (res.ok) {
        setRepos(await res.json());
      } else {
        const err = await res.json();
        if (res.status === 400) setConnected(false);
        toast.error(err.message || 'Failed to fetch repos');
      }
    } catch {
      toast.error('Failed to fetch repositories');
    } finally {
      setLoading(false);
    }
  };

  const connect = () => {
    setConnecting(true);
    window.location.href = `${baseUrl}/sources/gitlab/login`;
  };

  const filteredRepos = repos.filter(repo =>
    !searchQuery || repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    repo.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {!connected ? (
        <div className="p-6 rounded-lg border border-gray-700 bg-gray-800/30 text-center">
          <GitLab className="h-12 w-12 text-gray-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white mb-2">Connect GitLab</h3>
          <p className="text-sm text-gray-400 mb-4">
            Connect your GitLab.com account to browse and select repositories
          </p>
          <Button onClick={connect} disabled={connecting} className="bg-orange-600 hover:bg-orange-700">
            {connecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <GitLab className="h-4 w-4 mr-2" />}
            Connect GitLab
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <span className="text-green-400 text-sm flex-1">Connected as {username || 'GitLab user'}</span>
            <Button variant="ghost" size="sm" onClick={fetchRepos} className="text-gray-400 hover:text-white">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {selectedRepo && (
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-xs text-gray-400 mb-1">Selected Repository</p>
              <div className="flex items-center gap-2">
                <GitLab className="h-4 w-4 text-orange-400" />
                <span className="text-white font-medium">{selectedRepo.fullName}</span>
                <span className="text-xs text-gray-500">({selectedRepo.defaultBranch})</span>
              </div>
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 border-gray-700 bg-gray-800 text-white placeholder:text-gray-500"
            />
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
              </div>
            ) : filteredRepos.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <GitLab className="h-8 w-8 mx-auto mb-2" />
                <p>No repositories found</p>
              </div>
            ) : (
              filteredRepos.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => onSelect(repo)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedRepo?.id === repo.id
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-gray-800 bg-gray-800/30 hover:bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <GitLab className="h-4 w-4 text-orange-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-white truncate">{repo.fullName}</span>
                        {repo.visibility === 'private' && <Lock className="h-3 w-3 text-yellow-400 flex-shrink-0" />}
                      </div>
                      {repo.description && (
                        <p className="text-xs text-gray-500 mt-1 truncate">{repo.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        {repo.language && (
                          <span className="text-xs text-gray-400">{repo.language}</span>
                        )}
                        <span className="text-xs text-gray-500">{repo.defaultBranch}</span>
                      </div>
                    </div>
                    {selectedRepo?.id === repo.id && (
                      <CheckCircle className="h-5 w-5 text-orange-400 flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
