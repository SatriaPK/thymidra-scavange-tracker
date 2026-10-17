import 'server-only';

export function jsonDownload(filename: string, data: unknown): Response {
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ambil daftar id dari ?ids=a,b,c (hanya yang berbentuk uuid). Null bila parameter tidak ada. */
export function idsParam(request: Request): string[] | null {
  const raw = new URL(request.url).searchParams.get('ids');
  if (raw === null) return null;
  return raw.split(',').filter((v) => UUID.test(v));
}
