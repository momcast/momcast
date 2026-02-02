import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  outputFileTracingExcludes: {
    '/api/**/*': [
      'public/templates/images/**/*',
    ],
  },
  async headers() {
    return [];
  },
};

export default nextConfig;
