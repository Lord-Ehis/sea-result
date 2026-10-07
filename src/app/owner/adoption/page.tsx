import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/StatusPill";
import { auth } from "@/lib/auth";
import { HEALTHS, HEALTH_LABEL, HEALTH_TONE, ACTIVE_DAYS, QUIET_DAYS, NEW_DAYS, PUBLISHED_WINDOW_DAYS, isHealth, sortForAttention, type Health } from "@/lib/owner-adoption";
import { loadAdoption } from "@/lib/owner-adoption-load";
import { relativeDays } from "@/lib/owner-attention";

const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const MEANING: Record<Health, string> = {
  ACTIVE: `Results worked on in the last ${ACTIVE_DAYS} days`,
  QUIET: `Nothing for ${ACTIVE_DAYS + 1}–${QUIET_DAYS} days`,
  DORMANT: `Nothing for over ${QUIET_DAYS} days, or never any results`,
  SETTING_UP: "No students, teachers or result template yet",
  NEW: `Signed up in the last ${NEW_DAYS} days`,
  NOT_RATED: "Switched off or awaiting deletion",
};

export default async function OwnerAdoptionPage({ searchParams }: { searchParams: Promise<{ health?: string }> }) {
  // Usage figures for every school: check the role here as well as in the proxy.
  const session = await auth();
  if (session?.user.role !== "PLATFORM_OWNER") redirect("/login");

  const sp = await searchParams;
  const filter = isHealth(sp.health) ? sp.health : undefined;
  const now = new Date();

  const all = sortForAttention(await loadAdoption({ now }));
  const counts = new Map<Health, number>(HEALTHS.map((h) => [h, all.filter((s) => s.health === h).length]));
  const rows = filter ? all.filter((s) => s.health === filter) : all;

  return (
    <>
      <PageHeader
        eyebrow="Platform overview"
        title="Adoption"
        intro="How each school is really using the platform, with the ones that need a nudge first. A school counts as active when its results were entered, changed, approved or published recently."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Summary">
        {HEALTHS.map((h) => {
          const selected = filter === h;
          return (
            <Link
              key={h}
              href={selected ? "/owner/adoption" : `/owner/adoption?health=${h}`}
              className={`flex min-h-[104px] flex-col justify-between rounded-md border p-4 ${selected ? "border-primary bg-primary-bg" : "border-border bg-bg-card hover:border-primary/40"}`}
            >
              <StatusPill label={HEALTH_LABEL[h]} tone={HEALTH_TONE[h]} />
              <div>
                <div className="text-title font-medium tracking-tight text-text-primary">{counts.get(h)}</div>
                <div className="mt-1 text-[10px] leading-snug text-text-muted">{MEANING[h]}</div>
              </div>
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No schools here" description={filter ? "No school has this rating right now." : "Schools will appear here as they register."} />
      ) : (
        <section className="overflow-hidden rounded-md border border-border bg-bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4 text-caption text-text-muted">
            <span>
              {rows.length} {rows.length === 1 ? "school" : "schools"}
              {filter ? ` rated ${HEALTH_LABEL[filter].toLowerCase()}` : ""}
            </span>
            {filter && (
              <Link href="/owner/adoption" className="text-primary hover:underline">
                Show all
              </Link>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead className="bg-[#fafbfb]">
                <tr>
                  {["School", "Rating", "Students", "Teachers", "Parents linked", `Published (${PUBLISHED_WINDOW_DAYS}d)`, "Last activity", "Subscription"].map((h) => (
                    <th key={h} className="border-b border-border px-4 py-3 text-[10px] font-medium uppercase tracking-wide text-text-muted first:pl-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.schoolId} className="border-b border-[#f0f2f3] align-top last:border-0">
                    <td className="px-4 py-3 pl-5">
                      <Link href={`/owner/schools/${s.schoolId}`} className="text-body font-medium text-primary hover:underline">
                        {s.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill label={HEALTH_LABEL[s.health]} tone={HEALTH_TONE[s.health]} />
                      <div className="mt-1 max-w-[220px] text-[10px] leading-snug text-text-muted">{s.reason}</div>
                    </td>
                    <td className="px-4 py-3 text-body tabular-nums text-text-secondary">{s.students.toLocaleString()}</td>
                    <td className="px-4 py-3 text-body tabular-nums text-text-secondary">{s.teachers.toLocaleString()}</td>
                    <td className="px-4 py-3 text-body tabular-nums text-text-secondary">
                      {s.parentCoveragePct === null ? "—" : `${s.parentCoveragePct}%`}
                      <div className="text-[10px] text-text-muted">
                        {s.studentsWithParent} of {s.students} students · {s.parentAccounts} {s.parentAccounts === 1 ? "account" : "accounts"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-body tabular-nums text-text-secondary">{s.publishedRecently.toLocaleString()}</td>
                    <td className="px-4 py-3 text-caption text-text-secondary">{s.lastActivityAt ? fmtDate(s.lastActivityAt) : "Never"}</td>
                    <td className="px-4 py-3 text-caption text-text-secondary">
                      {s.coverageEndsAt ? (
                        <>
                          {s.daysLeft !== null && s.daysLeft >= 0 ? "Ends" : "Ended"} {relativeDays(s.daysLeft)}
                        </>
                      ) : (
                        <span className="text-text-muted">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
