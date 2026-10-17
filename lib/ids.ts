// ID tampilan untuk DM. Di database disimpan sebagai nomor (item_no, zone_no, char_no).
//   Item      001, 002, ...                  (minimal 3 digit)
//   Zona      AAA, AAB, ..., AAZ, ABA, ...   (huruf basis 26, minimal 3 huruf; nomor 1 = AAA)
//   Karakter  C1, C2, ...

const MAX_NO = 2_000_000_000;

export const formatItemId = (no: number): string => String(no).padStart(3, '0');

export function formatZoneId(no: number): string {
  let n = Math.max(no - 1, 0);
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26);
  } while (n > 0);
  return out.padStart(3, 'A');
}

export const formatCharId = (no: number): string => `C${no}`;

/** 1, "1", "001" -> 1. Selain bilangan bulat >= 1 menghasilkan null. */
export function parseItemId(v: string | number): number | null {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 1 && v <= MAX_NO ? v : null;
  const s = v.trim();
  if (!/^\d{1,10}$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= MAX_NO ? n : null;
}

/** "AAA" -> 1, "AAB" -> 2 (huruf besar/kecil sama saja). Angka atau kurang dari 3 huruf -> null. */
export function parseZoneId(v: string | number): number | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toUpperCase();
  if (!/^[A-Z]{3,6}$/.test(s)) return null;
  let n = 0;
  for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 65);
  return n + 1 <= MAX_NO ? n + 1 : null;
}
