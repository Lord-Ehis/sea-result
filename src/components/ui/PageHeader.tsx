type PageHeaderProps = {
  eyebrow: string;
  title: string;
  intro?: string;
};

export function PageHeader({ eyebrow, title, intro }: PageHeaderProps) {
  return (
    <div className="mb-8">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.1em] text-primary">{eyebrow}</div>
      <h1 className="m-0 text-title font-medium tracking-tight text-text-primary">{title}</h1>
      {intro && <p className="mt-2 text-body text-text-muted">{intro}</p>}
    </div>
  );
}
