import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { getReadiness } from "@/lib/readiness";
import { summarise, type Check, type CheckGroup } from "@/lib/readiness-rules";
import { SUPPORT_EMAIL } from "@/lib/legal";

const GROUPS: { group: CheckGroup; blurb: string }[] = [
  { group: "Payments", blurb: "Can schools pay, and does the site know when they have?" },
  { group: "Email", blurb: "Password resets and result alerts reach real inboxes." },
  { group: "SMS", blurb: "Guardians get a text when results are published." },
  { group: "Platform", blurb: "The pieces that keep the service running." },
  { group: "Legal", blurb: "What schools and parents agree to." },
];

const PILL = {
  ready: { label: "Ready", tone: "success" },
  attention: { label: "Needs attention", tone: "warning" },
  unknown: { label: "Can't check", tone: "neutral" },
} as const;

// Things only a person can confirm (or that we can't see from here).
const CONFIRM_YOURSELF: { title: string; text: string; href?: string }[] = [
  { title: "Vercel plan", text: "Vercel's free Hobby plan is for non-commercial projects. A paid product should be on the Pro plan.", href: "https://vercel.com/pricing" },
  { title: "Supabase plan and backups", text: "The free plan pauses after a week of inactivity and has no daily backups. Use a paid plan before real school data goes in.", href: "https://supabase.com/pricing" },
  { title: "Paystack business activation", text: "Live payments need Paystack to activate your business (business documents and a settlement bank account).", href: "https://dashboard.paystack.com" },
  { title: "Lawyer review", text: "Have a Nigerian lawyer read the Terms of Use and Privacy Policy before launch." },
  { title: "Support inbox", text: `Make sure mail sent to ${SUPPORT_EMAIL} actually arrives, since the policies tell people to write there.` },
];

export const dynamic = "force-dynamic";

export default async function ReadinessPage() {
  const session = await auth();
  if (session?.user.role !== "PLATFORM_OWNER") redirect("/login");

  const { checks, schools, webhookUrl } = await getReadiness();
  const totals = summarise(checks);

  return (
    <>
      <PageHeader
        eyebrow="Platform overview"
        title="Go-live readiness"
        intro="What's ready for real schools and what still needs doing. Each item says what we found and what to do. Reload the page to check again."
      />

      <p className="mb-6 rounded-md border border-border bg-bg-card px-4 py-3 text-body text-text-secondary" role="status">
        <strong className="font-medium text-text-primary">
          {totals.ready} of {totals.total} ready
        </strong>
        {totals.attention > 0 && <> · {totals.attention} need{totals.attention === 1 ? "s" : ""} attention</>}
        {totals.unknown > 0 && <> · {totals.unknown} can&apos;t be checked automatically</>}
      </p>

      <div className="grid gap-6">
        {GROUPS.map(({ group, blurb }) => {
          const items = checks.filter((c) => c.group === group);
          if (items.length === 0) return null;
          return (
            <section key={group} aria-label={group} className="overflow-hidden rounded-md border border-border bg-bg-card">
              <div className="border-b border-border px-5 py-4">
                <h2 className="m-0 text-heading font-medium text-text-primary">{group}</h2>
                <p className="mt-1 text-caption text-text-muted">{blurb}</p>
              </div>
              <ul className="m-0 list-none p-0">
                {items.map((c) => (
                  <CheckRow key={c.id} check={c} />
                ))}
              </ul>
            </section>
          );
        })}

        <section aria-label="Schools" className="overflow-hidden rounded-md border border-border bg-bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="m-0 text-heading font-medium text-text-primary">Schools in the database</h2>
            <p className="mt-1 text-caption text-text-muted">Make sure each one is a real school, not a test.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="bg-[#fafbfb]">
                <tr>
                  {["School", "Status", "Students", "Published results", "Created"].map((h) => (
                    <th key={h} className="border-b border-border px-4 py-3 text-[10px] font-medium uppercase tracking-wide text-text-muted first:pl-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schools.map((s) => (
                  <tr key={s.id} className="border-b border-[#f0f2f3] last:border-0">
                    <td className="px-4 py-3 pl-5 text-body text-text-primary">{s.name}</td>
                    <td className="px-4 py-3 text-caption text-text-secondary">{s.status.replace("_", " ").toLowerCase()}</td>
                    <td className="px-4 py-3 text-body tabular-nums text-text-secondary">{s.students}</td>
                    <td className="px-4 py-3 text-body tabular-nums text-text-secondary">{s.published}</td>
                    <td className="px-4 py-3 text-caption text-text-secondary">{s.createdAt.toLocaleDateString("en-GB", { timeZone: "UTC" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-label="Confirm yourself" className="overflow-hidden rounded-md border border-border bg-bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="m-0 text-heading font-medium text-text-primary">Confirm these yourself</h2>
            <p className="mt-1 text-caption text-text-muted">We can&apos;t see these from here.</p>
          </div>
          <ul className="m-0 list-none p-0">
            {CONFIRM_YOURSELF.map((c) => (
              <li key={c.title} className="border-b border-[#f0f2f3] px-5 py-3.5 last:border-0">
                <div className="text-body font-medium text-text-primary">{c.title}</div>
                <p className="m-0 mt-0.5 text-caption leading-relaxed text-text-secondary">
                  {c.text}
                  {c.href && (
                    <>
                      {" "}
                      <a href={c.href} target="_blank" rel="noreferrer" className="text-primary hover:text-primary-hover">
                        Open
                      </a>
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <p className="m-0 text-caption leading-relaxed text-text-muted">
          Paystack webhook address: <code className="rounded bg-bg-page px-1.5 py-0.5 text-text-secondary">{webhookUrl}</code> · The step-by-step guide is in <code className="rounded bg-bg-page px-1.5 py-0.5 text-text-secondary">docs/GO-LIVE.md</code>.
        </p>
      </div>
    </>
  );
}

function CheckRow({ check }: { check: Check }) {
  const pill = PILL[check.status];
  return (
    <li className="grid gap-1.5 border-b border-[#f0f2f3] px-5 py-4 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-body font-medium text-text-primary">{check.title}</span>
        <StatusPill label={pill.label} tone={pill.tone} />
      </div>
      <p className="m-0 text-caption leading-relaxed text-text-secondary">{check.detail}</p>
      {check.status !== "ready" && check.fix && <p className="m-0 text-caption leading-relaxed text-text-muted">What to do: {check.fix}</p>}
    </li>
  );
}
