import { Check } from "lucide-react";
import { COVERAGE_NOTE, PACKAGE_FEATURES } from "@/lib/package-features";

export type PlanSummary = {
  /** e.g. "1st Term 2026/2027" or "Full session 2026/2027" */
  title: string;
  /** e.g. "3 Oct 2026 – 31 Dec 2026" */
  covers: string;
  price: number;
  /** e.g. "₦50,000 less ₦10,000 for registering" */
  priceNote?: string;
};

const naira = (n: number) => `₦${n.toLocaleString()}`;

// What the school is buying: the plan it has chosen (what it costs and how long
// it covers) and what the package includes.
export function PackageOverview({ summary, showFeatures = true }: { summary?: PlanSummary | null; showFeatures?: boolean }) {
  return (
    <div className="grid gap-4">
      {summary && (
        <section aria-label="Your plan" className="rounded-md border border-primary bg-primary-bg px-4 py-3.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="m-0 text-body font-medium text-text-primary">{summary.title}</h2>
            <strong className="text-heading font-medium tabular-nums text-text-primary">{naira(summary.price)}</strong>
          </div>
          <p className="m-0 mt-1 text-caption text-text-secondary">Covers {summary.covers}</p>
          {summary.priceNote && <p className="m-0 mt-0.5 text-caption text-success">{summary.priceNote}</p>}
        </section>
      )}

      {showFeatures && (
        <section aria-label="What's included" className="rounded-md border border-border bg-bg-card px-4 py-4">
          <h2 className="m-0 mb-3 text-body font-medium text-text-primary">What&apos;s included</h2>
          <ul className="m-0 grid list-none gap-3 p-0">
            {PACKAGE_FEATURES.map((f) => (
              <li key={f.title} className="flex gap-2.5">
                <Check size={16} strokeWidth={2} className="mt-0.5 flex-none text-success" aria-hidden="true" />
                <span className="text-caption leading-relaxed text-text-secondary">
                  <strong className="font-medium text-text-primary">{f.title}.</strong> {f.text}
                </span>
              </li>
            ))}
          </ul>
          <p className="m-0 mt-4 border-t border-border pt-3 text-caption leading-relaxed text-text-muted">{COVERAGE_NOTE}</p>
        </section>
      )}
    </div>
  );
}
