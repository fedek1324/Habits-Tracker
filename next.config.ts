import type { NextConfig } from "next";
import { execSync } from "child_process";

const commitHash = (() => {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "unknown";
  }
})();

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_COMMIT_HASH: commitHash,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
