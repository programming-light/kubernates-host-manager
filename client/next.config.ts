import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
  // Fix Turbopack workspace detection
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;