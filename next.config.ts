import type { NextConfig } from "next";
import { randomUUID } from "node:crypto";

const nextConfig: NextConfig = {
  agentRules: false,
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/**": ["./config/admin-whitelist.txt"],
  },
  env: {
    NEXT_PUBLIC_DASHBOARD_VERSION: process.env.VERCEL_DEPLOYMENT_ID
      || process.env.DASHBOARD_BUILD_VERSION
      || (process.env.NODE_ENV === "development" ? "development" : randomUUID()),
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
