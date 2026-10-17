export const sign = (n: number): string => (n >= 0 ? `+${n}` : `${n}`);

export const one = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

type Yields = { yield_bio: number; yield_arcane: number; yield_mech: number; yield_ferrous: number };

/** "2 Arcane · 1 Ferrous". Jenis dengan nilai 0 tidak ditampilkan. */
export function yieldText(i: Yields): string {
  const parts: string[] = [];
  if (i.yield_arcane) parts.push(`${i.yield_arcane} Arcane`);
  if (i.yield_bio) parts.push(`${i.yield_bio} Bio`);
  if (i.yield_ferrous) parts.push(`${i.yield_ferrous} Ferrous`);
  if (i.yield_mech) parts.push(`${i.yield_mech} Mech`);
  return parts.length ? parts.join(' · ') : '-';
}

export const isUuid = (v: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** Waktu dalam WIB, mis. "16 Okt 2026, 13.45". */
export function fmtWib(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export const yieldNonZero = yieldText;
export const yieldAll = yieldText;
