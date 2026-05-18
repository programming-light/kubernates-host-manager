'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from '@/components/ui/modal';
import { Loader2, Globe, Plus, Trash2, ExternalLink, CheckCircle, XCircle, RefreshCw, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface Domain {
  id: string;
  domain: string;
  isCustom: boolean;
  isPrimary: boolean;
  sslEnabled: boolean;
  status: string;
  createdAt: string;
}

interface DomainManagerProps {
  projectId: string;
}

const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';

export default function DomainManager({ projectId }: DomainManagerProps) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [adding, setAdding] = useState(false);
  const [suggestedDomain, setSuggestedDomain] = useState<string | null>(null);

  useEffect(() => {
    fetchDomains();
    fetchSuggestedDomain();
  }, [projectId]);

  const fetchDomains = async () => {
    try {
      const res = await fetch(`${baseUrl}/container/${projectId}/domains`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDomains(Array.isArray(data) ? data : []);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  const fetchSuggestedDomain = async () => {
    try {
      const res = await fetch(`${baseUrl}/container/${projectId}/domain/suggest`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSuggestedDomain(data.autoDomain);
      }
    } catch {}
  };

  const addDomain = async () => {
    if (!newDomain.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`${baseUrl}/container/${projectId}/domain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ domain: newDomain.trim() }),
      });
      if (res.ok) {
        toast.success('Domain added successfully');
        setShowAdd(false);
        setNewDomain('');
        fetchDomains();
      } else {
        const err = await res.json();
        toast.error(err.message || 'Failed to add domain');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to add domain');
    } finally {
      setAdding(false);
    }
  };

  const removeDomain = async (domainId: string) => {
    try {
      const res = await fetch(`${baseUrl}/container/${projectId}/domains/${domainId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Domain removed');
        fetchDomains();
      } else {
        const err = await res.json();
        toast.error(err.message || 'Failed to remove domain');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove domain');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <>
      <Card className="border-gray-800 bg-gray-900/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-700">
                <Globe className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-white text-base">Domains</CardTitle>
                <p className="text-xs text-gray-500">{domains.length} domain{domains.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="flex gap-1.5">
              <button onClick={fetchDomains} className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-800" title="Refresh">
                <RefreshCw className="h-4 w-4" />
              </button>
              <Button size="sm" onClick={() => setShowAdd(true)} className="bg-purple-600 hover:bg-purple-700 h-8 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Domain
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
            </div>
          ) : domains.length === 0 && !suggestedDomain ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Globe className="mb-3 h-8 w-8 text-gray-600" />
              <p className="text-gray-500 text-sm">No domains configured</p>
              <p className="text-xs text-gray-600 mt-1">Add a domain to access your project</p>
            </div>
          ) : (
            <div className="space-y-2">
              {domains.map((domain) => (
                <div key={domain.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 p-3 hover:bg-gray-800/50 group">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Globe className={`h-5 w-5 flex-shrink-0 ${domain.status === 'active' ? 'text-green-400' : 'text-gray-500'}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white truncate">{domain.domain}</span>
                        {domain.isPrimary && <span className="text-xs bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">Primary</span>}
                        {domain.sslEnabled && <span className="text-xs bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded">SSL</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {domain.status === 'active' ? (
                          <span className="flex items-center gap-1 text-xs text-green-500"><CheckCircle className="h-3 w-3" /> Active</span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-yellow-500"><Loader2 className="h-3 w-3 animate-spin" /> {domain.status}</span>
                        )}
                        {domain.isCustom ? (
                          <span className="text-xs text-gray-500">Custom domain</span>
                        ) : (
                          <span className="text-xs text-gray-500">Auto-generated</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a href={`https://${domain.domain}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded text-gray-500 hover:text-blue-400 hover:bg-gray-700">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button onClick={() => copyToClipboard(domain.domain)} className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-gray-700">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => removeDomain(domain.id)} className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-gray-700">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {suggestedDomain && (
                <div className="flex items-center justify-between rounded-lg border border-blue-900/50 bg-blue-900/10 p-3">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-400" />
                    <span className="text-sm text-blue-300 font-mono">{suggestedDomain}</span>
                    <span className="text-xs text-blue-500">(auto-suggested)</span>
                  </div>
                  <button onClick={() => copyToClipboard(suggestedDomain)} className="p-1 rounded text-blue-400 hover:text-blue-300">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal open={showAdd} onOpenChange={setShowAdd}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Add Custom Domain</ModalTitle>
            <ModalDescription>
              Point your domain's A record to your cluster IP, then add it below.
            </ModalDescription>
          </ModalHeader>
          <div className="p-4">
            <Input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="example.com"
              className="bg-gray-800 border-gray-700 text-white font-mono"
              onKeyDown={(e) => e.key === 'Enter' && addDomain()}
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-2">
              Make sure your domain's DNS A record points to your cluster's IP address before adding.
            </p>
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} className="border-gray-700 text-gray-300 hover:bg-gray-800">
              Cancel
            </Button>
            <Button onClick={addDomain} disabled={adding || !newDomain.trim()} className="bg-purple-600 hover:bg-purple-700">
              {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Add Domain
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
