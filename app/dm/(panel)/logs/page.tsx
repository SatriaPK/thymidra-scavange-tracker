import { db } from '@/lib/db';
import { requireDm } from '@/lib/session';
import { fmtWib } from '@/lib/format';
import { Header } from '@/components/Header';

interface LogRow {
  id: string;
  character_id: string | null;
  kind: string;
  payload: Record<string, unknown> | null;
  undone: boolean;
  created_at: string;
}

const KIND: Record<string, string> = {
  fail: 'Failed',
  low_success: 'Low Success',
  high_success: 'High Success',
  success: 'Success', // log lama sebelum ada Low/High Success
  jackpot: 'JACKPOT',
  rare: 'RARE FIND',
};

function scrapText(s: unknown): string {
  const o = (s ?? {}) as Record<string, number>;
  const parts = (['arcane', 'bio', 'ferrous', 'mech'] as const).filter((k) => o[k]).map((k) => `${o[k]} ${k[0].toUpperCase()}${k.slice(1)}`);
  return parts.join(' · ');
}

function describe(row: LogRow): string {
  const p = (row.payload ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  switch (row.kind) {
    case 'stat_edit':
      return p.first_setup ? 'Created character stats' : 'Edited character stats';
    case 'scavenge': {
      const r = p.roll ?? {};
      const found = [...(p.items ?? []).map((i: { name: string }) => i.name), p.loose_scrap ? `Loose Scrap (${scrapText(p.loose_scrap)})` : ''].filter(Boolean);
      const head = `${p.zone?.name ?? 'Zone'}: ${KIND[p.kind] ?? p.kind} (${r.total} vs DC ${r.dc}, d20 ${r.d20})`;
      return found.length ? `${head} → ${found.join(', ')}` : head;
    }
    case 'decision':
      if (p.action === 'discard') return `Discarded ${p.qty ? `${p.qty}x ` : ''}${p.name}`;
      if (p.action === 'breakdown') return `Broke down ${p.qty ? `${p.qty}x ` : ''}${p.name}${p.scrap && scrapText(p.scrap) ? ` → ${scrapText(p.scrap)}` : ''}${p.dropped_scrap ? `, discarded ${scrapText(p.dropped_scrap)}` : ''}`;
      return `Kept ${p.name}${p.scrap && scrapText(p.scrap) ? ` (${scrapText(p.scrap)})` : ''} in ${p.dest === 'storage' ? 'Storage' : 'Inventory'}${p.dropped_scrap ? `, discarded ${scrapText(p.dropped_scrap)}` : ''}`;
    case 'transfer':
      return `Moved ${p.qty ? `${p.qty}x ` : ''}${p.name}: ${p.from} → ${p.to}`;
    case 'trade': {
      const from = p.from?.name ?? '?';
      const to = p.to?.name ?? '?';
      const what = p.mode === 'swap' ? `${p.offer_text} ⇄ ${p.request_text}` : p.offer_text;
      switch (p.action) {
        case 'offered':
          return p.mode === 'swap' ? `Offered a swap to ${to}: ${what}` : `Offered ${p.offer_text} to ${to}`;
        case 'accepted':
          return p.mode === 'swap' ? `Swap accepted: ${from} ⇄ ${to} (${what})` : `Gift accepted: ${from} → ${to} (${p.offer_text})`;
        case 'declined':
          return `Declined the offer from ${from} (${what})`;
        case 'cancelled':
          return `Cancelled the offer to ${to} (${what})`;
        case 'auto_cancelled':
          return `Offer from ${from} to ${to} cancelled automatically: items changed (${what})`;
        default:
          return `Trade (${what})`;
      }
    }
    default:
      return row.kind;
  }
}

export default async function LogsPage() {
  const campaign = await requireDm();

  const [logsRes, charsRes] = await Promise.all([
    db()
      .from('log')
      .select('id, character_id, kind, payload, undone, created_at')
      .eq('campaign_id', campaign.id)
      .order('created_at', { ascending: false })
      .limit(100),
    db().from('character').select('id, name').eq('campaign_id', campaign.id),
  ]);
  const logs = (logsRes.data ?? []) as LogRow[];
  const names = new Map((charsRes.data ?? []).map((c) => [c.id as string, c.name as string]));

  return (
    <>
      <Header title="Logs" />
      <section className="sec">
        {logs.length === 0 ? (
          <p className="empty">No logs yet.</p>
        ) : (
          <div className="list">
            {logs.map((l) => (
              <div key={l.id} className="item-row" style={{ opacity: l.undone ? 0.5 : 1 }}>
                <div className="main" style={{ cursor: 'default' }}>
                  <div>
                    <span className="title">{l.character_id ? (names.get(l.character_id) ?? 'Deleted character') : 'System'}</span>
                    {l.undone && <span className="tag">[ undone ]</span>}
                  </div>
                  <div className="subline">{describe(l)}</div>
                  <div className="subline muted">{fmtWib(l.created_at)} WIB</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}