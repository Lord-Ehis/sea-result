import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-bg-card px-6 py-16 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-md bg-primary-bg text-primary">
        <Icon size={20} strokeWidth={1.8} />
      </span>
      <p className="m-0 text-heading font-medium text-text-primary">{title}</p>
      <p className="m-0 max-w-sm text-body text-text-muted">{description}</p>
    </div>
  );
}
