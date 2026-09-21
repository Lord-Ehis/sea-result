import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { CampusAccess } from "@/lib/campus-scope";

// Who this School Admin is and which campuses they may touch. Read from the
// database on every request (not the sign-in token), so changing or removing
// someone's access takes effect immediately, and a deactivated account stops
// working straight away. `cache()` makes it one query per request however many
// helpers ask.

export type AdminAccess = CampusAccess & {
  schoolId: string;
  userId: string;
  // null = unrestricted; otherwise only these campuses (empty = none).
};

export const getAdminAccess = cache(async (): Promise<AdminAccess> => {
  const session = await auth();
  if (!session?.user.schoolId || session.user.role !== "SCHOOL_ADMIN") {
    throw new Error("Not authorized.");
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true, schoolId: true, campusScoped: true, campusAccess: { select: { campusId: true } } },
  });
  if (!user?.isActive || user.schoolId !== session.user.schoolId) throw new Error("Not authorized.");
  return {
    schoolId: session.user.schoolId,
    userId: session.user.id,
    campusIds: user.campusScoped ? user.campusAccess.map((a) => a.campusId) : null,
  };
});

/** School-wide features (templates, settings, billing, domain, team) — refused to a campus admin. */
export async function requireFullAdmin(): Promise<AdminAccess> {
  const access = await getAdminAccess();
  if (access.campusIds !== null) throw new Error("Not authorized.");
  return access;
}

/** The same guard for a page: a campus admin who types the URL is sent to the dashboard. */
export async function requireFullAdminPage(): Promise<AdminAccess> {
  const access = await getAdminAccess();
  if (access.campusIds !== null) redirect("/admin/dashboard");
  return access;
}
