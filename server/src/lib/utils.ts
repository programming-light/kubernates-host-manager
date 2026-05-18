import { exec } from 'child_process';
import { promisify } from 'util';

export const execAsync = promisify(exec);

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .substring(0, 63);
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export function sanitizeDomain(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '')
    .substring(0, 253);
}
