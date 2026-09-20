import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // A whole class's scores go up in one save: 100 students × 20 subjects × 6
    // components is ~1.5 MB with the long cell keys, over the 1 MB default.
    // Kept under Vercel's 4.5 MB request cap.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
