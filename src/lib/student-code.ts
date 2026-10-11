// Automatic student codes. A school can switch them on and choose the shape:
// prefix, year, separator and how many digits, for example GDA-2026-0001.
// Pure: no database or clock access (the clock is passed in), so every rule is
// unit-tested. The database side, which reserves numbers safely when several
// people add students at once, is in student-code-db.ts.

export type CodeYear = "NONE" | "YY" | "YYYY";
export type CodeSeparator = "-" | "/" | "";

export type StudentCodeFormat = { prefix: string; year: CodeYear; separator: CodeSeparator; digits: number };
export type StudentCodeSettings = StudentCodeFormat & { auto: boolean; next: number };

export const PREFIX_MAX = 8;
export const DIGITS_MIN = 3;
export const DIGITS_MAX = 6;
export const NEXT_MAX = 99_999_999;
export const YEAR_CHOICES: { value: CodeYear; label: string }[] = [
  { value: "YYYY", label: "Four digits (2026)" },
  { value: "YY", label: "Two digits (26)" },
  { value: "NONE", label: "No year" },
];
export const SEPARATOR_CHOICES: { value: CodeSeparator; label: string }[] = [
  { value: "-", label: "Dash ( - )" },
  { value: "/", label: "Slash ( / )" },
  { value: "", label: "None" },
];

const SMALL_WORDS = new Set(["of", "the", "and", "for", "a", "an", "in", "at"]);

/** Letters and digits only, capitalised, at most 8 long. */
export const cleanPrefix = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, PREFIX_MAX);

/** The school's initials: "Greenfield Demo Academy" gives GDA; a one-word name gives its first three letters. */
export function defaultPrefix(schoolName: string): string {
  const words = schoolName
    .replace(/['’]/g, "") // King's, not King s
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !SMALL_WORDS.has(w.toLowerCase()));
  const initials = words.length > 1 ? words.map((w) => w[0]).join("") : (words[0] ?? "").slice(0, 3);
  return cleanPrefix(initials) || "STU";
}

export const DEFAULT_FORMAT = (schoolName: string): StudentCodeFormat => ({ prefix: defaultPrefix(schoolName), year: "YYYY", separator: "-", digits: 4 });

export type SettingsInput = { auto: boolean; prefix: string; year: string; separator: string; digits: number; next: number };

export function validateSettings(input: SettingsInput): { ok: true; value: StudentCodeSettings } | { ok: false; error: string } {
  const prefix = cleanPrefix(String(input.prefix ?? ""));
  if (String(input.prefix ?? "").trim() !== "" && prefix === "") return { ok: false, error: "The prefix can only use letters and digits." };
  if (!["NONE", "YY", "YYYY"].includes(input.year)) return { ok: false, error: "Choose how the year is shown." };
  if (!["-", "/", ""].includes(input.separator)) return { ok: false, error: "Choose a dash, a slash or none as the separator." };
  const digits = Number(input.digits);
  if (!Number.isInteger(digits) || digits < DIGITS_MIN || digits > DIGITS_MAX) return { ok: false, error: `The number length must be from ${DIGITS_MIN} to ${DIGITS_MAX} digits.` };
  const next = Number(input.next);
  if (!Number.isInteger(next) || next < 1 || next > NEXT_MAX) return { ok: false, error: "The next number must be a whole number from 1 upwards." };
  if (input.auto && prefix === "" && input.year === "NONE") return { ok: false, error: "Give the code a prefix or a year, so it isn't only a number." };
  return { ok: true, value: { auto: !!input.auto, prefix, year: input.year as CodeYear, separator: input.separator as CodeSeparator, digits, next } };
}

function yearPart(year: CodeYear, now: Date): string {
  if (year === "NONE") return "";
  const full = String(now.getUTCFullYear());
  return year === "YY" ? full.slice(-2) : full;
}

/** Everything before the running number, e.g. "GDA-2026-". Used to find the codes that could clash. */
export function codeHead(format: StudentCodeFormat, now: Date): string {
  const parts = [format.prefix, yearPart(format.year, now)].filter(Boolean);
  return parts.length ? parts.join(format.separator) + format.separator : "";
}

export function formatCode(format: StudentCodeFormat, n: number, now: Date): string {
  return codeHead(format, now) + String(n).padStart(format.digits, "0");
}

/**
 * The next `count` codes from number `start`, skipping any code already taken
 * (a typed code can look exactly like a generated one). `taken` is compared
 * ignoring case. Returns the codes and the number to continue from next time.
 */
export function allocateCodes(count: number, settings: StudentCodeSettings, taken: Set<string>, now: Date): { codes: string[]; next: number } {
  const used = new Set(taken);
  const codes: string[] = [];
  let n = settings.next;
  let guard = 0;
  while (codes.length < count) {
    if (++guard > count + 200_000) throw new Error("Could not find free student codes.");
    const code = formatCode(settings, n, now);
    n++;
    if (used.has(code.toLowerCase())) continue;
    used.add(code.toLowerCase());
    codes.push(code);
  }
  return { codes, next: n };
}

/** What the next code will look like, for the settings screen. */
export const exampleCode = (settings: StudentCodeSettings, now: Date) => formatCode(settings, settings.next, now);
