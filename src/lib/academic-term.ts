// Pure date math, safe to import from client components — no DB/env access.

/** Nigerian school year runs roughly Aug-Jul across three terms. */
function currentTermNumber(date: Date): 1 | 2 | 3 {
  const month = date.getMonth(); // 0-11
  if (month >= 7) return 1; // Aug-Dec
  if (month <= 3) return 2; // Jan-Apr
  return 3; // May-Jul
}

export function defaultSessionLabel(date: Date = new Date()): string {
  const startYear = date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1;
  return `${startYear}/${startYear + 1}`;
}

export function defaultTermLabel(date: Date = new Date()): string {
  return `Term ${currentTermNumber(date)}, ${defaultSessionLabel(date)}`;
}
