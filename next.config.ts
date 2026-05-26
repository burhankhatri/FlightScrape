import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Google Flights HTML fetch + Wikipedia API calls run in our /api routes.
  // Allow external image hosts that Wikipedia returns for hero images.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "commons.wikimedia.org" },
    ],
  },
  // Ignore python-archive when bundling.
  experimental: {},
};

export default nextConfig;
