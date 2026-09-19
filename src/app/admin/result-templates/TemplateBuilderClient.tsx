"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { FileText, GripVertical, ChevronUp, ChevronDown, X, Plus, Check } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { createTemplate, updateTemplateMeta, type TemplateField, type ComputedFormula } from "./actions";
import {
  activateVersion,
  createDraftVersion,
  duplicateActiveVersionIntoDraft,
  getTemplateVersions,
  previewCompiledFields,
  updateVersionDraft,
  validateVersion,
} from "./version-actions";
import { GradeBandsEditor } from "./GradeBandsEditor";
import { SectionsEditor } from "./SectionsEditor";
import { GradingScaleEditor } from "./GradingScaleEditor";
import { RatingCategoriesEditor } from "./RatingCategoriesEditor";
import { ratingOptionsFor } from "@/lib/field-options";
import { PRESETS, type GradingScaleSummary, type PresetKey, type RatingCategoryInput, type SectionInput, type TemplateVersionSummary } from "./version-types";
import type { ValidationResult } from "@/lib/version-validate";

type ClassOption = { id: string; name: string };
type Template = {
  id: string;
  name: string;
  classId: string | null;
  className: string | null;
  level: string | null;
  term: string | null;
  fields: TemplateField[];
};
type Scope = "ALL" | "LEVEL" | "CLASS";

function scopeOf(t: Template): Scope {
  if (t.classId) return "CLASS";
  if (t.level) return "LEVEL";
  return "ALL";
}

// "Grid" and "Rating scale" are no longer directly buildable here — subjects
// live in the Sections editor and ratings in the Rating categories editor.
// Everything else (comments, promotion/result-analysis criteria, one-off
// numbers) still lives in this freeform "legacy fields" list.
const LEGACY_FIELD_TYPES: TemplateField["type"][] = ["Number", "Text", "Dropdown", "Computed"];

const FORMULA_LABEL: Record<ComputedFormula["kind"], string> = {
  sum: "Total (sum)",
  average: "Average",
  grade: "Grade",
  position: "Position",
  cumulative: "Cumulative (across terms)",
  remarksLookup: "Remarks lookup",
  promotion: "Promotion status",
  resultAnalysis: "Result analysis",
};

function defaultFormula(kind: ComputedFormula["kind"]): ComputedFormula {
  if (kind === "grade") return { kind, of: "", bands: [] };
  if (kind === "position") return { kind, of: "" };
  if (kind === "cumulative") return { kind, of: "", aggregate: "sum" };
  if (kind === "remarksLookup") return { kind, of: "", map: [] };
  if (kind === "resultAnalysis") return { kind, of: "" };
  if (kind === "promotion") {
    return { kind, subjectFields: [], compulsoryFields: [], passMark: 40, minOffered: 1, minPassed: 1, overallField: "", promotionScore: 40 };
  }
  return { kind, of: [] };
}

function previewValue(field: TemplateField) {
  const n = field.name.toLowerCase();
  if (field.type === "Grid") {
    const grid = field.grid;
    if (!grid || grid.subjects.length === 0 || grid.rawColumns.length === 0) {
      return <span className="text-[9px] italic text-[#8a99a2]">Configure subjects below.</span>;
    }
    const sampleSubjects = grid.subjects.slice(0, 3);
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-[8px]">
          <thead>
            <tr className="text-left text-[#8b9aa3]">
              <th className="py-1 pr-2 font-normal">Subject</th>
              {grid.rawColumns.map((c) => (
                <th key={c.id} className="py-1 pr-2 text-right font-normal">
                  {c.name || "—"}
                </th>
              ))}
              <th className="py-1 pr-2 text-right font-normal">Total</th>
              <th className="py-1 text-right font-normal">Grade</th>
            </tr>
          </thead>
          <tbody>
            {sampleSubjects.map((s, si) => (
              <tr key={s.id} className="border-t border-[#e9edef]">
                <td className="py-1.5 pr-2 text-[#637781]">{s.name || "Untitled subject"}</td>
                {grid.rawColumns.map((c, ci) => (
                  <td key={c.id} className="py-1.5 pr-2 text-right font-medium text-[#354b58]">
                    {7 + ((si + ci) % 3)}
                  </td>
                ))}
                <td className="py-1.5 pr-2 text-right font-medium text-[#354b58]">{80 + si * 4}</td>
                <td className="py-1.5 text-right font-medium text-[#354b58]">{grid.gradeBands[0]?.label || "A"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (field.type === "Computed") {
    const formula = field.formula;
    return (
      <span className="text-[9px] italic text-[#8a99a2]">
        Auto-calculated{formula ? ` — ${FORMULA_LABEL[formula.kind].toLowerCase()}` : ""}
      </span>
    );
  }
  if (field.type === "Number") {
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
    const options = ratingOptionsFor(field);
    const selectedIndex = Math.max(0, options.length - 2);
    return (
      <span className="flex flex-wrap gap-1">
        {options.map((opt, i) => (
          <span
            key={opt}
            className={`rounded-full px-1.5 py-0.5 text-[8px] font-medium ${
              i === selectedIndex ? "bg-primary text-white" : "bg-[#eef2f4] text-[#8b9aa3]"
            }`}
          >
            {opt}
          </span>
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

const STATUS_BADGE: Record<TemplateVersionSummary["status"], string> = {
  DRAFT: "bg-bg-page text-text-secondary",
  ACTIVE: "bg-success-bg text-success",
  ARCHIVED: "bg-bg-page text-text-muted",
};

export function TemplateBuilderClient({
  initialTemplates,
  classes,
  levels,
  initialGradingScales,
}: {
  initialTemplates: Template[];
  classes: ClassOption[];
  levels: string[];
  initialGradingScales: GradingScaleSummary[];
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [selectedId, setSelectedId] = useState<string | null>(initialTemplates[0]?.id ?? null);
  const [gradingScales, setGradingScales] = useState(initialGradingScales);
  const [versions, setVersions] = useState<TemplateVersionSummary[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const [draftSections, setDraftSections] = useState<SectionInput[]>([]);
  const [draftRatingCategories, setDraftRatingCategories] = useState<RatingCategoryInput[]>([]);
  const [draftGradingScaleId, setDraftGradingScaleId] = useState<string | null>(null);
  const [draftLegacyFields, setDraftLegacyFields] = useState<TemplateField[]>([]);
  const [previewFields, setPreviewFields] = useState<TemplateField[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = useMemo(() => templates.find((t) => t.id === selectedId) ?? null, [templates, selectedId]);
  const selectedVersion = useMemo(() => versions.find((v) => v.id === selectedVersionId) ?? null, [versions, selectedVersionId]);
  const isEditableDraft = selectedVersion?.status === "DRAFT";

  // Templates/versions switched are reflected during render, per React's
  // own recommended pattern for "reset local state when a prop/id changes"
  // (react.dev/learn/you-might-not-need-an-effect) — an Effect that only
  // resets state synchronously on a guard clause causes an extra cascading
  // render, which is exactly what this avoids.
  const [versionsOwnerId, setVersionsOwnerId] = useState<string | null>(selectedId);
  if (selectedId !== versionsOwnerId) {
    setVersionsOwnerId(selectedId);
    setVersions([]);
    setSelectedVersionId(null);
    setLoadingVersions(!!selectedId);
  }

  const [hydratedVersionId, setHydratedVersionId] = useState<string | null>(null);
  if (selectedVersionId !== hydratedVersionId) {
    setHydratedVersionId(selectedVersionId);
    setDraftSections(selectedVersion?.sections ?? []);
    setDraftRatingCategories(selectedVersion?.ratingCategories ?? []);
    setDraftGradingScaleId(selectedVersion?.gradingScaleId ?? null);
    setDraftLegacyFields(selectedVersion?.legacyFields ?? []);
    setValidation(null);
    setPreviewFields([]);
  }

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    getTemplateVersions(selectedId).then((vs) => {
      if (cancelled) return;
      setVersions(vs);
      const draft = vs.find((v) => v.status === "DRAFT");
      setSelectedVersionId((draft ?? vs[0])?.id ?? null);
      setLoadingVersions(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedVersion) return;
    const handle = setTimeout(() => {
      previewCompiledFields({
        versionId: selectedVersion.id,
        gradingScaleId: draftGradingScaleId,
        sections: draftSections,
        ratingCategories: draftRatingCategories,
        legacyFields: draftLegacyFields,
      })
        .then(setPreviewFields)
        .catch(() => {});
    }, 400);
    return () => clearTimeout(handle);
  }, [selectedVersion, draftGradingScaleId, draftSections, draftRatingCategories, draftLegacyFields]);

  function updateSelected(patch: Partial<Template>) {
    if (!selected) return;
    setTemplates((prev) => prev.map((t) => (t.id === selected.id ? { ...t, ...patch } : t)));
  }

  function refreshVersions(preferId?: string) {
    if (!selected) return Promise.resolve();
    return getTemplateVersions(selected.id).then((vs) => {
      setVersions(vs);
      if (preferId) setSelectedVersionId(preferId);
    });
  }

  function handleNewTemplate() {
    startTransition(async () => {
      const id = await createTemplate("Untitled template");
      const created: Template = { id, name: "Untitled template", classId: null, className: null, level: null, term: null, fields: [] };
      setTemplates((prev) => [...prev, created]);
      setSelectedId(id);
    });
  }

  function handleSaveMeta() {
    if (!selected) return;
    setError(null);
    setSavedMessage(null);
    startTransition(async () => {
      try {
        await updateTemplateMeta({
          id: selected.id,
          name: selected.name,
          classId: selected.classId ?? undefined,
          level: selected.level ?? undefined,
          term: selected.term ?? undefined,
        });
        setSavedMessage("Template details saved.");
        setTimeout(() => setSavedMessage(null), 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save template details.");
      }
    });
  }

  function handleInitializeVersioning() {
    if (!selected) return;
    startTransition(async () => {
      const id = await createDraftVersion(selected.id);
      await refreshVersions(id);
    });
  }

  function handleNewDraft(preset?: PresetKey) {
    if (!selected) return;
    startTransition(async () => {
      const id = await createDraftVersion(selected.id, preset ? { preset } : undefined);
      await refreshVersions(id);
    });
  }

  function handleDuplicateActive() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      try {
        const id = await duplicateActiveVersionIntoDraft(selected.id);
        await refreshVersions(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not duplicate the active version.");
      }
    });
  }

  function handleSaveDraft() {
    if (!selectedVersion) return;
    setError(null);
    setSavedMessage(null);
    startTransition(async () => {
      try {
        await updateVersionDraft({
          versionId: selectedVersion.id,
          gradingScaleId: draftGradingScaleId,
          sections: draftSections,
          ratingCategories: draftRatingCategories,
          legacyFields: draftLegacyFields,
        });
        setSavedMessage("Draft saved.");
        setTimeout(() => setSavedMessage(null), 3000);
        await refreshVersions(selectedVersion.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save draft.");
      }
    });
  }

  function handleValidate() {
    if (!selectedVersion) return;
    startTransition(async () => {
      const result = await validateVersion(selectedVersion.id);
      setValidation(result);
    });
  }

  function handleActivate() {
    if (!selectedVersion || !selected) return;
    setError(null);
    startTransition(async () => {
      try {
        await activateVersion(selectedVersion.id);
        const vs = await getTemplateVersions(selected.id);
        setVersions(vs);
        const active = vs.find((v) => v.status === "ACTIVE");
        setSelectedVersionId(active?.id ?? selectedVersion.id);
        setSavedMessage("Version activated — the result card now reflects it.");
        setTimeout(() => setSavedMessage(null), 4000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not activate.");
      }
    });
  }

  function onScaleCreated(scale: GradingScaleSummary) {
    setGradingScales((prev) => [...prev, scale]);
  }

  function addLegacyField() {
    setDraftLegacyFields((prev) => [...prev, { id: crypto.randomUUID(), name: "New field", type: "Text" }]);
  }

  function removeLegacyField(id: string) {
    setDraftLegacyFields((prev) => prev.filter((f) => f.id !== id));
  }

  function moveLegacyField(id: string, direction: -1 | 1) {
    setDraftLegacyFields((prev) => {
      const fields = [...prev];
      const i = fields.findIndex((f) => f.id === id);
      const j = i + direction;
      if (i < 0 || j < 0 || j >= fields.length) return prev;
      [fields[i], fields[j]] = [fields[j], fields[i]];
      return fields;
    });
  }

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    setDraftLegacyFields((prev) => {
      const fields = [...prev];
      const from = fields.findIndex((f) => f.id === dragId);
      const to = fields.findIndex((f) => f.id === targetId);
      if (from < 0 || to < 0) return prev;
      const [moved] = fields.splice(from, 1);
      fields.splice(to, 0, moved);
      return fields;
    });
    setDragId(null);
  }

  const previewList = previewFields.length > 0 ? previewFields : selected?.fields ?? [];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          eyebrow="Results management"
          title="Result templates"
          intro="Build versioned result templates, review weight validation, then activate for the class to use."
        />
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
                    {t.className ?? (t.level ? `Level: ${t.level}` : "All classes")} · {t.fields.length} fields
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
              <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-5">
                <div>
                  <h2 className="m-0 text-heading font-medium text-text-primary">Template editor</h2>
                  <p className="mt-1.5 text-caption text-text-muted">Details, subjects, grading and ratings for this template.</p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveMeta}
                  disabled={pending}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-caption font-medium text-text-secondary disabled:opacity-60"
                >
                  <Check size={14} strokeWidth={1.8} />
                  Save details
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 border-b border-border px-5 py-5 sm:grid-cols-2">
                <Field label="Template name">
                  <input value={selected.name} onChange={(e) => updateSelected({ name: e.target.value })} className={inputClass} />
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
              <div className="grid gap-2 border-b border-border px-5 py-5">
                <span className="text-[10px] text-text-muted">Applies to</span>
                <div className="inline-flex w-fit rounded-md border border-border bg-bg-page p-1">
                  {(
                    [
                      ["ALL", "All classes"],
                      ["LEVEL", "A level"],
                      ["CLASS", "A specific class"],
                    ] as const
                  ).map(([scope, label]) => (
                    <button
                      key={scope}
                      type="button"
                      onClick={() =>
                        updateSelected(
                          scope === "ALL"
                            ? { classId: null, className: null, level: null }
                            : scope === "LEVEL"
                              ? { classId: null, className: null, level: selected.level ?? levels[0] ?? "" }
                              : { level: null, classId: selected.classId ?? classes[0]?.id ?? null, className: classes[0]?.name ?? null },
                        )
                      }
                      className={`h-7 rounded-sm px-3 text-caption font-medium ${
                        scopeOf(selected) === scope ? "bg-bg-card text-primary shadow-sm" : "text-text-secondary"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {scopeOf(selected) === "LEVEL" && (
                  <select value={selected.level ?? ""} onChange={(e) => updateSelected({ level: e.target.value })} className={`${inputClass} mt-1 max-w-[220px]`}>
                    {levels.length === 0 && <option value="">No levels set up yet</option>}
                    {levels.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                )}
                {scopeOf(selected) === "CLASS" && (
                  <select
                    value={selected.classId ?? ""}
                    onChange={(e) => updateSelected({ classId: e.target.value || null, className: classes.find((c) => c.id === e.target.value)?.name ?? null })}
                    className={`${inputClass} mt-1 max-w-[220px]`}
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="border-b border-border px-5 py-5">
                <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="m-0 text-body font-medium text-text-primary">Versions</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      onChange={(e) => {
                        const value = e.target.value;
                        e.target.value = "";
                        if (value === "__blank__") handleNewDraft();
                        else if (value) handleNewDraft(value as PresetKey);
                      }}
                      defaultValue=""
                      disabled={pending}
                      className="h-8 rounded-md border border-dashed border-border bg-bg-card px-2 text-[10px] font-medium text-primary"
                    >
                      <option value="" disabled>
                        + New draft…
                      </option>
                      <option value="__blank__">Blank</option>
                      {Object.entries(PRESETS).map(([key, preset]) => (
                        <option key={key} value={key}>
                          From preset: {preset.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleDuplicateActive}
                      disabled={pending || !versions.some((v) => v.status === "ACTIVE")}
                      className="h-8 rounded-md border border-border px-2.5 text-[10px] font-medium text-text-secondary disabled:opacity-40"
                    >
                      Duplicate active into new draft
                    </button>
                  </div>
                </div>

                {loadingVersions ? (
                  <p className="m-0 text-caption text-text-muted">Loading versions…</p>
                ) : versions.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border px-4 py-5 text-center">
                    <p className="m-0 mb-2 text-caption text-text-muted">This template hasn&apos;t been set up in the versioned builder yet.</p>
                    <button
                      type="button"
                      onClick={handleInitializeVersioning}
                      disabled={pending}
                      className="h-8 rounded-md border border-primary bg-primary px-3 text-caption font-medium text-white disabled:opacity-60"
                    >
                      Initialize versioning
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {versions.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVersionId(v.id)}
                        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${
                          v.id === selectedVersionId ? "border-primary text-primary" : "border-border text-text-secondary"
                        }`}
                      >
                        v{v.versionNumber}
                        <span className={`rounded-full px-1.5 py-0.5 ${STATUS_BADGE[v.status]}`}>{v.status}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedVersion && (
                <>
                  <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
                    <div>
                      <h3 className="m-0 text-body font-medium text-text-primary">
                        Version {selectedVersion.versionNumber}
                        {!isEditableDraft && <span className="ml-2 text-[10px] font-normal text-text-muted">(read-only — {selectedVersion.status.toLowerCase()})</span>}
                      </h3>
                    </div>
                    {isEditableDraft && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleValidate}
                          disabled={pending}
                          className="h-8 rounded-md border border-border px-3 text-caption font-medium text-text-secondary disabled:opacity-60"
                        >
                          Validate
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveDraft}
                          disabled={pending}
                          className="h-8 rounded-md border border-border px-3 text-caption font-medium text-text-secondary disabled:opacity-60"
                        >
                          Save draft
                        </button>
                        <button
                          type="button"
                          onClick={handleActivate}
                          disabled={pending}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-primary bg-primary px-3 text-caption font-medium text-white disabled:opacity-60"
                        >
                          <Check size={14} strokeWidth={1.8} />
                          Activate
                        </button>
                      </div>
                    )}
                  </div>

                  {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
                    <div className="grid gap-1.5 border-b border-border px-5 py-4">
                      {validation.errors.map((e, i) => (
                        <p key={`err-${i}`} className="m-0 rounded-md bg-danger-bg px-3 py-2 text-caption text-danger">
                          {e.message}
                        </p>
                      ))}
                      {validation.warnings.map((w, i) => (
                        <p key={`warn-${i}`} className="m-0 rounded-md bg-bg-page px-3 py-2 text-caption text-text-secondary">
                          {w.message}
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="border-b border-border px-5 py-5">
                    <h3 className="m-0 mb-3 text-body font-medium text-text-primary">Subjects &amp; assessment components</h3>
                    <fieldset disabled={!isEditableDraft} className="disabled:opacity-60">
                      <SectionsEditor sections={draftSections} onChange={setDraftSections} />
                    </fieldset>
                  </div>

                  <div className="border-b border-border px-5 py-5">
                    <h3 className="m-0 mb-3 text-body font-medium text-text-primary">Grading scale</h3>
                    <fieldset disabled={!isEditableDraft} className="disabled:opacity-60">
                      <GradingScaleEditor scales={gradingScales} selectedId={draftGradingScaleId} onSelect={setDraftGradingScaleId} onScaleCreated={onScaleCreated} />
                    </fieldset>
                  </div>

                  <div className="border-b border-border px-5 py-5">
                    <h3 className="m-0 mb-3 text-body font-medium text-text-primary">Affective &amp; psychomotor ratings</h3>
                    <fieldset disabled={!isEditableDraft} className="disabled:opacity-60">
                      <RatingCategoriesEditor categories={draftRatingCategories} onChange={setDraftRatingCategories} />
                    </fieldset>
                  </div>

                  <div className="px-5 py-5">
                    <div className="mb-3.5 flex items-start justify-between gap-2">
                      <div>
                        <h3 className="m-0 text-body font-medium text-text-primary">Legacy &amp; advanced fields</h3>
                        <p className="mt-1 text-caption text-text-muted">Comments, promotion criteria and one-off fields not covered above.</p>
                      </div>
                      <span className="whitespace-nowrap rounded-md bg-bg-page px-2 py-1.5 text-[10px] text-text-secondary">{draftLegacyFields.length} fields</span>
                    </div>
                    <fieldset disabled={!isEditableDraft} className="grid gap-2 disabled:opacity-60">
                      {draftLegacyFields.length === 0 && (
                        <div className="rounded-md border border-dashed border-border px-5 py-6 text-center text-caption text-text-muted">No legacy fields.</div>
                      )}
                      {draftLegacyFields.map((f, i) => (
                        <div
                          key={f.id}
                          draggable={isEditableDraft}
                          onDragStart={() => setDragId(f.id)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleDrop(f.id)}
                          className="rounded-md border border-border bg-bg-card"
                        >
                          <div className="flex flex-col gap-2 p-2 sm:flex-row sm:items-center">
                            <div className="flex items-center gap-2 sm:min-w-0 sm:flex-1">
                              <span className="grid cursor-grab place-items-center text-text-muted">
                                <GripVertical size={16} strokeWidth={1.8} />
                              </span>
                              <input
                                value={f.name}
                                onChange={(e) => setDraftLegacyFields((prev) => prev.map((x) => (x.id === f.id ? { ...x, name: e.target.value } : x)))}
                                aria-label={`Field ${i + 1} name`}
                                className="min-w-0 flex-1 border-0 bg-transparent p-1 text-caption font-medium text-text-primary focus:outline-none"
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2 sm:justify-end">
                              <select
                                value={f.type}
                                onChange={(e) => {
                                  const type = e.target.value as TemplateField["type"];
                                  setDraftLegacyFields((prev) =>
                                    prev.map((x) =>
                                      x.id === f.id
                                        ? { ...x, type, formula: type === "Computed" ? (x.formula ?? defaultFormula("sum")) : undefined, ratingOptions: undefined, grid: undefined }
                                        : x,
                                    ),
                                  );
                                }}
                                className="h-[30px] rounded-md border border-border bg-bg-page px-1.5 text-[10px] text-text-secondary sm:w-[112px]"
                              >
                                {LEGACY_FIELD_TYPES.map((type) => (
                                  <option key={type} value={type}>
                                    {type}
                                  </option>
                                ))}
                              </select>
                              <span className="flex items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => moveLegacyField(f.id, -1)}
                                  disabled={i === 0}
                                  aria-label={`Move ${f.name} up`}
                                  className="grid h-6 w-6 place-items-center rounded text-text-muted disabled:opacity-30"
                                >
                                  <ChevronUp size={14} strokeWidth={1.8} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveLegacyField(f.id, 1)}
                                  disabled={i === draftLegacyFields.length - 1}
                                  aria-label={`Move ${f.name} down`}
                                  className="grid h-6 w-6 place-items-center rounded text-text-muted disabled:opacity-30"
                                >
                                  <ChevronDown size={14} strokeWidth={1.8} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeLegacyField(f.id)}
                                  aria-label={`Remove ${f.name}`}
                                  className="grid h-6 w-6 place-items-center rounded text-text-muted hover:bg-danger-bg hover:text-danger"
                                >
                                  <X size={14} strokeWidth={1.8} />
                                </button>
                              </span>
                            </div>
                          </div>
                          {f.type === "Computed" && (
                            <FormulaConfig
                              field={f}
                              otherFields={draftLegacyFields.filter((x) => x.id !== f.id)}
                              onChange={(formula) => setDraftLegacyFields((prev) => prev.map((x) => (x.id === f.id ? { ...x, formula } : x)))}
                            />
                          )}
                        </div>
                      ))}
                    </fieldset>
                    {isEditableDraft && (
                      <button
                        type="button"
                        onClick={addLegacyField}
                        className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-md border border-dashed border-border bg-bg-page text-caption font-medium text-primary hover:bg-primary-bg"
                      >
                        <Plus size={15} strokeWidth={1.8} />
                        Add legacy field
                      </button>
                    )}
                  </div>
                </>
              )}
            </section>

            <aside className="rounded-md border border-border bg-bg-card lg:sticky lg:top-4">
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
                      {selected.className ?? (selected.level ? `Level: ${selected.level}` : "All classes")} · {selected.term || "Term not set"}
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
                    {previewList.length === 0 ? (
                      <div className="rounded border border-[#e8ecee] p-2.5 text-[9px] text-text-muted">Add subjects or fields to see them here.</div>
                    ) : (
                      previewList.map((f) => (
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
                {isEditableDraft ? "Preview reflects your unsaved draft." : "Preview reflects this version's saved configuration."}
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

const selectClass = "h-[30px] rounded-md border border-border bg-bg-card px-2 text-[10px] text-text-primary";

function FormulaConfig({
  field,
  otherFields,
  onChange,
}: {
  field: TemplateField;
  otherFields: TemplateField[];
  onChange: (formula: ComputedFormula) => void;
}) {
  const formula = field.formula ?? defaultFormula("sum");

  function changeKind(kind: ComputedFormula["kind"]) {
    onChange(defaultFormula(kind));
  }

  return (
    <div className="grid gap-3 border-t border-border bg-bg-page px-3 py-3">
      <label className="grid gap-1.5 text-[10px] text-text-muted">
        Formula
        <select value={formula.kind} onChange={(e) => changeKind(e.target.value as ComputedFormula["kind"])} className={`${selectClass} max-w-[180px]`}>
          {(["sum", "average", "grade", "position", "cumulative", "promotion", "resultAnalysis"] as const).map((kind) => (
            <option key={kind} value={kind}>
              {FORMULA_LABEL[kind]}
            </option>
          ))}
        </select>
      </label>

      {(formula.kind === "sum" || formula.kind === "average") && (
        <div className="grid gap-1.5">
          <span className="text-[10px] text-text-muted">{formula.kind === "sum" ? "Sum of" : "Average of"}</span>
          {otherFields.length === 0 ? (
            <p className="m-0 text-[10px] text-text-muted">Add other fields first.</p>
          ) : (
            <div className="grid max-h-[140px] gap-1 overflow-y-auto rounded-md border border-border bg-bg-card p-1.5">
              {otherFields.map((of) => (
                <label key={of.id} className="flex cursor-pointer items-center gap-2 rounded-md p-1.5 text-[10px] text-text-secondary hover:bg-bg-page">
                  <input
                    type="checkbox"
                    checked={formula.of.includes(of.id)}
                    onChange={(e) =>
                      onChange({ ...formula, of: e.target.checked ? [...formula.of, of.id] : formula.of.filter((id) => id !== of.id) })
                    }
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  {of.name || "Untitled field"}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {formula.kind === "grade" && (
        <>
          <label className="grid gap-1.5 text-[10px] text-text-muted">
            Grade of
            <select value={formula.of} onChange={(e) => onChange({ ...formula, of: e.target.value })} className={`${selectClass} max-w-[180px]`}>
              <option value="">Select a field…</option>
              {otherFields.map((of) => (
                <option key={of.id} value={of.id}>
                  {of.name || "Untitled field"}
                </option>
              ))}
            </select>
          </label>
          <GradeBandsEditor bands={formula.bands} onChange={(bands) => onChange({ ...formula, bands })} />
        </>
      )}

      {formula.kind === "position" && (
        <label className="grid gap-1.5 text-[10px] text-text-muted">
          Position by
          <select value={formula.of} onChange={(e) => onChange({ ...formula, of: e.target.value })} className={`${selectClass} max-w-[180px]`}>
            <option value="">Select a field…</option>
            {otherFields.map((of) => (
              <option key={of.id} value={of.id}>
                {of.name || "Untitled field"}
              </option>
            ))}
          </select>
        </label>
      )}

      {formula.kind === "cumulative" && (
        <>
          <label className="grid gap-1.5 text-[10px] text-text-muted">
            Accumulate
            <select value={formula.of} onChange={(e) => onChange({ ...formula, of: e.target.value })} className={`${selectClass} max-w-[180px]`}>
              <option value="">Select a field…</option>
              {otherFields.map((of) => (
                <option key={of.id} value={of.id}>
                  {of.name || "Untitled field"}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-[10px] text-text-muted">
            As
            <select value={formula.aggregate} onChange={(e) => onChange({ ...formula, aggregate: e.target.value as "sum" | "average" })} className={`${selectClass} max-w-[180px]`}>
              <option value="sum">Total across terms</option>
              <option value="average">Average across terms</option>
            </select>
          </label>
        </>
      )}

      {formula.kind === "promotion" && (
        <>
          <div className="grid gap-1.5">
            <span className="text-[10px] text-text-muted">Subjects</span>
            {otherFields.length === 0 ? (
              <p className="m-0 text-[10px] text-text-muted">Add other fields first.</p>
            ) : (
              <div className="grid max-h-[140px] gap-1 overflow-y-auto rounded-md border border-border bg-bg-card p-1.5">
                {otherFields.map((of) => (
                  <label key={of.id} className="flex cursor-pointer items-center gap-2 rounded-md p-1.5 text-[10px] text-text-secondary hover:bg-bg-page">
                    <input
                      type="checkbox"
                      checked={formula.subjectFields.includes(of.id)}
                      onChange={(e) =>
                        onChange({
                          ...formula,
                          subjectFields: e.target.checked ? [...formula.subjectFields, of.id] : formula.subjectFields.filter((id) => id !== of.id),
                          compulsoryFields: e.target.checked ? formula.compulsoryFields : formula.compulsoryFields.filter((id) => id !== of.id),
                        })
                      }
                      className="h-3.5 w-3.5 accent-primary"
                    />
                    {of.name || "Untitled field"}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-1.5">
            <span className="text-[10px] text-text-muted">Compulsory subjects (must be passed individually)</span>
            {formula.subjectFields.length === 0 ? (
              <p className="m-0 text-[10px] text-text-muted">Pick subjects above first.</p>
            ) : (
              <div className="grid max-h-[140px] gap-1 overflow-y-auto rounded-md border border-border bg-bg-card p-1.5">
                {otherFields
                  .filter((of) => formula.subjectFields.includes(of.id))
                  .map((of) => (
                    <label key={of.id} className="flex cursor-pointer items-center gap-2 rounded-md p-1.5 text-[10px] text-text-secondary hover:bg-bg-page">
                      <input
                        type="checkbox"
                        checked={formula.compulsoryFields.includes(of.id)}
                        onChange={(e) =>
                          onChange({
                            ...formula,
                            compulsoryFields: e.target.checked ? [...formula.compulsoryFields, of.id] : formula.compulsoryFields.filter((id) => id !== of.id),
                          })
                        }
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      {of.name || "Untitled field"}
                    </label>
                  ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1.5 text-[10px] text-text-muted">
              Pass mark
              <input
                type="number"
                value={formula.passMark}
                onChange={(e) => onChange({ ...formula, passMark: Number(e.target.value) })}
                className="h-[30px] rounded-md border border-border bg-bg-card px-2 text-[10px] text-text-primary"
              />
            </label>
            <label className="grid gap-1.5 text-[10px] text-text-muted">
              Promotion score
              <input
                type="number"
                value={formula.promotionScore}
                onChange={(e) => onChange({ ...formula, promotionScore: Number(e.target.value) })}
                className="h-[30px] rounded-md border border-border bg-bg-card px-2 text-[10px] text-text-primary"
              />
            </label>
            <label className="grid gap-1.5 text-[10px] text-text-muted">
              Min. subjects offered
              <input
                type="number"
                value={formula.minOffered}
                onChange={(e) => onChange({ ...formula, minOffered: Number(e.target.value) })}
                className="h-[30px] rounded-md border border-border bg-bg-card px-2 text-[10px] text-text-primary"
              />
            </label>
            <label className="grid gap-1.5 text-[10px] text-text-muted">
              Min. subjects passed
              <input
                type="number"
                value={formula.minPassed}
                onChange={(e) => onChange({ ...formula, minPassed: Number(e.target.value) })}
                className="h-[30px] rounded-md border border-border bg-bg-card px-2 text-[10px] text-text-primary"
              />
            </label>
          </div>

          <label className="grid gap-1.5 text-[10px] text-text-muted">
            Overall average field
            <select value={formula.overallField} onChange={(e) => onChange({ ...formula, overallField: e.target.value })} className={`${selectClass} max-w-[180px]`}>
              <option value="">Select a field…</option>
              {otherFields.map((of) => (
                <option key={of.id} value={of.id}>
                  {of.name || "Untitled field"}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {formula.kind === "resultAnalysis" && (
        <label className="grid gap-1.5 text-[10px] text-text-muted">
          Explains the criteria of
          <select value={formula.of} onChange={(e) => onChange({ ...formula, of: e.target.value })} className={`${selectClass} max-w-[180px]`}>
            <option value="">Select a Promotion status field…</option>
            {otherFields
              .filter((of) => of.formula?.kind === "promotion")
              .map((of) => (
                <option key={of.id} value={of.id}>
                  {of.name || "Untitled field"}
                </option>
              ))}
          </select>
        </label>
      )}
    </div>
  );
}
