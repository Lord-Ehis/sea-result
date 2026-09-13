import { AppShell } from "@/components/app-shell";
import { parentNavItems } from "@/lib/nav-config";
import { auth } from "@/lib/auth";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <AppShell
      navItems={parentNavItems}
      workspaceName="Your family"
      workspaceMeta="Linked children"
      pageTitle="Parent"
      userName={session?.user.name ?? "Parent"}
      userRoleLabel="Parent"
    >
      {children}
    </AppShell>
  );
}
