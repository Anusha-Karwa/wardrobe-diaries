import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp is a native module: keep it out of the server bundle.
  serverExternalPackages: ["sharp"],
  // Board renderer fonts (Vercel has no system fonts).
  outputFileTracingIncludes: { "/**": ["./assets/fonts/**"] },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
