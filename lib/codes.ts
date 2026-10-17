import 'server-only';
import { randomInt } from 'node:crypto';

// Tanpa 0/O, 1/I/L supaya mudah dibaca dan diketik dari HP.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateAccessCode(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}
