import { Users, FileText, Building2, Check } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

const metrics = [
  { label: "Total students", value: "—", icon: Users },
  { label: "Pending result approvals", value: "—", icon: FileText },
  { label: "Active campuses", value: "—", icon: Building2 },
  { label: "Subscription status", value: "—", icon: Check },
];

export default function AdminDashboardPage() {
  return (
    <>
      <PageHeader
        eyebrow="School overview"
        title="Dashboard"
        intro="Welcome back. Here's what needs your attention across your campuses."
      />
      <section className="mb-7 grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="School metrics">
        {metrics.map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex min-h-[136px] flex-col justify-between rounded-md border border-border bg-bg-card p-5">
            <div className="flex items-start justify-between gap-2">
              <span className="text-caption leading-snug text-text-secondary">{label}</span>
              <span className="grid h-[34px] w-[34px] place-items-center rounded-lg bg-primary-bg text-primary">
                <Icon size={17} strokeWidth={1.8} />
              </span>
            </div>
            <div className="text-title font-medium tracking-tight text-text-primary">{value}</div>
          </div>
        ))}
      </section>
    </>
  );
}
