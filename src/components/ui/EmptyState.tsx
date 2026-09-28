import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
};

// The shared "nothing here yet" panel — used across every role wherever a
// list, queue or table has no rows (17 call sites). A soft dot-grid texture
// (faded toward the edges via a mask) and a layered icon badge give it some
// depth without pulling focus from the title/description, which stay the
// actual content.
export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="relative overflow-hidden rounded-md border border-dashed border-border bg-bg-card px-6 py-16 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: "radial-gradient(var(--color-border) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
          maskImage: "radial-gradient(ellipse 65% 55% at 50% 38%, black 0%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 65% 55% at 50% 38%, black 0%, transparent 75%)",
        }}
      />
      <div className="relative flex flex-col items-center gap-3">
        <span className="relative grid h-16 w-16 flex-none place-items-center">
          <span className="absolute inset-0 rounded-full bg-primary-bg" />
          <span className="absolute inset-[6px] rounded-full border border-primary/25" />
          <span className="relative grid h-11 w-11 place-items-center rounded-full bg-primary text-white shadow-[0_6px_16px_-6px_rgba(24,95,165,0.6)]">
            <Icon size={19} strokeWidth={1.8} />
          </span>
        </span>
        <p className="m-0 text-heading font-medium text-text-primary">{title}</p>
        <p className="m-0 max-w-sm text-body text-text-muted">{description}</p>
      </div>
    </div>
  );
}
