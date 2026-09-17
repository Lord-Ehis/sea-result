type TermEntry = {
  term: string | null;
  fields: { name: string; value: string }[];
};

export function ComparisonReport({ terms }: { terms: TermEntry[] }) {
  const fieldNames = terms[0]?.fields.map((f) => f.name) ?? [];

  return (
    <>
      <div className="hidden overflow-x-auto rounded-md border border-border bg-bg-card lg:block">
        <table className="w-full min-w-[480px] border-collapse text-left">
          <thead className="bg-[#fafbfb]">
            <tr>
              <th className="border-b border-border px-4 py-3 text-[10px] font-medium uppercase tracking-wide text-text-muted">Field</th>
              {terms.map((t, i) => (
                <th key={i} className="border-b border-border px-4 py-3 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                  {t.term ?? "Term not set"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fieldNames.map((name) => (
              <tr key={name} className="border-b border-[#f0f2f3] last:border-0">
                <td className="px-4 py-2.5 text-caption text-text-muted">{name}</td>
                {terms.map((t, i) => (
                  <td key={i} className="px-4 py-2.5 text-caption font-medium text-text-primary">
                    {t.fields.find((f) => f.name === name)?.value ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:hidden">
        {fieldNames.map((name) => (
          <div key={name} className="rounded-md border border-border bg-bg-card p-4">
            <strong className="block text-body font-medium text-text-primary">{name}</strong>
            <div className="mt-3 grid gap-2 border-t border-[#f0f2f3] pt-3">
              {terms.map((t, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-caption">
                  <span className="text-text-muted">{t.term ?? "Term not set"}</span>
                  <span className="font-medium text-text-primary">{t.fields.find((f) => f.name === name)?.value ?? "—"}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
