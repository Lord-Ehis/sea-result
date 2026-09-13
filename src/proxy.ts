import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Role } from "@prisma/client";

const roleForPrefix: Record<string, Role> = {
  "/owner": "PLATFORM_OWNER",
  "/admin": "SCHOOL_ADMIN",
  "/teacher": "TEACHER",
  "/parent": "PARENT",
};

export default auth((req) => {
  const { pathname } = req.nextUrl;
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
  matcher: ["/owner/:path*", "/admin/:path*", "/teacher/:path*", "/parent/:path*"],
};
