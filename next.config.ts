import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /**
       * Server Actions default to a 1MB request body, which silently fails
       * uploads as a browser-side "Failed to fetch" / reload-retry overlay.
       * Cover uploads are capped at 25MB in the action; podcast audio episodes
       * are much larger (30-60MB+), so allow 200mb here to leave headroom for
       * a full episode plus multipart boundary/header overhead.
       */
      bodySizeLimit: "200mb",
    },
  },
};

export default nextConfig;
