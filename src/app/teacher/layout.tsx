import { AppShell } from "@/components/app-shell";
import { teacherNavItems } from "@/lib/nav-config";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const school = session?.user.schoolId
    ? await prisma.school.findUnique({ where: { id: session.user.schoolId } })
    : null;

  return (
    <AppShell
      navItems={teacherNavItems}
      workspaceName={school?.name ?? "School workspace"}
      workspaceMeta="Assigned classes only"
      pageTitle="Teacher"
      schoolName={school?.name}
      userName={session?.user.name ?? "Teacher"}
      userRoleLabel="Teacher"
    >
      {children}
    </AppShell>
  );
}
