import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const roleForPrefix: Record<string, Role> = {
  "/owner": "PLATFORM_OWNER",
  "/admin": "SCHOOL_ADMIN",
  "/teacher": "TEACHER",
  "/parent": "PARENT",
};

// Platform domains never resolve to a tenant's custom domain — skips the
// DB lookup for the common case of visiting the app on its own domain.
function isPlatformHost(host: string) {
  return host.endsWith(".vercel.app") || host.includes("localhost") || host.endsWith(".sophie-ea.app");
}

export default auth(async (req) => {
  const { pathname } = req.nextUrl;
  const host = req.headers.get("host");

  if (host && !isPlatformHost(host) && pathname === "/") {
    const school = await prisma.school.findFirst({
      where: { customDomain: host, customDomainVerified: true, status: "ACTIVE" },
      select: { slug: true },
    });
    if (school) {
      return NextResponse.rewrite(new URL(`/lookup/${school.slug}`, req.nextUrl.origin));
    }
  }

  const prefix = Object.keys(roleForPrefix).find((p) => pathname.startsWith(p));
  if (!prefix) return NextResponse.next();

  const session = req.auth;
  if (!session?.user) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (session.user.role !== roleForPrefix[prefix]) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/", "/owner/:path*", "/admin/:path*", "/teacher/:path*", "/parent/:path*"],
};
