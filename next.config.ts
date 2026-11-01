import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.REALTY_TEST_DIST || ".next",
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  turbopack: {
    rules: {
      // Only the global Tailwind entry needs this loader. CSS Modules must
      // keep Next.js native module processing and scoped class exports.
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
