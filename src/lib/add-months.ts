/**
 * `date` plus a whole number of months, keeping the day of the month where
 * there is one and otherwise clamping to the month's last day — so 31 Oct + 4
 * months is 28 Feb, not 3 Mar (`setMonth` overflows into the next month).
 * Works in UTC so the result doesn't depend on the server's time zone.
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export const DAY_MS = 24 * 60 * 60 * 1000;
export const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);
