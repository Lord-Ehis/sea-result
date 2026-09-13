"use client";

import { useMemo, useState, useTransition } from "react";
import { FileText, GripVertical, ChevronUp, ChevronDown, X, Plus, Check } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { createTemplate, saveTemplate, type TemplateField } from "./actions";

type ClassOption = { id: string; name: string };
type Template = {
  id: string;
  name: string;
  classId: string | null;
  className: string | null;
  term: string | null;
  fields: TemplateField[];
};

const FIELD_TYPES: TemplateField["type"][] = ["Number", "Text", "Dropdown", "Rating scale"];

function previewValue(field: TemplateField) {
  const n = field.name.toLowerCase();
  if (field.type === "Number") {
    if (n.includes("subject")) {
      return (
        <table className="w-full text-[8px]">
          <tbody>
            {[
              ["English language", 84],
              ["Mathematics", 91],
              ["Basic science", 78],
            ].map(([subject, score]) => (
              <tr key={subject} className="border-t border-[#e9edef]">
                <td className="py-1.5 text-left text-[#637781]">{subject}</td>
                <td className="py-1.5 text-right font-medium text-[#354b58]">{score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    return (
      <span className="text-[9px] font-medium text-[#384c58]">
        {n.includes("attendance") ? "94 / 100 days" : n.includes("position") ? "3rd of 36" : "85"}
      </span>
    );
  }
  if (field.type === "Dropdown") {
    return <span className="text-[9px] font-medium text-[#384c58]">{n.includes("grade") ? "Excellent" : "Achieved"}</span>;
  }
  if (field.type === "Rating scale") {
    return (
      <span className="flex gap-1">
        {[1, 1, 1, 1, 0].map((on, i) => (
          <i key={i} className={`h-[5px] w-3 rounded-sm ${on ? "bg-primary" : "bg-[#dae9f3]"}`} />
        ))}
      </span>
    );
  }
  return (
    <span className="text-[9px] font-medium text-[#384c58]">
      {n.includes("comment") ? "Shows consistent progress and strong participation." : "Sample response"}
    </span>
  );
}

export function TemplateBuilderClient({
  initialTemplates,
  classes,
}: {
  initialTemplates: Template[];
  classes: ClassOption[];
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [selectedId, setSelectedId] = useState<string | null>(initialTemplates[0]?.id ?? null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = useMemo(() => templates.find((t) => t.id === selectedId) ?? null, [templates, selectedId]);

  function updateSelected(patch: Partial<Template>) {
    if (!selected) return;
    setTemplates((prev) => prev.map((t) => (t.id === selected.id ? { ...t, ...patch } : t)));
  }

  function updateFields(fields: TemplateField[]) {
    updateSelected({ fields });
  }

  function handleNewTemplate() {
    startTransition(async () => {
      const id = await createTemplate("Untitled template");
      const created: Template = { id, name: "Untitled template", classId: null, className: null, term: null, fields: [] };
      setTemplates((prev) => [...prev, created]);
      setSelectedId(id);
    });
  }

  function handleSave() {
    if (!selected) return;
    setError(null);
    setSavedMessage(null);
    startTransition(async () => {
      try {
        await saveTemplate({
          id: selected.id,
          name: selected.name,
          classId: selected.classId ?? undefined,
          term: selected.term ?? undefined,
          fields: selected.fields,
        });
        setSavedMessage("Template saved.");
        setTimeout(() => setSavedMessage(null), 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save template.");
      }
    });
  }

  function addField() {
    if (!selected) return;
    const field: TemplateField = { id: crypto.randomUUID(), name: "New field", type: "Text" };
    updateFields([...selected.fields, field]);
  }

  function removeField(id: string) {
    if (!selected) return;
    updateFields(selected.fields.filter((f) => f.id !== id));
  }

  function moveField(id: string, direction: -1 | 1) {
    if (!selected) return;
    const fields = [...selected.fields];
    const i = fields.findIndex((f) => f.id === id);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= fields.length) return;
    [fields[i], fields[j]] = [fields[j], fields[i]];
    updateFields(fields);
  }

  function handleDrop(targetId: string) {
    if (!selected || !dragId || dragId === targetId) return;
    const fields = [...selected.fields];
    const from = fields.findIndex((f) => f.id === dragId);
    const to = fields.findIndex((f) => f.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = fields.splice(from, 1);
    fields.splice(to, 0, moved);
    updateFields(fields);
    setDragId(null);
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          eyebrow="Results management"
          title="Result templates"
          intro="Build result cards for each class and term, then preview changes as you go."
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={!selected || pending}
          className="inline-flex h-[38px] items-center gap-2 rounded-md border border-primary bg-primary px-3.5 text-caption font-medium text-white disabled:opacity-60"
        >
          <Check size={15} strokeWidth={1.8} />
          Save template
        </button>
      </div>

      {savedMessage && <p className="mb-4 rounded-md bg-success-bg px-3 py-2 text-caption text-success">{savedMessage}</p>}
      {error && <p className="mb-4 rounded-md bg-danger-bg px-3 py-2 text-caption text-danger">{error}</p>}

      <div className="grid items-start gap-4 lg:grid-cols-[200px_minmax(370px,1fr)_317px]">
        <section className="rounded-md border border-border bg-bg-card">
          <div className="border-b border-border px-4 py-4">
            <h2 className="m-0 text-body font-medium text-text-primary">Templates</h2>
            <p className="mt-1.5 text-caption text-text-muted">Choose a template to edit.</p>
          </div>
          <div className="grid gap-1 p-2.5">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                aria-pressed={t.id === selectedId}
                className={`flex items-start gap-2 rounded-md border px-2 py-2.5 text-left ${
                  t.id === selectedId ? "border-[#dae8f2] bg-primary-bg text-primary" : "border-transparent text-text-secondary hover:bg-bg-page"
                }`}
              >
                <FileText size={16} strokeWidth={1.8} className="mt-0.5" />
                <span>
                  <strong className="block text-caption font-medium leading-tight">{t.name}</strong>
                  <small className="mt-1 block text-[10px] text-text-muted">
                    {t.className ?? "No class"} · {t.fields.length} fields
                  </small>
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleNewTemplate}
            disabled={pending}
            className="mx-2.5 mb-3.5 h-[34px] w-[calc(100%-20px)] rounded-md border border-dashed border-border bg-bg-card text-caption font-medium text-primary hover:bg-primary-bg"
          >
            + New template
          </button>
        </section>

        {selected ? (
          <>
            <section className="rounded-md border border-border bg-bg-card">
              <div className="border-b border-border px-5 py-5">
                <h2 className="m-0 text-heading font-medium text-text-primary">Template editor</h2>
                <p className="mt-1.5 text-caption text-text-muted">Drag fields to reorder or edit their type.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 border-b border-border px-5 py-5 sm:grid-cols-3">
                <Field label="Template name">
                  <input
                    value={selected.name}
                    onChange={(e) => updateSelected({ name: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Applies to class">
                  <select
                    value={selected.classId ?? ""}
                    onChange={(e) =>
                      updateSelected({
                        classId: e.target.value || null,
                        className: classes.find((c) => c.id === e.target.value)?.name ?? null,
                      })
                    }
                    className={inputClass}
                  >
                    <option value="">All classes</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Term">
                  <input
                    value={selected.term ?? ""}
                    onChange={(e) => updateSelected({ term: e.target.value })}
                    placeholder="e.g. Term 2, 2025/2026"
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="px-5 py-5">
                <div className="mb-3.5 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="m-0 text-body font-medium text-text-primary">Result card fields</h3>
                    <p className="mt-1 text-caption text-text-muted">Choose what appears on the final result sheet.</p>
                  </div>
                  <span className="whitespace-nowrap rounded-md bg-bg-page px-2 py-1.5 text-[10px] text-text-secondary">
                    {selected.fields.length} fields
                  </span>
                </div>
                <div className="grid gap-2">
                  {selected.fields.length === 0 && (
                    <div className="rounded-md border border-dashed border-border px-5 py-6 text-center text-caption text-text-muted">
                      No fields yet. Add a field below.
                    </div>
                  )}
                  {selected.fields.map((f, i) => (
                    <div
                      key={f.id}
                      draggable
                      onDragStart={() => setDragId(f.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDrop(f.id)}
                      className="grid grid-cols-[24px_1fr_112px_auto] items-center gap-2 rounded-md border border-border bg-bg-card p-2"
                    >
                      <span className="grid cursor-grab place-items-center text-text-muted">
                        <GripVertical size={16} strokeWidth={1.8} />
                      </span>
                      <input
                        value={f.name}
                        onChange={(e) =>
                          updateFields(selected.fields.map((x) => (x.id === f.id ? { ...x, name: e.target.value } : x)))
                        }
                        aria-label={`Field ${i + 1} name`}
                        className="min-w-0 border-0 bg-transparent p-1 text-caption font-medium text-text-primary focus:outline-none"
                      />
                      <select
                        value={f.type}
                        onChange={(e) =>
                          updateFields(
                            selected.fields.map((x) =>
                              x.id === f.id ? { ...x, type: e.target.value as TemplateField["type"] } : x,
                            ),
                          )
                        }
                        className="h-[30px] rounded-md border border-border bg-bg-page px-1.5 text-[10px] text-text-secondary"
                      >
                        {FIELD_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      <span className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveField(f.id, -1)}
                          disabled={i === 0}
                          aria-label={`Move ${f.name} up`}
                          className="grid h-6 w-6 place-items-center rounded text-text-muted disabled:opacity-30"
                        >
                          <ChevronUp size={14} strokeWidth={1.8} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveField(f.id, 1)}
                          disabled={i === selected.fields.length - 1}
                          aria-label={`Move ${f.name} down`}
                          className="grid h-6 w-6 place-items-center rounded text-text-muted disabled:opacity-30"
                        >
                          <ChevronDown size={14} strokeWidth={1.8} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeField(f.id)}
                          aria-label={`Remove ${f.name}`}
                          className="grid h-6 w-6 place-items-center rounded text-text-muted hover:bg-danger-bg hover:text-danger"
                        >
                          <X size={14} strokeWidth={1.8} />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-border px-5 py-4">
                <button
                  type="button"
                  onClick={addField}
                  className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-dashed border-border bg-bg-page text-caption font-medium text-primary hover:bg-primary-bg"
                >
                  <Plus size={15} strokeWidth={1.8} />
                  Add field
                </button>
              </div>
            </section>

            <aside className="sticky top-4 rounded-md border border-border bg-bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-4">
                <h2 className="m-0 text-body font-medium text-text-primary">Live preview</h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-2 py-1 text-[10px] text-success before:h-1 before:w-1 before:rounded-full before:bg-current">
                  Live
                </span>
              </div>
              <div className="bg-[#f5f7f7] p-4">
                <div className="rounded border border-[#e0e6e8] bg-white p-4 text-[#334651]">
                  <div className="flex items-center gap-2 border-b border-[#e8ecee] pb-3">
                    <div className="grid h-[27px] w-[27px] place-items-center rounded bg-primary text-[10px] font-medium text-white">GI</div>
                    <div className="text-[9px] font-medium leading-tight">
                      Your school name
                      <small className="mt-0.5 block font-normal text-[#99a7af]">School address</small>
                    </div>
                  </div>
                  <div className="py-3.5 text-center">
                    <strong className="block text-caption font-medium">Student result sheet</strong>
                    <span className="mt-1 block text-[8px] text-[#8e9ca5]">
                      {selected.className ?? "All classes"} · {selected.term || "Term not set"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 rounded bg-[#f6f8f9] p-2 text-[8px]">
                    <div>
                      <span className="mb-1 block text-[#8b9aa3]">Student</span>
                      <b className="text-[#3d505a]">Sample Student</b>
                    </div>
                    <div>
                      <span className="mb-1 block text-[#8b9aa3]">Student ID</span>
                      <b className="text-[#3d505a]">SAMPLE-001</b>
                    </div>
                  </div>
                  <div className="grid gap-2.5 pt-3.5">
                    {selected.fields.length === 0 ? (
                      <div className="rounded border border-[#e8ecee] p-2.5 text-[9px] text-text-muted">
                        Add a field to see it here.
                      </div>
                    ) : (
                      selected.fields.map((f) => (
                        <div key={f.id} className="min-h-10 rounded border border-[#e8ecee] p-2.5">
                          <div className="mb-1.5 text-[8px] text-[#8a99a2]">{f.name || "Untitled field"}</div>
                          {previewValue(f)}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <p className="px-4 pb-4 text-center text-[10px] leading-relaxed text-text-muted">
                Sample values are shown for layout preview.
              </p>
            </aside>
          </>
        ) : (
          <section className="rounded-md border border-dashed border-border bg-bg-card px-6 py-16 text-center text-body text-text-muted lg:col-span-2">
            Select or create a template to get started.
          </section>
        )}
      </div>
    </>
  );
}

const inputClass = "h-[35px] min-w-0 rounded-md border border-border bg-bg-card px-2.5 text-caption text-text-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-[10px] text-text-muted">
      {label}
      {children}
    </label>
  );
}
