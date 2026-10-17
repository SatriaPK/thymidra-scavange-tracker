import 'server-only';
import { redirect } from 'next/navigation';
import type { ZodError } from 'zod';

/** Redirect ke path internal dengan pesan di query (dibaca halaman lewat searchParams). */
export function go(path: string, kind: 'error' | 'ok', message: string): never {
  const sep = path.includes('?') ? '&' : '?';
  redirect(`${path}${sep}${kind}=${encodeURIComponent(message)}`);
}

export function firstIssue(err: ZodError): string {
  const issue = err.issues[0];
  const field = issue.path.join('.');
  return field ? `${field}: ${issue.message}` : issue.message;
}
