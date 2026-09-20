import type { TemplateField } from "@/app/admin/result-templates/actions";
import { gridKey } from "@/lib/grid-compute";
import { validateSingleValue } from "@/lib/result-validate";
import { EXPLICIT_SCORE_STATES, SCORE_STATE_LABEL, explicitScoreState, scoreStateKey, type ExplicitScoreState } from "@/lib/score-state";

// Bulk score entry from a spreadsheet (spec §10.2). Pure — runs in the browser
// so a teacher gets an instant row-by-row report. It only *fills the on-screen
// sheet*: saving and submitting still go through the server's own validation,
// which stays the authority, and every cell here is checked with that same
// engine (`validateSingleValue`).

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 500;

const CODE_HEADER = "Student code";
const NAME_HEADER = "Student name";

export type ScoreColumn = { header: string; key: string; kind: "score" | "field"; max?: number };
export type SheetStudent = { id: string; name: string; studentCode: string };

/** One column per teacher-entered cell: every subject × component, then each non-computed field. */
export function scoreColumns(fields: TemplateField[]): ScoreColumn[] {
  const columns: ScoreColumn[] = [];
  const used = new Map<string, number>();
  const unique = (header: string) => {
    const n = (used.get(header.toLowerCase()) ?? 0) + 1;
    used.set(header.toLowerCase(), n);
    return n === 1 ? header : `${header} #${n}`;
  };

  for (const f of fields) {
    if (f.type === "Computed") continue;
    if (f.type === "Grid" && f.grid) {
      for (const s of f.grid.subjects) {
        for (const c of f.grid.rawColumns) {
          columns.push({
            header: unique(`${s.name || "Untitled subject"} – ${c.name || "score"} (max ${c.maxMark})`),
            key: gridKey(f.id, s.id, c.id),
            kind: "score",
            max: c.maxMark,
          });
        }
      }
    } else {
      columns.push({ header: unique(f.name || "Untitled field"), key: f.id, kind: "field" });
    }
  }
  return columns;
}

// ---- CSV text ------------------------------------------------------------

function csvCell(value: string): string {
  // A cell a spreadsheet would run as a formula is neutralised with a leading apostrophe.
  const safe = /^[=+@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** Detects , or ; (Excel in many locales saves semicolons) from the header line. */
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  let inQuotes = false;
  let commas = 0;
  let semis = 0;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch === ",") commas++;
    else if (!inQuotes && ch === ";") semis++;
  }
  return semis > commas ? ";" : ",";
}

/** RFC 4180-style parser: quoted fields, doubled quotes, CRLF/LF, optional BOM. Blank lines are dropped. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const endCell = () => {
    row.push(cell);
    cell = "";
  };
  const endRow = () => {
    endCell();
    if (row.some((c) => c.trim() !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") inQuotes = true;
    else if (ch === delimiter) endCell();
    else if (ch === "\n") endRow();
    else if (ch === "\r") {
      if (text[i + 1] === "\n") i++;
      endRow();
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) endRow();
  return rows;
}

// ---- Download ------------------------------------------------------------

/** A ready-to-fill sheet: current values are pre-filled (with ABS/EXM/N/A for explicit states). */
export function buildScoreSheet(fields: TemplateField[], students: SheetStudent[], dataByStudent: Record<string, Record<string, string>>): string {
  const columns = scoreColumns(fields);
  const header = [CODE_HEADER, NAME_HEADER, ...columns.map((c) => c.header)];
  const body = students.map((s) => {
    const data = dataByStudent[s.id] ?? {};
    return [
      s.studentCode,
      s.name,
      ...columns.map((c) => {
        const state = c.kind === "score" ? explicitScoreState(data, c.key) : null;
        return state ? SCORE_STATE_LABEL[state] : (data[c.key] ?? "");
      }),
    ];
  });
  return "﻿" + toCsv([header, ...body]);
}

// ---- Import --------------------------------------------------------------

export type ImportError = { row: number; studentCode: string; column: string; message: string };

export type ImportResult = {
  /** Cell patches per student for rows that had no problems; includes `#state` keys. */
  applied: Record<string, Record<string, string>>;
  errors: ImportError[];
  unknownColumns: string[];
  totalRows: number;
  rowsApplied: number;
  rowsSkipped: number;
};

const TOKENS: Record<string, ExplicitScoreState> = Object.fromEntries(
  EXPLICIT_SCORE_STATES.map((s) => [SCORE_STATE_LABEL[s].toLowerCase(), s]),
);

function unformula(value: string): string {
  return /^'[=+@\-]/.test(value) ? value.slice(1) : value;
}

export function parseScoreSheet(text: string, fields: TemplateField[], students: SheetStudent[]): ImportResult {
  const empty: ImportResult = { applied: {}, errors: [], unknownColumns: [], totalRows: 0, rowsApplied: 0, rowsSkipped: 0 };
  const fatal = (message: string): ImportResult => ({ ...empty, errors: [{ row: 1, studentCode: "", column: "", message }] });

  const rows = parseCsv(text);
  if (rows.length === 0) return fatal("The file is empty.");
  if (rows.length - 1 > MAX_IMPORT_ROWS) return fatal(`The file has more than ${MAX_IMPORT_ROWS} student rows.`);

  const header = rows[0].map((h) => unformula(h.trim()));
  const codeIndex = header.findIndex((h) => h.toLowerCase() === CODE_HEADER.toLowerCase());
  if (codeIndex < 0) return fatal(`The first row must include a "${CODE_HEADER}" column. Download the sheet from this page and fill that in.`);

  const columns = scoreColumns(fields);
  const byHeader = new Map(columns.map((c) => [c.header.toLowerCase(), c]));
  const mapped = header.map((h, index) => ({ index, column: byHeader.get(h.toLowerCase()) }));
  const unknownColumns = header.filter((h, i) => i !== codeIndex && h !== "" && h.toLowerCase() !== NAME_HEADER.toLowerCase() && !byHeader.has(h.toLowerCase()));

  const byCode = new Map(students.map((s) => [s.studentCode.toLowerCase(), s]));
  const seen = new Set<string>();
  const result: ImportResult = { ...empty, unknownColumns, totalRows: rows.length - 1 };

  rows.slice(1).forEach((cells, i) => {
    const rowNumber = i + 2; // spreadsheet row: the header is row 1
    const code = unformula((cells[codeIndex] ?? "").trim());
    const student = byCode.get(code.toLowerCase());
    const rowErrors: ImportError[] = [];

    if (!code) rowErrors.push({ row: rowNumber, studentCode: "", column: CODE_HEADER, message: "Student code is blank." });
    else if (!student) rowErrors.push({ row: rowNumber, studentCode: code, column: CODE_HEADER, message: "No student with this code in this class." });
    else if (seen.has(student.id)) rowErrors.push({ row: rowNumber, studentCode: code, column: CODE_HEADER, message: "This student appears more than once in the file." });

    const patch: Record<string, string> = {};
    if (student && rowErrors.length === 0) {
      for (const { index, column } of mapped) {
        if (!column) continue;
        const raw = unformula((cells[index] ?? "").trim());
        if (raw === "") continue; // blank = leave whatever is already there

        const token = column.kind === "score" ? TOKENS[raw.toLowerCase()] : undefined;
        if (token) {
          patch[scoreStateKey(column.key)] = token;
          patch[column.key] = "";
          continue;
        }
        const problem = validateSingleValue(fields, column.key, raw);
        if (problem) {
          rowErrors.push({ row: rowNumber, studentCode: code, column: column.header, message: problem });
          continue;
        }
        patch[column.key] = raw;
        if (column.kind === "score") patch[scoreStateKey(column.key)] = "";
      }
    }

    if (student) seen.add(student.id);
    if (rowErrors.length > 0) {
      result.errors.push(...rowErrors);
      result.rowsSkipped++;
    } else if (student) {
      result.applied[student.id] = patch;
      result.rowsApplied++;
    }
  });

  return result;
}

/** The row-level error report as a downloadable CSV. */
export function buildErrorReport(errors: ImportError[]): string {
  return "﻿" + toCsv([["Row", "Student code", "Column", "Problem"], ...errors.map((e) => [String(e.row), e.studentCode, e.column, e.message])]);
}
