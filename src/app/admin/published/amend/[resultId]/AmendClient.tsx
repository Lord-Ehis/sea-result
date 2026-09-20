"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { GridEntryTable } from "@/components/results/GridEntryTable";
import { FlatFieldEditor, isBlank } from "@/components/results/FlatFieldEditor";
import { SnapshotView } from "@/components/results/SnapshotView";
import { amendResult, previewAmendment, type AmendChange, type AmendInput } from "../../actions";
import type { SnapshotPayload } from "@/lib/snapshot";
import type { TemplateField } from "@/app/admin/result-templates/actions";
import { computeOwnFields } from "@/lib/template-compute";
import { expandThisTermFields, gridRawKeys } from "@/lib/grid-compute";
import { allowedDataKeys } from "@/lib/result-validate";
import { computedAtPublish } from "@/lib/result-field-display";

type PromotionStatus = "PROMOTED" | "RETAINED" | "GRADUATED" | "PENDING" | "NOT_APPLICABLE";

const PROMOTION_LABEL: Record<PromotionStatus, string> = {
  PROMOTED: "Promoted",
  RETAINED: "Retained (repeat class)",
  GRADUATED: "Graduated",
  PENDING: "Decision pending",
  NOT_APPLICABLE: "Not applicable",
};

type HistoryRow = {
  id: string;
  version: number;
  issuedAt: string;
  reason: string | null;
  by: string | null;
  current: boolean;
  supersededAt: string | null;
  verificationCode: string;
};

const selectClass = "h-9 rounded-md border border-border bg-bg-card px-2 text-caption text-text-primary";

export function AmendClient({
  resultId,
  studentName,
  snapshotId,
  currentVersion,
  fields,
  initialData,
  annual,
  earlierTermAnnualNote,
  classes,
  backHref,
  history,
}: {
  resultId: string;
  studentName: string;
  snapshotId: string;
  currentVersion: number;
  fields: TemplateField[];
  initialData: Record<string, string>;
  annual: { promotionStatus: PromotionStatus | null; promotedToClassId: string | null } | null;
  earlierTermAnnualNote: boolean;
  classes: { id: string; name: string }[];
  backHref: string;
  history: HistoryRow[];
}) {
  const router = useRouter();
  const [entries, setEntries] = useState<Record<string, string>>({ ...initialData });
  const [promotion, setPromotion] = useState<{ status: PromotionStatus | ""; classId: string }>({
    status: annual?.promotionStatus ?? "",
    classId: annual?.promotedToClassId ?? "",
  });
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ payload: SnapshotPayload; changes: AmendChange[] } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();

  const gridField = useMemo(() => fields.find((f) => f.type === "Grid" && f.grid), [fields]);
  const flatFields = useMemo(() => fields.filter((f) => f.type !== "Grid"), [fields]);
  const expanded = useMemo(() => expandThisTermFields(fields), [fields]);
  const computed = useMemo(() => computeOwnFields(expanded, entries), [expanded, entries]);
  const allowed = useMemo(() => allowedDataKeys(fields), [fields]);
  const blankKeys = useMemo(() => {
    const keys = [...(gridField ? gridRawKeys(gridField) : []), ...flatFields.filter((f) => !computedAtPublish(f)).map((f) => f.id)];
    return new Set(keys.filter((k) => isBlank(entries, k)));
  }, [gridField, flatFields, entries]);

  const changes = useMemo(() => {
    const out: Record<string, string> = {};
    for (const key of allowed) if ((entries[key] ?? "") !== (initialData[key] ?? "")) out[key] = entries[key] ?? "";
    return out;
  }, [allowed, entries, initialData]);
  const promotionChanged = !!annual && !!promotion.status && (promotion.status !== annual.promotionStatus || (promotion.status === "PROMOTED" ? promotion.classId : "") !== (annual.promotedToClassId ?? ""));
  const hasChanges = Object.keys(changes).length > 0 || promotionChanged;

  function input(): AmendInput {
    return {
      resultId,
      basedOnSnapshotId: snapshotId,
      changes,
      promotion: annual && promotion.status ? { status: promotion.status, promotedToClassId: promotion.status === "PROMOTED" ? promotion.classId || null : null } : null,
      reason,
      notifyParents: notify,
    };
  }

  function handlePreview() {
    setError(null);
    startTransition(async () => {
      const result = await previewAmendment(input());
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPreview({ payload: result.payload, changes: result.changes });
    });
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await amendResult(input());
      setConfirm(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(backHref);
    });
  }

  return (
    <>
      {error && <p className="mb-4 rounded-md bg-danger-bg px-3 py-2 text-caption text-danger">{error}</p>}
      {earlierTermAnnualNote && (
        <p className="mb-4 rounded-md border border-warning/30 bg-warning-bg px-4 py-3 text-caption text-warning">
          A correction here does not change any 3rd Term annual summary that has already been published for this student — that stays as it was issued.
        </p>
      )}

      <section className="overflow-hidden rounded-md border border-border bg-bg-card">
        <div className="border-b border-border px-5 py-5">
          <h2 className="m-0 text-heading font-medium text-text-primary">{studentName}</h2>
          <p className="mt-1.5 text-caption text-text-muted">
            Edit only what needs correcting. Totals, grades and remarks are recalculated for this student; positions stay as published.
          </p>
        </div>
        <div className="grid gap-5 p-5">
          {flatFields.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {flatFields.map((f) => (
                <label key={f.id} className="grid gap-1.5 text-[10px] text-text-muted">
                  {f.name}
                  <FlatFieldEditor
                    field={f}
                    value={(f.type === "Computed" ? computed[f.id] : entries[f.id]) ?? ""}
                    blank={false}
                    onChange={(v) => setEntries((prev) => ({ ...prev, [f.id]: v }))}
                    onBlur={() => {}}
                  />
                </label>
              ))}
            </div>
          )}
          {gridField && (
            <GridEntryTable
              field={gridField}
              data={entries}
              computed={computed}
              onChange={(key, value) => setEntries((prev) => ({ ...prev, [key]: value }))}
              locked={pending}
              blankKeys={blankKeys}
            />
          )}

          {annual && (
            <div className="grid gap-2 rounded-md border border-border p-4">
              <strong className="text-body font-medium text-text-primary">Promotion decision</strong>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={promotion.status}
                  onChange={(e) => setPromotion((p) => ({ ...p, status: e.target.value as PromotionStatus | "" }))}
                  className={selectClass}
                  aria-label="Promotion decision"
                >
                  <option value="">Choose…</option>
                  {(Object.keys(PROMOTION_LABEL) as PromotionStatus[]).map((k) => (
                    <option key={k} value={k}>
                      {PROMOTION_LABEL[k]}
                    </option>
                  ))}
                </select>
                {promotion.status === "PROMOTED" && (
                  <select value={promotion.classId} onChange={(e) => setPromotion((p) => ({ ...p, classId: e.target.value }))} className={selectClass} aria-label="Promoted to class">
                    <option value="">Promoted to…</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mt-5 rounded-md border border-border bg-bg-card p-5">
        <h2 className="m-0 text-body font-medium text-text-primary">Reason for the correction</h2>
        <p className="mt-1.5 mb-3 text-caption text-text-muted">Required. It is kept in the audit trail with your name and the old and new values.</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Exam score was entered as 45 instead of 54."
          className="min-h-[84px] w-full resize-y rounded-md border border-border bg-bg-card p-3 text-body text-text-primary"
        />
        <label className="mt-3 flex items-center gap-2 text-caption text-text-secondary">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          Tell the parent/guardian by SMS and email that a corrected result is available
        </label>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePreview}
            disabled={pending || !hasChanges}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-bg-card px-3.5 text-caption font-medium text-text-secondary disabled:opacity-50"
          >
            <Eye size={14} strokeWidth={1.8} />
            Preview as parent
          </button>
          <button
            type="button"
            onClick={() => setConfirm(true)}
            disabled={pending || !hasChanges || reason.trim().length < 5}
            className="inline-flex h-9 items-center rounded-md border border-primary bg-primary px-3.5 text-caption font-medium text-white disabled:opacity-50"
          >
            Issue corrected result
          </button>
          <Link href={backHref} className="text-caption text-text-muted hover:text-primary">
            Cancel
          </Link>
          {!hasChanges && <span className="text-caption text-text-muted">Change a value to enable these.</span>}
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-md border border-border bg-bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="m-0 text-body font-medium text-text-primary">Version history</h2>
        </div>
        <ul className="m-0 list-none divide-y divide-[#f0f2f3] p-0">
          {history.map((h) => (
            <li key={h.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5">
              <div>
                <strong className="text-body font-medium text-text-primary">
                  Version {h.version}
                  {h.current ? " · current" : " · superseded"}
                </strong>
                <p className="m-0 mt-0.5 text-caption text-text-muted">
                  Issued {new Date(h.issuedAt).toLocaleString("en-GB")} · code <span className="font-mono">{h.verificationCode}</span>
                  {h.supersededAt ? ` · replaced ${new Date(h.supersededAt).toLocaleDateString("en-GB")}` : ""}
                </p>
                {h.reason && (
                  <p className="m-0 mt-0.5 text-caption text-text-secondary">
                    Reason: {h.reason}
                    {h.by ? ` — ${h.by}` : ""}
                  </p>
                )}
              </div>
              <Link href={`/result/${h.id}/print`} target="_blank" className="text-caption font-medium text-primary hover:underline">
                View
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Modal open={preview !== null} onClose={() => setPreview(null)} title="Preview as parent" description="Exactly what the corrected result will look like." width={760}>
        <div className="max-h-[70vh] overflow-y-auto p-5">
          {preview && (
            <>
              <div className="mb-4 rounded-md bg-bg-page p-3">
                <strong className="text-caption font-medium text-text-primary">What changes</strong>
                <ul className="m-0 mt-1.5 list-disc pl-5 text-caption text-text-secondary">
                  {preview.changes.map((c) => (
                    <li key={c.key}>
                      {c.label}: {c.from || "—"} → {c.to || "—"}
                    </li>
                  ))}
                  {preview.changes.length === 0 && <li>Promotion decision only.</li>}
                </ul>
              </div>
              <SnapshotView payload={preview.payload} preview />
            </>
          )}
        </div>
      </Modal>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Issue the corrected result?" description={`${studentName} · version ${currentVersion + 1}`}>
        <div className="px-6 pt-5">
          <p className="m-0 text-body leading-relaxed text-text-secondary">
            Parents will see the corrected result straight away{notify ? ", and they will be notified" : ""}. Version {currentVersion} is kept for the school and its
            verification code will show as superseded. This can&apos;t be undone — a further correction would issue another version.
          </p>
        </div>
        <div className="flex justify-end gap-2 px-6 py-5">
          <button type="button" onClick={() => setConfirm(false)} className="inline-flex h-9 items-center rounded-md border border-border bg-bg-card px-3.5 text-caption font-medium text-text-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending}
            className="inline-flex h-9 items-center rounded-md border border-primary bg-primary px-3.5 text-caption font-medium text-white disabled:opacity-60"
          >
            {pending ? "Issuing…" : "Issue corrected result"}
          </button>
        </div>
      </Modal>
    </>
  );
}
