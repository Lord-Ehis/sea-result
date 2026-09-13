import { AppShell } from "@/components/app-shell";
import { ownerNavItems } from "@/lib/nav-config";
import { auth } from "@/lib/auth";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <AppShell
      navItems={ownerNavItems}
      workspaceName="Platform"
      workspaceMeta="All schools on SEA"
      pageTitle="Platform owner"
      userName={session?.user.name ?? "Platform owner"}
      userRoleLabel="Platform owner"
    >
      {children}
    </AppShell>
  );
}
