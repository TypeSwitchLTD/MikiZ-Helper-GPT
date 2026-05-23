export function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/["'׳״`]/g, '')
    .replace(/[—–\-_/|:()\[\],.!?;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isSameDatePrefix(
  value: string | null | undefined,
  dateISO: string,
): boolean {
  return Boolean(value && value.slice(0, 10) === dateISO);
}

export function addDaysToISO(dateISO: string, days: number): string {
  const date = new Date(`${dateISO}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
