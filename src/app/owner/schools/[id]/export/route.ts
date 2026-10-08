import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hit } from "@/lib/rate-limit";
import { recordPlatformEvent } from "@/lib/platform-events";
import { loadSchoolExportData } from "@/lib/school-data";
import { buildSchoolExport, slug, zipFiles } from "@/lib/school-export";

// A ZIP of one school's data (students, results, payments…). It holds children's
// names and parents' contact details, so: platform owner only (a route is
// reachable by URL, so it checks the role itself), rate-limited, and every
// download is written to the owner's audit log.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user.role !== "PLATFORM_OWNER") return new Response("Not authorized.", { status: 401 });

  const limit = await hit(`school-export:${session.user.id}`, 10, 3600);
  if (!limit.allowed) return new Response("Too many downloads. Try again later.", { status: 429 });

  const { id } = await params;
  const data = await loadSchoolExportData(id);
  if (!data) return new Response("School not found.", { status: 404 });

  const now = new Date();
  const { files, counts } = buildSchoolExport(data, now);
  const zip = zipFiles(files);

  await recordPlatformEvent(prisma, { action: "SCHOOL_DATA_EXPORTED", actorUserId: session.user.id, schoolId: id, metadata: { counts } });

  return new Response(Buffer.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug(data.school.name)}-data-${now.toISOString().slice(0, 10)}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
