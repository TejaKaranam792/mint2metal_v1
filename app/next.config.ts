import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Set turbopack root to current directory to avoid multi-lockfile workspace confusion
  turbopack: {
    root: __dirname,
  },
  // Prevent Next.js from tracing/bundling files from the nested landing sub-project
  outputFileTracingExcludes: {
    "*": ["./app/_landing/**/*"],
  },
};

export default nextConfig;

