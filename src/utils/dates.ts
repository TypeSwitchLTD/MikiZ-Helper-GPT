export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getTodayISO(): string {
  return toISODate(new Date());
}

export function getTomorrowISO(fromDate = new Date()): string {
  const tomorrow = new Date(fromDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toISODate(tomorrow);
}

export function nowISO(): string {
  return new Date().toISOString();
}

/** Local-time ISO without timezone suffix — matches how remindAt is stored ("YYYY-MM-DDTHH:MM:SS") */
export function localISOSeconds(offsetMs = 0): string {
  const d = new Date(Date.now() + offsetMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function formatHebrewDate(dateISO: string): string {
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${dateISO}T12:00:00`));
}
