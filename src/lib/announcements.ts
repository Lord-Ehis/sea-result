import { prisma } from "@/lib/prisma";

// The one "live" platform announcement, if any — read by every role's
// layout (admin, teacher, parent, owner) to feed the shared AppShell banner.
// Pure read, no auth: seeing that an announcement exists isn't sensitive,
// and every signed-in role is meant to see it.
export type ActiveAnnouncement = {
  id: string;
  message: string;
  tone: "INFO" | "WARNING";
  linkUrl: string | null;
  linkLabel: string | null;
};

export async function getActiveAnnouncement(): Promise<ActiveAnnouncement | null> {
  const announcement = await prisma.platformAnnouncement.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, message: true, tone: true, linkUrl: true, linkLabel: true },
  });
  return announcement;
}
