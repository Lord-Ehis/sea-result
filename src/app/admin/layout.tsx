import { AppShell } from "@/components/app-shell";
import { schoolAdminNavItems } from "@/lib/nav-config";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const school = session?.user.schoolId
    ? await prisma.school.findUnique({
        where: { id: session.user.schoolId },
        include: { campuses: true },
      })
    : null;

  return (
    <AppShell
      navItems={schoolAdminNavItems}
      workspaceName={school?.name ?? "School workspace"}
      workspaceMeta={`${school?.campuses.length ?? 0} active campuses`}
      pageTitle="School admin"
      schoolName={school?.name}
      userName={session?.user.name ?? "School admin"}
      userRoleLabel="School admin"
    >
      {children}
    </AppShell>
  );
}
