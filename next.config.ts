import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The disposable-domain list is a large JSON file. Leave it on disk and
  // require() it from the register action instead of bundling it into the
  // server graph.
  serverExternalPackages: ["disposable-email-domains"],
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
