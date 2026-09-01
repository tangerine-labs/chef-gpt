export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

/** ISO date (YYYY-MM-DD) of the Monday starting the week that contains `date`. */
export function weekStart(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const day = utc.getUTCDay(); // 0 = Sunday
  const back = day === 0 ? 6 : day - 1;
  utc.setUTCDate(utc.getUTCDate() - back);
  return utc.toISOString().slice(0, 10);
}

/** The seven ISO dates of the week starting at `monday`. */
export function weekDates(monday: string): string[] {
  const [y, m, d] = monday.split("-").map(Number);
  return Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10));
}
