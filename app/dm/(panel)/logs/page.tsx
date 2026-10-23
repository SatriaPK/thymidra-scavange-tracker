import { db } from '@/lib/db';
import { requireDm } from '@/lib/session';
import { fmtWib, isUuid, one, type SearchParams } from '@/lib/format';
import { Header } from '@/components/Header';
import Link from 'next/link';

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

const ACTIONS: [string, string][] = [
  ['scavenge', 'Scavenge'],
  ['decision', 'Find decision'],
  ['transfer', 'Move item'],
  ['trade', 'Trade'],
  ['paper_import', 'Paper import'],
  ['stat_edit', 'Character edit'],
  ['exhaustion_clear', 'Exhaustion cleared'],
];
const OUTCOMES: [string, string][] = [
  ['exhaustion', 'Exhaustion (Nat 1)'],
  ['fail', 'Failed'],
  ['low_success', 'Low Success'],
  ['high_success', 'High Success'],
  ['jackpot', 'Jackpot'],
  ['rare', 'Rare Find'],
];
const PAGE = 100;
const MAX_LIMIT = 1000;

/** Awal hari WIB (UTC+7) untuk tanggal YYYY-MM-DD, dan awal hari berikutnya. */
function dayRange(day: string): [string, string] | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const start = new Date(`${day}T00:00:00+07:00`);
  if (Number.isNaN(start.getTime())) return null;
  return [start.toISOString(), new Date(start.getTime() + 24 * 3600 * 1000).toISOString()];
}

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
      const head = `${p.zone?.name ?? 'Zone'}: ${KIND[p.kind] ?? p.kind} (${r.total} vs DC ${r.dc}, d20 ${r.d20}${r.rerolledNat1 ? ', Nat 1 rerolled' : ''})${p.exhaustion ? ' · EXHAUSTION' : ''}`;
      return found.length ? `${head} → ${found.join(', ')}` : head;
    }
    case 'decision':
      if (p.action === 'discard') return `Discarded ${p.qty ? `${p.qty}x ` : ''}${p.name}`;
      if (p.action === 'breakdown') return `Broke down ${p.qty ? `${p.qty}x ` : ''}${p.name}${p.scrap && scrapText(p.scrap) ? ` → ${scrapText(p.scrap)}` : ''}${p.dropped_scrap ? `, discarded ${scrapText(p.dropped_scrap)}` : ''}`;
      return `Kept ${p.name}${p.scrap && scrapText(p.scrap) ? ` (${scrapText(p.scrap)})` : ''} in ${p.dest === 'storage' ? 'Storage' : 'Inventory'}${p.dropped_scrap ? `, discarded ${scrapText(p.dropped_scrap)}` : ''}`;
    case 'transfer':
      return `Moved ${p.qty ? `${p.qty}x ` : ''}${p.name}: ${p.from} → ${p.to}`;
    case 'paper_import': {
      const part = (b: { items?: { name: string; qty: number }[]; scrap?: unknown } | undefined) =>
        [...(b?.items ?? []).map((i) => `${i.qty}x ${i.name}`), b?.scrap ? `Scrap (${scrapText(b.scrap)})` : ''].filter(Boolean).join(', ');
      const inv = part(p.inventory);
      const sto = part(p.storage);
      return `Imported from paper → ${[inv && `Inventory: ${inv}`, sto && `Storage: ${sto}`].filter(Boolean).join(' | ')}`;
    }
    case 'exhaustion_clear':
      return `Cleared exhaustion ×${p.count ?? '?'} (by ${p.by === 'dm' ? 'DM' : 'player'})`;
    case 'trade':
      return 'Trade';
    default:
      return row.kind;
  }
}

export default async function LogsPage({ searchParams }: { searchParams: SearchParams }) {
  const campaign = await requireDm();
  const sp = await searchParams;

  const fChar = one(sp.character) ?? '';
  const fAction = one(sp.action) ?? '';
  const fOutcome = one(sp.outcome) ?? '';
  const fDay = one(sp.day) ?? '';
  const limit = Math.min(MAX_LIMIT, Math.max(PAGE, Number(one(sp.limit)) || PAGE));

  let query = db()
    .from('log')
    .select('id, character_id, kind, payload, undone, created_at')
    .eq('campaign_id', campaign.id);
  if (isUuid(fChar)) query = query.eq('character_id', fChar);
  if (ACTIONS.some(([k]) => k === fAction)) query = query.eq('kind', fAction);
  // Filter hasil hanya berarti untuk scavenge.
  if (OUTCOMES.some(([k]) => k === fOutcome)) {
    query = query.eq('kind', 'scavenge');
    query = fOutcome === 'exhaustion' ? query.eq('payload->>exhaustion', 'true') : query.eq('payload->>kind', fOutcome);
  }
  const range = dayRange(fDay);
  if (range) query = query.gte('created_at', range[0]).lt('created_at', range[1]);

  const [logsRes, charsRes] = await Promise.all([
    query.order('created_at', { ascending: false }).limit(limit + 1),
    db().from('character').select('id, name').eq('campaign_id', campaign.id).order('name'),
  ]);
  const all = (logsRes.data ?? []) as LogRow[];
  const hasMore = all.length > limit;
  const logs = all.slice(0, limit);
  const chars = (charsRes.data ?? []) as { id: string; name: string }[];
  const names = new Map(chars.map((c) => [c.id, c.name]));
  const activeCount = [isUuid(fChar), !!fAction, !!fOutcome, !!range].filter(Boolean).length;
  const filtered = activeCount > 0;

  const more = new URLSearchParams();
  for (const [k, v] of Object.entries({ character: fChar, action: fAction, outcome: fOutcome, day: fDay })) if (v) more.set(k, v);
  more.set('limit', String(Math.min(MAX_LIMIT, limit + PAGE)));

  return (
    <>
      <Header title="Logs" />
      <section className="sec">
        <details className="log-filter-box" open={filtered}>
          <summary>
            <span>Filter</span>
            {activeCount > 0 && <span className="count">{activeCount} active</span>}
          </summary>
          <form className="log-filter" method="get">
            <label className="field">
              <span>Character</span>
              <select name="character" defaultValue={isUuid(fChar) ? fChar : ''}>
                <option value="">All characters</option>
                {chars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Action</span>
              <select name="action" defaultValue={fAction}>
                <option value="">All actions</option>
                {ACTIONS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Scavenge result</span>
              <select name="outcome" defaultValue={fOutcome}>
                <option value="">Any result</option>
                {OUTCOMES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Date (WIB)</span>
              <input type="date" name="day" defaultValue={range ? fDay : ''} />
            </label>
            <div className="btns-row">
              <button type="submit" className="btn">Apply filter</button>
              {filtered && <Link href="/dm/logs" className="btn btn-ghost">Reset</Link>}
            </div>
          </form>
        </details>
      </section>

      <section className="sec">
        <div className="sec-head">
          <h2>{filtered ? 'Filtered logs' : 'Logs'}</h2>
          <span className="count">{logs.length}{hasMore ? '+' : ''} entries</span>
        </div>
        {logs.length === 0 ? (
          <p className="empty">{filtered ? 'No logs match this filter.' : 'No logs yet.'}</p>
        ) : (
          <div className="list">
            {logs.map((l) => {
              const p = (l.payload ?? {}) as Record<string, unknown>;
              const danger = l.kind === 'scavenge' && !!p.exhaustion;
              return (
                <div key={l.id} className="item-row" style={{ opacity: l.undone ? 0.5 : 1 }}>
                  <div className="main" style={{ cursor: 'default' }}>
                    <div>
                      <span className="title">{l.character_id ? (names.get(l.character_id) ?? 'Deleted character') : 'System'}</span>
                      {l.undone && <span className="tag">[ undone ]</span>}
                    </div>
                    <div className={danger ? 'subline tag-red' : 'subline'}>{describe(l)}</div>
                    <div className="subline muted">{fmtWib(l.created_at)} WIB</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {hasMore && (
          <div className="log-more">
            <Link href={`/dm/logs?${more.toString()}`} className="btn btn-ghost" style={{ width: 'auto' }}>Show more</Link>
          </div>
        )}
      </section>
    </>
  );
}
