'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Terminal as TerminalIcon, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface TerminalProps {
  projectId: string;
}

export default function Terminal({ projectId }: TerminalProps) {
  const [lines, setLines] = useState<Array<{ type: 'input' | 'output' | 'error' | 'info'; text: string }>>([
    { type: 'info', text: '# Welcome to Container Terminal' },
    { type: 'info', text: '# Type commands to execute in the running container' },
    { type: 'info', text: '# Example: ls, ps aux, env, node --version, python --version' },
    { type: 'info', text: '' },
  ]);
  const [command, setCommand] = useState('');
  const [executing, setExecuting] = useState(false);
  const [podName, setPodName] = useState<string | null>(null);
  const [pods, setPods] = useState<string[]>([]);
  const [selectedPod, setSelectedPod] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';

  useEffect(() => {
    fetchPods();
  }, [projectId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const fetchPods = async () => {
    try {
      const res = await fetch(`${baseUrl}/container/${projectId}/pods`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const names = data.map((p: any) => p.name);
        setPods(names);
        if (names.length > 0 && !selectedPod) {
          setSelectedPod(names[0]);
          setPodName(names[0]);
        }
      }
    } catch (err) { console.error('[Terminal] fetchPods error:', err); }
  };

  const executeCommand = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!command.trim() || executing) return;

    const cmdText = command.trim();
    setCommand('');
    setLines(prev => [...prev, { type: 'input', text: `$ ${cmdText}` }]);
    setExecuting(true);

    try {
      const res = await fetch(`${baseUrl}/container/${projectId}/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          command: cmdText,
          podName: selectedPod || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.stdout) {
          setLines(prev => [...prev, { type: 'output', text: data.stdout }]);
        }
        if (data.stderr) {
          setLines(prev => [...prev, { type: 'error', text: data.stderr }]);
        }
        if (!data.stdout && !data.stderr) {
          setLines(prev => [...prev, { type: 'output', text: '(no output)' }]);
        }
      } else {
        const err = await res.json();
        setLines(prev => [...prev, { type: 'error', text: `Error: ${err.message || 'Command failed'}` }]);
      }
    } catch (err: any) {
      setLines(prev => [...prev, { type: 'error', text: `Connection error: ${err.message}` }]);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <Card className="border-gray-800 bg-gray-900/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TerminalIcon className="h-5 w-5 text-green-400" />
            <CardTitle className="text-white">Container Terminal</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {pods.length > 0 && (
              <select
                value={selectedPod}
                onChange={(e) => setSelectedPod(e.target.value)}
                className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300"
              >
                {pods.map((name) => (
                  <option key={name} value={name}>{name.slice(0, 30)}...</option>
                ))}
              </select>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLines([{ type: 'info', text: '# Terminal cleared' }])}
              className="text-gray-400 hover:text-white"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-black rounded-lg border border-gray-800">
          <div className="h-64 overflow-y-auto p-4 font-mono text-sm space-y-1" style={{ backgroundColor: '#0a0a0a' }}>
            {lines.map((line, i) => (
              <div key={i} className={
                line.type === 'input' ? 'text-green-400' :
                line.type === 'error' ? 'text-red-400' :
                line.type === 'info' ? 'text-blue-400' :
                'text-gray-300'
              }>
                <pre className="whitespace-pre-wrap break-all">{line.text}</pre>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <form onSubmit={executeCommand} className="flex items-center gap-2 border-t border-gray-800 p-2">
            <span className="text-green-400 font-mono text-sm">$</span>
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Type a command..."
              disabled={executing}
              className="flex-1 bg-transparent border-0 text-white font-mono text-sm focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-gray-600"
            />
            <Button
              type="submit"
              disabled={executing || !command.trim()}
              size="sm"
              className="bg-green-700 hover:bg-green-600 text-xs px-3"
            >
              {executing ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Run'}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
