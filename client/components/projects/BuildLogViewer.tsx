'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Clock, CheckCircle2, XCircle, Terminal as TerminalIcon } from 'lucide-react';
import { toast } from 'sonner';

interface BuildLogViewerProps {
  projectId: string;
}

export default function BuildLogViewer({ projectId }: BuildLogViewerProps) {
  const [logs, setLogs] = useState<string>('');
  const [status, setStatus] = useState<string>('unknown');
  const [imageTag, setImageTag] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [triggeredAt, setTriggeredAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${baseUrl}/container/${projectId}/build-logs`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || 'No build logs available');
        setStatus(data.status || 'unknown');
        setImageTag(data.imageTag);
        setDuration(data.duration);
        setTriggeredAt(data.triggeredAt);
      }
    } catch (err: any) {
      toast.error('Failed to fetch build logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [projectId]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getStatusBadge = () => {
    switch (status) {
      case 'SUCCESS': return { icon: CheckCircle2, color: 'text-green-400 bg-green-500/10 border-green-500/20' };
      case 'FAILED': return { icon: XCircle, color: 'text-red-400 bg-red-500/10 border-red-500/20' };
      case 'BUILDING': case 'DEPLOYING': return { icon: Loader2, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' };
      default: return { icon: TerminalIcon, color: 'text-gray-400 bg-gray-500/10 border-gray-500/20' };
    }
  };

  const badge = getStatusBadge();
  const Icon = badge.icon;

  return (
    <Card className="border-gray-800 bg-gray-900/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TerminalIcon className="h-5 w-5 text-blue-400" />
            <CardTitle className="text-white">Build Logs</CardTitle>
          </div>
          <div className="flex items-center gap-3">
            <span className={`rounded-full border px-3 py-1 text-xs flex items-center gap-1 ${badge.color}`}>
              <Icon className={`h-3 w-3 ${status === 'BUILDING' ? 'animate-spin' : ''}`} />
              {status}
            </span>
            {duration && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Clock className="h-3 w-3" /> {duration}s
              </span>
            )}
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-600"
              />
              Auto-refresh
            </label>
            <Button variant="ghost" size="sm" onClick={fetchLogs} className="text-gray-400 hover:text-white">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {imageTag && (
          <p className="text-xs text-gray-500 mt-1">Image tag: {imageTag}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="bg-black rounded-lg border border-gray-800">
          <div className="h-64 overflow-y-auto p-4 font-mono text-xs leading-relaxed" style={{ backgroundColor: '#0a0a0a' }}>
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
              </div>
            ) : (
              <pre className="text-gray-300 whitespace-pre-wrap break-all">
                {logs || 'No build logs available'}
              </pre>
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
