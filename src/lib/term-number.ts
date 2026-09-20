// Terms are 1, 2 or 3, written the way schools here write them: "1st Term",
// "2nd Term", "3rd Term". Pure — safe for client and server.

export type TermNumber = 1 | 2 | 3;

export const TERM_NUMBERS: TermNumber[] = [1, 2, 3];

const LABELS: Record<TermNumber, string> = { 1: "1st Term", 2: "2nd Term", 3: "3rd Term" };

export function termLabel(n: TermNumber): string {
  return LABELS[n];
}

export function isTermNumber(n: unknown): n is TermNumber {
  return n === 1 || n === 2 || n === 3;
}

const WORDS: Record<string, TermNumber> = { first: 1, second: 2, third: 3, "1st": 1, "2nd": 2, "3rd": 3 };

/**
 * Reads the term number out of a label written any of the ways schools have
 * written it: "1st Term", "First Term", "Term 2, 2025/2026", "term3".
 * Returns null when it can't tell — never guesses.
 */
export function termNumberFromLabel(label: string | null | undefined): TermNumber | null {
  if (!label) return null;
  const text = label.toLowerCase();

  const word = text.match(/\b(first|second|third|1st|2nd|3rd)\b/);
  if (word) return WORDS[word[1]];

  const numbered = text.match(/\bterm\s*([123])\b/);
  return numbered ? (Number(numbered[1]) as TermNumber) : null;
}
