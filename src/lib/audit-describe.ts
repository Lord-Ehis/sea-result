import { termLabel, isTermNumber } from "@/lib/term-number";

// Plain-language summaries of audit events. Pure, so the page, the CSV export
// and the tests all say the same thing.

export const ACTION_LABEL: Record<string, string> = {
  SUBMITTED: "Submitted",
  SENT_BACK: "Sent back",
  APPROVED: "Approved",
  PUBLISHED: "Published",
  AMENDED: "Corrected after publication",
  TERM_EXCEPTION_SET: "Term marked not enrolled / exempt",
  TERM_EXCEPTION_CLEARED: "Term mark removed",
};

type Meta = Record<string, unknown>;

function asMeta(metadata: unknown): Meta {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Meta) : {};
}

const show = (v: unknown) => (v === "" || v === undefined || v === null ? "—" : String(v));

export function describeEvent(action: string, metadata: unknown): string {
  const m = asMeta(metadata);
  switch (action) {
    case "SUBMITTED":
    case "APPROVED":
      return typeof m.students === "number" ? `${m.students} student${m.students === 1 ? "" : "s"}` : "";
    case "PUBLISHED": {
      const parts = [typeof m.students === "number" ? `${m.students} student${m.students === 1 ? "" : "s"}` : ""];
      if (m.annualSummary) parts.push("with annual summary");
      if (m.backfilled) parts.push("recorded retrospectively");
      return parts.filter(Boolean).join(" · ");
    }
    case "SENT_BACK":
      return "";
    case "AMENDED": {
      const changes = Array.isArray(m.changes) ? (m.changes as { label?: unknown; from?: unknown; to?: unknown }[]) : [];
      const list = changes.map((c) => `${show(c.label)}: ${show(c.from)} → ${show(c.to)}`);
      if (m.promotion) list.push("promotion decision changed");
      return `Version ${show(m.version)}${list.length ? ` — ${list.join("; ")}` : ""}${m.positionsKept ? " (positions unchanged)" : ""}`;
    }
    case "TERM_EXCEPTION_SET": {
      const term = isTermNumber(m.termNumber) ? termLabel(m.termNumber) : "a term";
      return `${term}: ${m.status === "EXEMPT" ? "exempt" : "not enrolled"} (${show(m.session)})`;
    }
    case "TERM_EXCEPTION_CLEARED": {
      const term = isTermNumber(m.termNumber) ? termLabel(m.termNumber) : "a term";
      return `${term} mark removed (${show(m.session)})`;
    }
    default:
      return "";
  }
}

/** The student an event is about, when it isn't the whole batch. */
export function eventStudentId(metadata: unknown): string | null {
  const m = asMeta(metadata);
  return typeof m.studentId === "string" ? m.studentId : null;
}
