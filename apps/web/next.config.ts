import type { NextConfig } from 'next';

/**
 * Standalone output is enabled only for Linux/Docker production builds.
 * Windows dev machines often lack symlink permissions required by standalone tracing.
 */
const nextConfig: NextConfig = {
  ...(process.env.STANDALONE_BUILD === 'true' ? { output: 'standalone' as const } : {}),
  transpilePackages: ['@repo/ui', '@repo/utils', '@repo/database', '@repo/config'],
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  poweredByHeader: false,
};

export default nextConfig;
