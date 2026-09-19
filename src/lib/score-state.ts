// Explicit score states (spec §2 principle 5: missing, absent and exempted are
// distinct, never silently zero). Pure — safe for client and server.
//
// A cell's raw value lives in Result.data under its normal key; any
// non-default state lives beside it under `${key}#state`. No state key plus a
// non-blank value means "scored"; no state key plus a blank means "missing".

export type ScoreState = "scored" | "missing" | "absent" | "exempted" | "not_applicable";

export const EXPLICIT_SCORE_STATES = ["absent", "exempted", "not_applicable"] as const;
export type ExplicitScoreState = (typeof EXPLICIT_SCORE_STATES)[number];

export const SCORE_STATE_LABEL: Record<ExplicitScoreState, string> = {
  absent: "ABS",
  exempted: "EXM",
  not_applicable: "N/A",
};

export const STATE_KEY_SUFFIX = "#state";

export function scoreStateKey(key: string): string {
  return `${key}${STATE_KEY_SUFFIX}`;
}

export function isStateKey(key: string): boolean {
  return key.endsWith(STATE_KEY_SUFFIX);
}

export function explicitScoreState(data: Record<string, string>, key: string): ExplicitScoreState | null {
  const raw = data[scoreStateKey(key)];
  return (EXPLICIT_SCORE_STATES as readonly string[]).includes(raw) ? (raw as ExplicitScoreState) : null;
}

export function readScoreState(data: Record<string, string>, key: string): ScoreState {
  const explicit = explicitScoreState(data, key);
  if (explicit) return explicit;
  return (data[key] ?? "").trim() === "" ? "missing" : "scored";
}

/** Whole numbers stay as-is; anything longer is shown to two decimals (storage keeps four). */
export function formatScore(value: string | undefined): string {
  if (value === undefined || value.trim() === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}
