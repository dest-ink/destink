import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['substack-sdk'],
  turbopack: {},
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ignored: /node_modules|\.git|\.next|\.planning|\.claude/,
      };
    }
    return config;
  },
};

export default nextConfig;
