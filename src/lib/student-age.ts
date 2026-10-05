// Age in whole years as of `at` (defaults to now) — not stored, always
// derived from date of birth so it never goes stale on a printed result.
export function computeAge(dateOfBirth: Date | null | undefined, at: Date = new Date()): number | null {
  if (!dateOfBirth) return null;
  let age = at.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = at.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && at.getDate() < dateOfBirth.getDate())) age--;
  return age;
}
