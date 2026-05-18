/** @type {import('next').NextConfig} */
const nextConfig = {
  // ISR - Incremental Static Regeneration
  // Pages are statically generated at build time
  // Revalidated periodically based on the revalidate value in each page
  // This means pages are cached and don't hit the server on every request
  
  env: {
    NEXT_PUBLIC_CLIENT_URL: process.env.NEXT_PUBLIC_CLIENT_URL || 'http://localhost:3002',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
  
  images: {
    domains: (process.env.NEXT_PUBLIC_IMAGE_DOMAINS || 'localhost,127.0.0.1').split(','),
  },
  
  // Optional: Set base path if serving from subdirectory
  // basePath: '/public',
}

module.exports = nextConfig
