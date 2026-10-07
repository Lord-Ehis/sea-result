import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SecurityClient } from "./SecurityClient";

export default async function OwnerSecurityPage() {
  // Account security for the owner themselves: check the role here as well as in the proxy.
  const session = await auth();
  if (session?.user.role !== "PLATFORM_OWNER") redirect("/login");

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true, totpEnabledAt: true, totpRecoveryHashes: true } });

  return (
    <>
      <PageHeader
        eyebrow="Platform overview"
        title="Security"
        intro="This account can see every school and every parent's contact details, so a stolen password shouldn't be enough to get in. Two-step sign-in asks for a code from your phone as well."
      />
      <SecurityClient enabledAt={me?.totpEnabledAt?.toISOString() ?? null} recoveryLeft={me?.totpRecoveryHashes.length ?? 0} email={me?.email ?? ""} />
    </>
  );
}
