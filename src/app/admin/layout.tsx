import { AppShell } from "@/components/app-shell";
import { campusAdminNavItems, schoolAdminNavItems } from "@/lib/nav-config";
import { auth } from "@/lib/auth";
import { getAdminAccess } from "@/lib/admin-access";
import { campusWhere } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const access = session?.user.schoolId ? await getAdminAccess().catch(() => null) : null;
  const scoped = !!access && access.campusIds !== null;

  const school = session?.user.schoolId
    ? await prisma.school.findUnique({
        where: { id: session.user.schoolId },
        include: { campuses: { where: access ? campusWhere(access) : {} } },
      })
    : null;
  const campusCount = school?.campuses.length ?? 0;

  return (
    <AppShell
      // Campus admins never see the school-wide items, and the pages behind
      // them turn them away too (see requireFullAdmin*).
      navItems={scoped ? campusAdminNavItems : schoolAdminNavItems}
      workspaceName={school?.name ?? "School workspace"}
      workspaceMeta={scoped ? `${campusCount} ${campusCount === 1 ? "campus" : "campuses"} assigned to you` : `${campusCount} active campuses`}
      pageTitle={scoped ? "Campus admin" : "School admin"}
      schoolName={school?.name}
      userName={session?.user.name ?? "School admin"}
      userRoleLabel={scoped ? "Campus admin" : "School admin"}
    >
      {children}
    </AppShell>
  );
}
