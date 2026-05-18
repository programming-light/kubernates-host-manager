'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, GitCommit, Search, CheckCircle, RefreshCw, Lock, Globe, Server } from 'lucide-react';
import { toast } from 'sonner';

interface GiteaRepo {
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
}

interface GiteaRepoSelectorProps {
  onSelect: (repo: GiteaRepo) => void;
  selectedRepo?: any | null;
}

export default function GiteaRepoSelector({ onSelect, selectedRepo }: GiteaRepoSelectorProps) {
  const [repos, setRepos] = useState<GiteaRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [giteaUrl, setGiteaUrl] = useState('https://gitea.com');
  const [showSetup, setShowSetup] = useState(false);
  const [testUrl, setTestUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';

  const checkConnection = async () => {
    try {
      const res = await fetch(`${baseUrl}/sources/status`, { credentials: 'include' });
      if (res.ok) {
        const status = await res.json();
        if (status.gitea?.connected) {
          setConnected(true);
          setUsername(status.gitea.username);
          setGiteaUrl(status.gitea.url || 'https://gitea.com');
          fetchRepos();
        }
      }
    } catch (err) { console.error('[GiteaRepoSelector] checkConnection error:', err); }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('gitea') === 'connected') {
      setConnected(true);
      toast.success('Gitea connected successfully!');
      fetchRepos();
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('error')?.includes('gitea')) {
      toast.error(`Gitea connection failed: ${params.get('error')}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const fetchRepos = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/sources/gitea/repos`, { credentials: 'include' });
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

  const testAndConnect = async () => {
    if (!testUrl.trim()) {
      toast.error('Enter a Gitea server URL');
      return;
    }
    setTesting(true);
    try {
      const res = await fetch(`${baseUrl}/sources/gitea/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: testUrl.replace(/\/$/, '') }),
      });
      if (res.ok) {
        setGiteaUrl(testUrl.replace(/\/$/, ''));
        setShowSetup(false);
        startOAuth();
      } else {
        const err = await res.json();
        toast.error(err.message || 'Cannot connect to Gitea server');
      }
    } catch {
      toast.error('Failed to verify Gitea server');
    } finally {
      setTesting(false);
    }
  };

  const startOAuth = () => {
    setConnecting(true);
    const params = testUrl ? `?serverUrl=${encodeURIComponent(testUrl)}` : '';
    window.location.href = `${baseUrl}/sources/gitea/login${params}`;
  };

  const filteredRepos = repos.filter(repo =>
    !searchQuery || repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    repo.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {!connected ? (
        <div className="space-y-4">
          <div className="p-6 rounded-lg border border-gray-700 bg-gray-800/30 text-center">
            <GitCommit className="h-12 w-12 text-gray-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white mb-2">Connect Gitea</h3>
            <p className="text-sm text-gray-400 mb-4">
              Connect to Gitea.com or your self-hosted Gitea instance
            </p>

            {!showSetup ? (
              <div className="flex gap-3 justify-center">
                <Button onClick={startOAuth} disabled={connecting} className="bg-green-700 hover:bg-green-800">
                  {connecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <GitCommit className="h-4 w-4 mr-2" />}
                  Connect Gitea.com
                </Button>
                <Button onClick={() => setShowSetup(true)} variant="outline" className="border-gray-600 text-gray-300">
                  <Server className="h-4 w-4 mr-2" />
                  Self-Hosted
                </Button>
              </div>
            ) : (
              <div className="space-y-3 max-w-sm mx-auto">
                <Label htmlFor="gitea-url" className="text-gray-300">Gitea Server URL</Label>
                <Input
                  id="gitea-url"
                  placeholder="https://gitea.yourdomain.com"
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                  className="border-gray-700 bg-gray-800 text-white placeholder:text-gray-500"
                />
                <div className="flex gap-2">
                  <Button onClick={testAndConnect} disabled={testing} className="flex-1 bg-green-700 hover:bg-green-800">
                    {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Verify & Connect
                  </Button>
                  <Button onClick={() => setShowSetup(false)} variant="ghost" className="text-gray-400">
                    Back
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <span className="text-green-400 text-sm flex-1">
              Connected as {username} on {giteaUrl}
            </span>
            <Button variant="ghost" size="sm" onClick={fetchRepos} className="text-gray-400 hover:text-white">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {selectedRepo && (
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-xs text-gray-400 mb-1">Selected Repository</p>
              <div className="flex items-center gap-2">
                <GitCommit className="h-4 w-4 text-green-400" />
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
                <Loader2 className="h-6 w-6 animate-spin text-green-400" />
              </div>
            ) : filteredRepos.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <GitCommit className="h-8 w-8 mx-auto mb-2" />
                <p>No repositories found</p>
              </div>
            ) : (
              filteredRepos.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => onSelect(repo)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedRepo?.id === repo.id
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-gray-800 bg-gray-800/30 hover:bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <GitCommit className="h-4 w-4 text-green-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-white truncate">{repo.fullName}</span>
                        {repo.private && <Lock className="h-3 w-3 text-yellow-400 flex-shrink-0" />}
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
                      <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
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
