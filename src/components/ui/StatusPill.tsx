type StatusPillProps = {
  label: string;
  tone: "success" | "warning" | "danger" | "neutral";
};

const toneClasses: Record<StatusPillProps["tone"], string> = {
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  neutral: "bg-bg-sidebar text-text-secondary",
};

export function StatusPill({ label, tone }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-caption font-medium before:h-1.5 before:w-1.5 before:rounded-full before:bg-current ${toneClasses[tone]}`}
    >
      {label}
    </span>
  );
}
