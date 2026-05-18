import { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer | null = null;

export function setIO(instance: SocketIOServer) {
  io = instance;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export function emitK8sEvent(event: string, data: any, namespace?: string) {
  if (!io) return;
  if (namespace) {
    io.to(`k8s-${namespace}`).emit(event, data);
  }
  io.emit(event, data);
}

export function emitBuildLog(projectId: string, event: string, data: any) {
  if (!io) return;
  io.to(`build-${projectId}`).emit(event, data);
}
