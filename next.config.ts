import type { NextConfig } from "next";

// Pages that must never show up in a search engine: the signed-in areas, result
// pages (they carry children's names), the lookup and verification pages, and
// account-recovery screens.
const NO_INDEX_PATHS = ["/admin", "/teacher", "/parent", "/owner", "/result", "/verify", "/lookup", "/reset-password", "/forgot-password", "/login", "/school-suspended", "/subscription-ended", "/api"];

const nextConfig: NextConfig = {
  experimental: {
    // A whole class's scores go up in one save: 100 students × 20 subjects × 6
    // components is ~1.5 MB with the long cell keys, over the 1 MB default.
    // Kept under Vercel's 4.5 MB request cap.
    serverActions: { bodySizeLimit: "4mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Nothing in SEA is meant to be shown inside another site's frame.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
        ],
      },
      ...NO_INDEX_PATHS.map((path) => ({
        source: `${path}/:path*`,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
    ];
  },
};

export default nextConfig;
