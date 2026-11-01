import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.REALTY_TEST_DIST || ".next",
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
