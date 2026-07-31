import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /**
       * Server Actions default to a 1MB request body, which silently fails a
       * cover-image upload as a browser-side "Failed to fetch". Cover uploads
       * are capped at 25MB in the action itself; 32mb leaves headroom for the
       * multipart boundary/header overhead on top of the file bytes.
       */
      bodySizeLimit: "32mb",
    },
  },
};

export default nextConfig;
