'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from '@/components/ui/modal';
import { Loader2, Rocket, RotateCcw, Clock, CheckCircle, XCircle, GitCommit, User, RefreshCw, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';

interface Pipeline {
  id: string;
  projectId: string;
  userId: string;
  status: string;
  branch: string;
  imageTag: string | null;
  lastCommitSha: string | null;
  lastCommitMsg: string | null;
  duration: number | null;
  triggeredBy: string;
  createdAt: string;
  buildLog: string | null;
}

interface DeploymentHistoryProps {
  projectId: string;
  onDeploy?: () => void;
}

const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';

export default function DeploymentHistory({ projectId, onDeploy }: DeploymentHistoryProps) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [rollbackTarget, setRollbackTarget] = useState<Pipeline | null>(null);
  const [rollingBack, setRollingBack] = useState(false);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    fetchPipelines();
  }, [projectId]);

  const fetchPipelines = async () => {
    try {
      const res = await fetch(`${baseUrl}/cicd/${projectId}/pipelines`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPipelines(Array.isArray(data) ? data : []);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  const triggerDeploy = async () => {
    setTriggering(true);
    try {
      const res = await fetch(`${baseUrl}/cicd/${projectId}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (res.ok) {
        toast.success('Deployment triggered');
        onDeploy?.();
        setTimeout(fetchPipelines, 2000);
      } else {
        const err = await res.json();
        toast.error(err.message || 'Failed to trigger deployment');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to trigger deployment');
    } finally {
      setTriggering(false);
    }
  };

  const initiateRollback = async () => {
    if (!rollbackTarget) return;
    setRollingBack(true);
    try {
      const res = await fetch(`${baseUrl}/cicd/${projectId}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          branch: rollbackTarget.branch,
          commitSha: rollbackTarget.lastCommitSha,
          commitMsg: `Rollback to ${rollbackTarget.imageTag || 'previous deployment'}`,
        }),
      });
      if (res.ok) {
        toast.success(`Rolling back to ${rollbackTarget.imageTag || 'previous version'}...`);
        setRollbackTarget(null);
        onDeploy?.();
        setTimeout(fetchPipelines, 3000);
      } else {
        const err = await res.json();
        toast.error(err.message || 'Rollback failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Rollback failed');
    } finally {
      setRollingBack(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    switch (s) {
      case 'SUCCESS':
        return <span className="flex items-center gap-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 px-2.5 py-0.5 text-xs"><CheckCircle className="h-3 w-3" /> Success</span>;
      case 'FAILED':
        return <span className="flex items-center gap-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-0.5 text-xs"><XCircle className="h-3 w-3" /> Failed</span>;
      case 'BUILDING':
      case 'DEPLOYING':
        return <span className="flex items-center gap-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2.5 py-0.5 text-xs"><Loader2 className="h-3 w-3 animate-spin" /> {s}</span>;
      case 'CANCELLED':
        return <span className="flex items-center gap-1 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20 px-2.5 py-0.5 text-xs">Cancelled</span>;
      default:
        return <span className="flex items-center gap-1 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20 px-2.5 py-0.5 text-xs">{status}</span>;
    }
  };

  return (
    <>
      <Card className="border-gray-800 bg-gray-900/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-red-700">
                <Rocket className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-white text-base">Deployment History</CardTitle>
                <p className="text-xs text-gray-500">{pipelines.length} deployment{pipelines.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={fetchPipelines} className="border-gray-700 text-gray-300 hover:bg-gray-800 h-8">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" onClick={triggerDeploy} disabled={triggering} className="bg-orange-600 hover:bg-orange-700 h-8 text-xs">
                {triggering ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Rocket className="h-3.5 w-3.5 mr-1" />}
                Deploy Now
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
            </div>
          ) : pipelines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Rocket className="mb-3 h-8 w-8 text-gray-600" />
              <p className="text-gray-500 text-sm">No deployments yet</p>
              <p className="text-xs text-gray-600 mt-1">Click "Deploy Now" to create your first deployment</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[17px] top-3 bottom-3 w-0.5 bg-gray-800" />
              <div className="space-y-4">
                {pipelines.map((pipeline, idx) => (
                  <div key={pipeline.id} className="relative flex gap-4 pl-8">
                    <div className="absolute left-[10px] top-1.5 h-4 w-4 rounded-full border-2 border-gray-700 bg-gray-900 flex items-center justify-center">
                      <div className={`h-2 w-2 rounded-full ${
                        pipeline.status === 'SUCCESS' ? 'bg-green-500' :
                        pipeline.status === 'FAILED' ? 'bg-red-500' :
                        pipeline.status === 'BUILDING' || pipeline.status === 'DEPLOYING' ? 'bg-yellow-500 animate-pulse' :
                        'bg-gray-600'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-white">
                              v{pipeline.imageTag ? pipeline.imageTag.slice(0, 12) : `#${pipelines.length - idx}`}
                            </span>
                            {getStatusBadge(pipeline.status)}
                            {idx === 0 && pipeline.status === 'SUCCESS' && (
                              <span className="text-xs text-green-500 flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" /> Current
                              </span>
                            )}
                          </div>
                          {pipeline.lastCommitMsg && (
                            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                              <GitCommit className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{pipeline.lastCommitMsg}</span>
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            {pipeline.lastCommitSha && (
                              <span className="font-mono">{pipeline.lastCommitSha.slice(0, 7)}</span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(pipeline.createdAt).toLocaleString()}
                            </span>
                            {pipeline.duration && (
                              <span>{pipeline.duration}s</span>
                            )}
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {pipeline.triggeredBy}
                            </span>
                          </div>
                        </div>
                        <div className="flex-shrink-0 flex gap-1">
                          {pipeline.status === 'SUCCESS' && idx > 0 && (
                            <button
                              onClick={() => setRollbackTarget(pipeline)}
                              className="p-1.5 rounded text-gray-500 hover:text-orange-400 hover:bg-gray-800 transition-colors"
                              title={`Rollback to v${pipeline.imageTag ? pipeline.imageTag.slice(0, 12) : `#${pipelines.length - idx}`}`}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal open={!!rollbackTarget} onOpenChange={(open) => { if (!open) setRollbackTarget(null); }}>
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10">
                <RotateCcw className="h-5 w-5 text-orange-400" />
              </div>
              <ModalTitle>Rollback Deployment</ModalTitle>
            </div>
            <ModalDescription className="pt-3">
              Are you sure you want to rollback to this deployment? This will re-deploy the previous version.
              {rollbackTarget?.lastCommitMsg && (
                <div className="mt-2 p-2 rounded bg-gray-800 text-xs text-gray-300">
                  <p className="font-mono">{rollbackTarget.lastCommitSha?.slice(0, 7)} - {rollbackTarget.lastCommitMsg}</p>
                  <p className="text-gray-500 mt-1">
                    Deployed {new Date(rollbackTarget.createdAt).toLocaleString()}
                  </p>
                </div>
              )}
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button variant="outline" onClick={() => setRollbackTarget(null)} disabled={rollingBack} className="border-gray-700 text-gray-300 hover:bg-gray-800">
              Cancel
            </Button>
            <Button onClick={initiateRollback} disabled={rollingBack} className="bg-orange-600 hover:bg-orange-700">
              {rollingBack ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
              Rollback
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
