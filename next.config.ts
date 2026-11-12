import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Resolve the bundled ffmpeg/ffprobe binaries from node_modules at runtime.
  serverExternalPackages: ["ffmpeg-static", "ffprobe-static"],
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
