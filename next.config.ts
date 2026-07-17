import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project so a stray lockfile in a parent
  // folder cannot confuse the build.
  turbopack: {
    root: __dirname,
  },
  // Hide the floating dev-tools indicator (keeps dev-mode screenshots clean;
  // no effect on production builds).
  devIndicators: false,
};

export default nextConfig;
