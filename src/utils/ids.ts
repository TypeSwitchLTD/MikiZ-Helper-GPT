export function createId(prefix: string): string {
  const randomPart = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}_${randomPart}`;
}
