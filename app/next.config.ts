import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Do NOT add output: "export" -- breaks SSR/ISR, which the session-gated
  // pages (app/proxy.ts) need. See app/CLAUDE.md's "Amplify deploy lessons".
};

export default nextConfig;
