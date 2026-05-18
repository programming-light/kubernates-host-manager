'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';

interface K8sEvent {
  event: string;
  data: any;
}

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  subscribe: (event: string, callback: (data: any) => void) => void;
  unsubscribe: (event: string, callback: (data: any) => void) => void;
  joinK8sUpdates: (namespace?: string) => void;
  leaveK8sUpdates: (namespace?: string) => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const callbacksRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());

  const subscribe = useCallback((event: string, callback: (data: any) => void) => {
    if (!callbacksRef.current.has(event)) {
      callbacksRef.current.set(event, new Set());
    }
    callbacksRef.current.get(event)!.add(callback);

    if (!socketRef.current?.hasListeners(event)) {
      socketRef.current?.on(event, (data: any) => {
        callbacksRef.current.get(event)?.forEach(cb => cb(data));
      });
    }
  }, []);

  const unsubscribe = useCallback((event: string, callback: (data: any) => void) => {
    callbacksRef.current.get(event)?.delete(callback);
  }, []);

  const joinK8sUpdates = useCallback((namespace?: string) => {
    socketRef.current?.emit('join-k8s-updates', namespace);
  }, []);

  const leaveK8sUpdates = useCallback((namespace?: string) => {
    socketRef.current?.emit('leave-k8s-updates', namespace);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const socketInstance = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      withCredentials: true,
    });

    socketInstance.on('connect', () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Socket connected:', socketInstance.id);
      }
      setConnected(true);
    });

    socketInstance.on('disconnect', () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Socket disconnected');
      }
      setConnected(false);
    });

    socketInstance.on('connect_error', (error) => {
      if (process.env.NODE_ENV === 'development') {
        console.error('Socket connection error:', error);
      }
    });

    socketRef.current = socketInstance;

    return () => {
      socketInstance.disconnect();
      callbacksRef.current.clear();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected, subscribe, unsubscribe, joinK8sUpdates, leaveK8sUpdates }}>
      {children}
    </SocketContext.Provider>
  );
}
