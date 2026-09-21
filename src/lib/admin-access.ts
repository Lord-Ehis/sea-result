import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { CampusAccess } from "@/lib/campus-scope";
import { getSchoolAccess } from "@/lib/school-access-lookup";

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

// `allowLapsed` is for the Billing screens only: a school whose subscription has
// lapsed can still renew, but nothing else. A suspended school can do nothing.
export const getAdminAccess = cache(async (allowLapsed: boolean = false): Promise<AdminAccess> => {
  const session = await auth();
  if (!session?.user.schoolId || session.user.role !== "SCHOOL_ADMIN") {
    throw new Error("Not authorized.");
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true, schoolId: true, campusScoped: true, campusAccess: { select: { campusId: true } } },
  });
  if (!user?.isActive || user.schoolId !== session.user.schoolId) throw new Error("Not authorized.");

  // Second layer behind the proxy, so an action reached some other way still refuses.
  const school = await getSchoolAccess(session.user.schoolId);
  if (school.state === "SUSPENDED") throw new Error("This school's access is suspended.");
  if (school.state === "LAPSED" && !allowLapsed) throw new Error("This school's subscription has ended. Renew it on the Billing page.");

  return {
    schoolId: session.user.schoolId,
    userId: session.user.id,
    campusIds: user.campusScoped ? user.campusAccess.map((a) => a.campusId) : null,
  };
});

/** School-wide features (templates, settings, billing, domain, team) — refused to a campus admin. */
export async function requireFullAdmin(allowLapsed: boolean = false): Promise<AdminAccess> {
  const access = await getAdminAccess(allowLapsed);
  if (access.campusIds !== null) throw new Error("Not authorized.");
  return access;
}

/** The same guard for a page: a campus admin who types the URL is sent to the dashboard. */
export async function requireFullAdminPage(allowLapsed: boolean = false): Promise<AdminAccess> {
  const access = await getAdminAccess(allowLapsed);
  if (access.campusIds !== null) redirect("/admin/dashboard");
  return access;
}
