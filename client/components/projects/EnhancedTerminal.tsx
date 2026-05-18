'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Terminal, Loader2, Trash2, Maximize2, Minimize2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface EnhancedTerminalProps {
  projectId: string;
}

export default function EnhancedTerminal({ projectId }: EnhancedTerminalProps) {
  const [lines, setLines] = useState<Array<{ type: 'input' | 'output' | 'error' | 'info' | 'system'; text: string; timestamp?: number }>>([
    { type: 'system', text: '╔══════════════════════════════════════════════╗' },
    { type: 'system', text: '║     Container Terminal - SSH-like Access     ║' },
    { type: 'system', text: '║   Type commands below to interact with your   ║' },
    { type: 'system', text: '║   running container. Ctrl+L to clear.         ║' },
    { type: 'system', text: '╚══════════════════════════════════════════════╝' },
    { type: 'info', text: '' },
  ]);
  const [command, setCommand] = useState('');
  const [executing, setExecuting] = useState(false);
  const [pods, setPods] = useState<string[]>([]);
  const [selectedPod, setSelectedPod] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [copied, setCopied] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';

  useEffect(() => {
    fetchPods();
  }, [projectId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  useEffect(() => {
    if (!fullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        setLines([{ type: 'system', text: '╔══════════════════════════════════════════════╗' },
          { type: 'system', text: '║              Terminal Cleared                  ║' },
          { type: 'system', text: '╚══════════════════════════════════════════════╝' },
          { type: 'info', text: '' },
        ]);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [fullscreen]);

  const fetchPods = async () => {
    try {
      const res = await fetch(`${baseUrl}/container/${projectId}/pods`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const names = data.map((p: any) => p.name);
        setPods(names);
        if (names.length > 0 && !selectedPod) {
          setSelectedPod(names[0]);
        }
      }
    } catch {}
  };

  const executeCommand = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!command.trim() || executing) return;

    const cmdText = command.trim();
    setCommand('');
    setLines(prev => [...prev, { type: 'input', text: `$ ${cmdText}`, timestamp: Date.now() }]);
    setHistory(prev => [...prev, cmdText]);
    setHistoryIndex(-1);
    setExecuting(true);

    try {
      const res = await fetch(`${baseUrl}/container/${projectId}/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ command: cmdText, podName: selectedPod || undefined }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.stdout) {
          const outLines = data.stdout.split('\n').filter((l: string) => l);
          outLines.forEach((l: string) => setLines(prev => [...prev, { type: 'output', text: l }]));
        }
        if (data.stderr) {
          const errLines = data.stderr.split('\n').filter((l: string) => l);
          errLines.forEach((l: string) => setLines(prev => [...prev, { type: 'error', text: l }]));
        }
        if (!data.stdout && !data.stderr) {
          setLines(prev => [...prev, { type: 'output', text: '✔ Command completed (no output)' }]);
        }
      } else {
        const err = await res.json();
        setLines(prev => [...prev, { type: 'error', text: `✘ Error: ${err.message || 'Command failed'}` }]);
      }
    } catch (err: any) {
      setLines(prev => [...prev, { type: 'error', text: `✘ Connection error: ${err.message}` }]);
    } finally {
      setExecuting(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setCommand(history[newIndex]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;
      const newIndex = historyIndex + 1;
      if (newIndex >= history.length) {
        setHistoryIndex(-1);
        setCommand('');
      } else {
        setHistoryIndex(newIndex);
        setCommand(history[newIndex]);
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setLines([{ type: 'system', text: '╔══════════════════════════════════════════════╗' },
        { type: 'system', text: '║              Terminal Cleared                  ║' },
        { type: 'system', text: '╚══════════════════════════════════════════════╝' },
        { type: 'info', text: '' },
      ]);
    }
  };

  const copyLogs = () => {
    const text = lines.map(l => l.text).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success('Logs copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const clearTerminal = () => {
    setLines([{ type: 'system', text: '╔══════════════════════════════════════════════╗' },
      { type: 'system', text: '║              Terminal Cleared                  ║' },
      { type: 'system', text: '╚══════════════════════════════════════════════╝' },
      { type: 'info', text: '' },
    ]);
  };

  const getLineColor = (type: string) => {
    switch (type) {
      case 'input': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'info': return 'text-blue-400';
      case 'system': return 'text-cyan-400';
      default: return 'text-gray-300';
    }
  };

  const content = (
    <div className={`bg-black rounded-lg border border-gray-800 ${fullscreen ? 'fixed inset-4 z-50 flex flex-col shadow-2xl' : ''}`}
      style={{ backgroundColor: '#0a0a0a' }}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <div className="h-3 w-3 rounded-full bg-yellow-500" />
            <div className="h-3 w-3 rounded-full bg-green-500" />
          </div>
          <span className="text-xs text-gray-500 ml-2 font-mono">container-terminal</span>
        </div>
        <div className="flex items-center gap-2">
          {pods.length > 0 && (
            <select
              value={selectedPod}
              onChange={(e) => setSelectedPod(e.target.value)}
              className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300 font-mono max-w-[200px]"
              title="Select pod"
            >
              {pods.map((name) => (
                <option key={name} value={name}>{name.slice(0, 35)}</option>
              ))}
            </select>
          )}
          <button onClick={copyLogs} className="text-gray-500 hover:text-white p-1" title="Copy logs">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button onClick={clearTerminal} className="text-gray-500 hover:text-white p-1" title="Clear">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setFullscreen(!fullscreen)} className="text-gray-500 hover:text-white p-1" title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      <div className={`overflow-y-auto p-4 font-mono text-sm leading-relaxed space-y-0.5 ${fullscreen ? 'flex-1' : 'h-72'}`} style={{ backgroundColor: '#0a0a0a' }}
        onClick={() => inputRef.current?.focus()}>
        {lines.map((line, i) => (
          <div key={i} className={`${getLineColor(line.type)} whitespace-pre-wrap break-all`}>
            {line.type === 'input' && <span className="text-green-400 select-none">$ </span>}
            <span>{line.text}</span>
          </div>
        ))}
        {executing && (
          <div className="flex items-center gap-2 text-yellow-400 mt-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>executing...</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={executeCommand} className="flex items-center gap-2 border-t border-gray-800 px-4 py-2.5 bg-gray-900/30">
        <span className="text-green-400 font-mono text-sm select-none">$</span>
        <input
          ref={inputRef}
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a command..."
          disabled={executing}
          autoFocus
          className="flex-1 bg-transparent border-0 text-white font-mono text-sm focus:outline-none focus:ring-0 placeholder:text-gray-700"
        />
        <Button
          type="submit"
          disabled={executing || !command.trim()}
          size="sm"
          className="bg-green-700 hover:bg-green-600 text-xs px-3 h-7"
        >
          {executing ? <Loader2 className="h-3 w-3 animate-spin" /> : '↵'}
        </Button>
      </form>
    </div>
  );

  return (
    <Card className="border-gray-800 bg-gray-900/50 overflow-visible">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-emerald-700">
            <Terminal className="h-4 w-4 text-white" />
          </div>
          <div>
            <CardTitle className="text-white text-base">Container Terminal</CardTitle>
            <p className="text-xs text-gray-500">SSH-like access • {pods.length} pod{pods.length !== 1 ? 's' : ''} available</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {pods.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Terminal className="mb-3 h-8 w-8 text-gray-600" />
            <p className="text-gray-500 text-sm">No running pods found</p>
            <p className="text-xs text-gray-600 mt-1">Deploy your project first to access the terminal</p>
          </div>
        ) : content}
      </CardContent>
    </Card>
  );
}
