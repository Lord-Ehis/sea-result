import type { MetadataRoute } from "next";

// Search engines may read the public marketing, sign-up and legal pages. The
// signed-in areas, result and verification pages (children's names) and the
// API stay out. (These paths also send a noindex header - see next.config.ts.)
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/signup", "/terms", "/privacy"],
        disallow: ["/admin", "/teacher", "/parent", "/owner", "/result", "/verify", "/lookup", "/reset-password", "/forgot-password", "/login", "/api"],
      },
    ],
  };
}
