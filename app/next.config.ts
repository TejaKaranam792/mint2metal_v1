import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empty turbopack config signals intentional use of Turbopack (Next.js 16 default)
  // and suppresses the "webpack config but no turbopack config" fatal error
  turbopack: {},
  // Prevent Next.js from tracing/bundling files from the nested landing sub-project
  outputFileTracingExcludes: {
    "*": ["./app/_landing/**/*"],
  },
};

export default nextConfig;

