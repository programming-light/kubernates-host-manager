'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Loader2, Github, Search, CheckCircle, ExternalLink, GitFork, Lock, Globe, RefreshCw, Building2, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';

interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string;
  htmlUrl: string;
  cloneUrl: string;
  language: string;
  defaultBranch: string;
  updatedAt: string;
  private: boolean;
  fork: boolean;
}

interface GitHubInstallation {
  id: string;
  installationId: number;
  orgLogin: string;
  orgAvatar: string | null;
}

interface GitHubRepoSelectorProps {
  onSelect: (repo: GitHubRepo) => void;
  selectedRepo?: any | null;
}

export default function GitHubRepoSelector({ onSelect, selectedRepo }: GitHubRepoSelectorProps) {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [installations, setInstallations] = useState<GitHubInstallation[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';

  const checkGithubConnection = async () => {
    try {
      const res = await fetch(`${baseUrl}/auth/me`, { credentials: 'include' });
      if (res.ok) {
        const user = await res.json();
        if (user.githubToken || user.githubUsername) {
          setGithubConnected(true);
          setGithubUsername(user.githubUsername);
          fetchRepos();
          fetchInstallations();
        }
      }
    } catch (err) { console.error('[GitHubRepoSelector] checkGithubConnection error:', err); }
  };

  useEffect(() => {
    checkGithubConnection();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('github') === 'connected') {
      setGithubConnected(true);
      toast.success('GitHub connected successfully!');
      fetchRepos();
      fetchInstallations();
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('error')) {
      toast.error(`GitHub connection failed: ${params.get('error')}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const fetchRepos = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/github/repos`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRepos(data);
      } else {
        const err = await res.json();
        if (res.status === 400) {
          setGithubConnected(false);
        }
        toast.error(err.message || 'Failed to fetch repos');
      }
    } catch (err: any) {
      toast.error('Failed to fetch repositories');
    } finally {
      setLoading(false);
    }
  };

  const fetchInstallations = async () => {
    try {
      const res = await fetch(`${baseUrl}/github/installations`, { credentials: 'include' });
      if (res.ok) {
        setInstallations(await res.json());
      }
    } catch {}
  };

  const connectGithub = () => {
    setConnecting(true);
    window.location.href = `${baseUrl}/github/login`;
  };

  const disconnectGithub = async () => {
    try {
      const res = await fetch(`${baseUrl}/github/disconnect`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setGithubConnected(false);
        setGithubUsername(null);
        setRepos([]);
        setInstallations([]);
        toast.success('GitHub disconnected');
      } else {
        toast.error('Failed to disconnect GitHub');
      }
    } catch {
      toast.error('Failed to disconnect GitHub');
    }
  };

  const installGithubApp = () => {
    setInstalling(true);
    window.location.href = `${baseUrl}/github/install`;
  };

  const filteredRepos = repos.filter(repo =>
    !searchQuery || repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    repo.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getLanguageColor = (lang: string) => {
    const colors: Record<string, string> = {
      JavaScript: 'bg-yellow-400',
      TypeScript: 'bg-blue-500',
      Python: 'bg-green-500',
      Go: 'bg-cyan-500',
      Rust: 'bg-orange-500',
      Java: 'bg-red-500',
      Ruby: 'bg-red-600',
      PHP: 'bg-purple-500',
      C: 'bg-gray-500',
      'C++': 'bg-pink-500',
      'C#': 'bg-green-600',
      Shell: 'bg-gray-400',
      Dockerfile: 'bg-blue-400',
      HTML: 'bg-orange-400',
      CSS: 'bg-purple-400',
    };
    return colors[lang] || 'bg-gray-500';
  };

  return (
    <div className="space-y-4">
      {!githubConnected ? (
        <div className="p-6 rounded-lg border border-gray-700 bg-gray-800/30 text-center">
          <Github className="h-12 w-12 text-gray-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white mb-2">Connect GitHub</h3>
          <p className="text-sm text-gray-400 mb-4">
            Connect your GitHub account to browse and select repositories
          </p>
          <Button onClick={connectGithub} disabled={connecting} className="bg-gray-800 hover:bg-gray-700 border border-gray-700">
            {connecting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Github className="h-4 w-4 mr-2" />
            )}
            Connect GitHub
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <span className="text-green-400 text-sm flex-1">
              Connected as {githubUsername || 'GitHub user'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchRepos}
              className="text-gray-400 hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDisconnectOpen(true)}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              Disconnect
            </Button>
          </div>

          {installations.length > 0 && (
            <div className="p-3 rounded-lg border border-gray-700 bg-gray-800/20">
              <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                <Building2 className="h-3 w-3" /> Organization Access
              </p>
              <div className="space-y-1">
                {installations.map((inst) => (
                  <div key={inst.id} className="flex items-center gap-2 text-sm text-gray-300">
                    {inst.orgAvatar ? (
                      <img src={inst.orgAvatar} alt={inst.orgLogin} className="h-5 w-5 rounded-full" />
                    ) : (
                      <Building2 className="h-4 w-4 text-gray-500" />
                    )}
                    <span>{inst.orgLogin}</span>
                    <CheckCircle className="h-3 w-3 text-green-400 ml-auto" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={installGithubApp}
              disabled={installing}
              className="border-gray-700 text-gray-700 hover:text-white hover:bg-gray-800"
            >
              {installing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <PlusCircle className="h-4 w-4 mr-2" />
              )}
              ADD PROJECT
            </Button>
          </div>

          {selectedRepo && (
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-xs text-gray-400 mb-1">Selected Repository</p>
              <div className="flex items-center gap-2">
                <Github className="h-4 w-4 text-blue-400" />
                <span className="text-white font-medium">{selectedRepo.fullName}</span>
                {selectedRepo.private && <Lock className="h-3 w-3 text-yellow-400" />}
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
                <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
              </div>
            ) : filteredRepos.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Github className="h-8 w-8 mx-auto mb-2" />
                <p>No repositories found</p>
                <p className="text-xs mt-1">Try adding organization access above</p>
              </div>
            ) : (
              filteredRepos.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => onSelect(repo)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedRepo?.id === repo.id
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-800 bg-gray-800/30 hover:bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Github className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-white truncate">
                          {repo.fullName}
                        </span>
                        {repo.private && <Lock className="h-3 w-3 text-yellow-400 flex-shrink-0" />}
                        {repo.fork && <GitFork className="h-3 w-3 text-gray-500 flex-shrink-0" />}
                      </div>
                      {repo.description && (
                        <p className="text-xs text-gray-500 mt-1 truncate">{repo.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        {repo.language && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <span className={`h-2 w-2 rounded-full ${getLanguageColor(repo.language)}`} />
                            {repo.language}
                          </span>
                        )}
                        <span className="text-xs text-gray-500">{repo.defaultBranch}</span>
                      </div>
                    </div>
                    {selectedRepo?.id === repo.id && (
                      <CheckCircle className="h-5 w-5 text-blue-400 flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}
      <ConfirmDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        title="Disconnect GitHub"
        message="Are you sure you want to disconnect GitHub? You will lose access to your repositories and will need to reconnect to select them again."
        confirmLabel="Disconnect"
        variant="destructive"
        onConfirm={disconnectGithub}
      />
    </div>
  );
}
