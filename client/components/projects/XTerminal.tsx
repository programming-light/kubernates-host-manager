'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Terminal, Loader2, Maximize2, Minimize2, Copy, Check, Trash2, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

interface XTerminalProps {
  projectId: string;
}

export default function XTerminal({ projectId }: XTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<any>(null);
  const socketRef = useRef<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [connId, setConnId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [pods, setPods] = useState<string[]>([]);
  const [selectedPod, setSelectedPod] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchPods();
    const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const sock = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });
    socketRef.current = sock;

    sock.on('connect', () => {
      setSocketConnected(true);
    });
    sock.on('disconnect', () => {
      setSocketConnected(false);
    });

    return () => {
      sock.disconnect();
      socketRef.current = null;
    };
  }, [projectId]);

  useEffect(() => {
    const sock = socketRef.current;
    if (!sock || !connId) return;

    const onData = (data: { connId: string; data: string; stream: string }) => {
      if (data.connId !== connId) return;
      if (xtermRef.current) {
        xtermRef.current.write(data.data);
      }
    };

    const onExit = (data: { connId: string; code: number }) => {
      if (data.connId !== connId) return;
      if (xtermRef.current) {
        xtermRef.current.write(`\r\n\x1b[33m[Process exited with code ${data.code}]\x1b[0m\r\n`);
      }
      setConnId(null);
      setConnecting(false);
    };

    sock.on('terminal:data', onData);
    sock.on('terminal:exit', onExit);

    return () => {
      sock.off('terminal:data', onData);
      sock.off('terminal:exit', onExit);
    };
  }, [connId]);

  useEffect(() => {
    if (!connId || !terminalRef.current) return;

    let term: any;
    const initTerm = async () => {
      try {
        const { Terminal: XTerm } = await import('xterm');
        term = new XTerm({
          cursorBlink: true,
          cursorStyle: 'block',
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
          theme: {
            background: '#0a0a0a',
            foreground: '#d4d4d4',
            cursor: '#528bff',
            selectionBackground: '#264f78',
            black: '#000000',
            red: '#f44747',
            green: '#6a9955',
            yellow: '#d7ba7d',
            blue: '#569cd6',
            magenta: '#c586c0',
            cyan: '#4fc1ff',
            white: '#d4d4d4',
            brightBlack: '#808080',
            brightRed: '#f44747',
            brightGreen: '#6a9955',
            brightYellow: '#d7ba7d',
            brightBlue: '#569cd6',
            brightMagenta: '#c586c0',
            brightCyan: '#4fc1ff',
            brightWhite: '#ffffff',
          },
          allowProposedApi: true,
          cols: Math.floor((terminalRef.current?.clientWidth || 800) / 9),
          rows: Math.floor((terminalRef.current?.clientHeight || 400) / 20),
        });

        term.open(terminalRef.current!);
        term.focus();

        const sock = socketRef.current;

        term.onData((data: string) => {
          if (sock) {
            sock.emit('terminal:input', { connId, data });
          }
        });

        term.write('\x1b[32m╔══════════════════════════════════════╗\x1b[0m\r\n');
        term.write('\x1b[32m║  Container Terminal (SSH Session)  ║\x1b[0m\r\n');
        term.write('\x1b[32m╚══════════════════════════════════════╝\x1b[0m\r\n\r\n');

        xtermRef.current = term;

        term.attachCustomKeyEventHandler((arg: any) => {
          if (arg.type === 'keydown' && arg.ctrlKey && arg.code === 'KeyL') {
            term.clear();
            return false;
          }
          return true;
        });
      } catch (err) {
        console.error('Failed to init xterm:', err);
      }
    };

    initTerm();

    return () => {
      if (term) {
        term.dispose();
        xtermRef.current = null;
      }
    };
  }, [connId]);

  const fetchPods = async () => {
    try {
      const res = await api.get(`/container/${projectId}/pods`);
      const data = await res.json();
      const names = data.map((p: any) => p.name);
      setPods(names);
      if (names.length > 0 && !selectedPod) setSelectedPod(names[0]);
    } catch {}
  };

  const connectTerminal = useCallback(() => {
    const sock = socketRef.current;
    if (!sock || !sock.connected || connecting || connId) return;
    setConnecting(true);

    sock.emit('terminal:connect', { projectId, podName: selectedPod || undefined }, (response: any) => {
      if (response?.error) {
        toast.error(response.error);
        setConnecting(false);
      } else if (response?.connId) {
        setConnId(response.connId);
        setConnecting(false);
      }
    });

    setTimeout(() => setConnecting(false), 15000);
  }, [projectId, selectedPod, connecting, connId]);

  const disconnectTerminal = useCallback(() => {
    const sock = socketRef.current;
    if (sock && connId) {
      sock.emit('terminal:disconnect', { connId });
      setConnId(null);
    }
    if (xtermRef.current) {
      xtermRef.current.dispose();
      xtermRef.current = null;
    }
  }, [connId]);

  const copyBuffer = () => {
    if (xtermRef.current) {
      const sel = xtermRef.current.getSelection();
      if (sel) {
        navigator.clipboard.writeText(sel);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('Selection copied');
      }
    }
  };

  const sockAvailable = socketRef.current?.connected ?? false;

  return (
    <Card className={`border-gray-800 bg-gray-900/50 ${fullscreen ? 'fixed inset-4 z-50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-emerald-700">
              <Terminal className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-white text-base">Container Terminal</CardTitle>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                {connId ? (
                  <><Wifi className="h-3 w-3 text-green-400" /> SSH session active</>
                ) : sockAvailable ? (
                  <><Wifi className="h-3 w-3 text-green-400" /> Socket connected</>
                ) : (
                  <><WifiOff className="h-3 w-3 text-yellow-500" /> Connecting to socket...</>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {pods.length > 0 && (
              <select
                value={selectedPod}
                onChange={(e) => setSelectedPod(e.target.value)}
                className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300 font-mono max-w-[180px]"
              >
                {pods.map((name) => (
                  <option key={name} value={name}>{name.slice(0, 30)}</option>
                ))}
              </select>
            )}
            <button onClick={copyBuffer} className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-gray-800" title="Copy selection">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={connId ? disconnectTerminal : connectTerminal}
              disabled={connecting || !sockAvailable}
              className={`p-1.5 rounded ${connId ? 'text-red-400 hover:bg-red-900/20' : 'text-green-400 hover:bg-green-900/20'} transition-colors`}
              title={connId ? 'Disconnect' : 'Connect'}
            >
              {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : connId ? <Trash2 className="h-3.5 w-3.5" /> : <Terminal className="h-3.5 w-3.5" />}
            </button>
            <button onClick={() => setFullscreen(!fullscreen)} className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-gray-800" title={fullscreen ? 'Exit' : 'Fullscreen'}>
              {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {pods.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Terminal className="mb-3 h-8 w-8 text-gray-600" />
            <p className="text-gray-500 text-sm">No running pods found</p>
            <p className="text-xs text-gray-600 mt-1">Deploy your project first to access the terminal</p>
          </div>
        ) : !connId && !connecting ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Terminal className="mb-3 h-8 w-8 text-gray-500" />
            <p className="text-gray-400 text-sm">Click Connect to start an interactive SSH session</p>
            <p className="text-xs text-gray-600 mt-1">Uses xterm.js for full terminal emulation</p>
            <Button onClick={connectTerminal} disabled={!sockAvailable} className="mt-4 bg-green-700 hover:bg-green-600">
              <Terminal className="h-4 w-4 mr-2" />
              {sockAvailable ? 'Connect Terminal' : 'Waiting for socket...'}
            </Button>
          </div>
        ) : (
          <div className={`relative bg-black rounded-lg border border-gray-800 overflow-hidden ${fullscreen ? 'h-full' : ''}`}>
            <div
              ref={terminalRef}
              className={`w-full ${fullscreen ? 'h-[calc(100vh-12rem)]' : 'h-80'}`}
            />
            {connecting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <div className="flex items-center gap-2 text-green-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Connecting to container...</span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
