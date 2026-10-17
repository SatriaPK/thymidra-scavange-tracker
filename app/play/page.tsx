import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requirePlayer } from '@/lib/session';
import { MAX_SCAVENGES_PER_DAY, abilityMod, canBreakdown, freeQuarters, investigationModifier, itemQuarters, proficiencyBonus, quartersToSlots, remainingScavenges, scrapQuarters, wibDay, type OutcomeKind, type RollMode } from '@/lib/core';
import { one, sign, yieldText, type SearchParams } from '@/lib/format';
import { loadInventory, toItemDef } from '@/lib/inventory';
import { decideFind, scavenge } from '@/lib/actions/scavenge';
import { Flash } from '@/components/Flash';
import { PlayShell } from '@/components/PlayShell';
import { AutoRefresh } from '@/components/AutoRefresh';
import { RollControls, RollButton } from '@/components/RollButton';
import { FindActions } from '@/components/FindActions';
import type { Campaign, Item, Zone } from '@/lib/types';

interface Pending { id: string; item_id: string | null; scrap: { bio: number; arcane: number; mech: number; ferrous: number } | null }

interface LastScavenge {
  roll: { d20Rolls: number[]; d20: number; guidanceRoll: number; modifier: number; total: number; dc: number; nat1: boolean; nat20: boolean; success: boolean; mode: RollMode };
  kind: OutcomeKind;
  items: { name: string }[];
  loose_scrap: { bio: number; arcane: number; mech: number; ferrous: number } | null;
  exhaustion: boolean;
  zone: { name: string };
  day: string;
}

const scrapLine = (s: { bio: number; arcane: number; mech: number; ferrous: number }) =>
  yieldText({ yield_bio: s.bio, yield_arcane: s.arcane, yield_mech: s.mech, yield_ferrous: s.ferrous });

export default async function PlayPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requirePlayer();
  if (!me.setup_done) redirect('/play/setup');
  const sp = await searchParams;
  const today = wibDay(new Date());

  const [campRes, dayRes, pendRes, logRes, inv] = await Promise.all([
    db().from('campaign').select('*').eq('id', me.campaign_id).maybeSingle(),
    db().from('scavenge_day').select('used').eq('character_id', me.id).eq('day', today).maybeSingle(),
    db().from('pending_find').select('*').eq('character_id', me.id).order('created_at'),
    db().from('log').select('payload, created_at').eq('character_id', me.id).eq('kind', 'scavenge').order('created_at', { ascending: false }).limit(1),
    loadInventory(me),
  ]);
  const campaign = campRes.data as Campaign | null;
  const used = (dayRes.data as { used: number } | null)?.used ?? 0;
  const left = remainingScavenges(used);
  const pending = (pendRes.data ?? []) as Pending[];
  const lastRow = logRes.data?.[0] as { payload: LastScavenge; created_at: string } | undefined;
  const lastRaw = lastRow?.payload;
  // Roll yang baru terjadi (beberapa detik lalu) diputar dengan animasi dadu.
  const fresh = !!lastRow && Date.now() - new Date(lastRow.created_at).getTime() < 15_000;
  const last = lastRaw && lastRaw.day === today ? lastRaw : null;

  let zone: Zone | null = null;
  if (campaign?.active_zone_id) {
    const { data } = await db().from('zone').select('*').eq('id', campaign.active_zone_id).maybeSingle();
    zone = data as Zone | null;
  }

  const ids = pending.map((p) => p.item_id).filter((v): v is string => !!v);
  const { data: itemRows } = ids.length ? await db().from('item').select('*').in('id', ids) : { data: [] };
  const items = new Map(((itemRows ?? []) as Item[]).map((i) => [i.id, i]));

  const invest = investigationModifier({
    level: me.level,
    intScore: me.int_score,
    proficient: me.invest_proficient,
    expertise: me.invest_expertise,
    bonus: me.invest_bonus,
  });

  const over = inv.usedQ > inv.capacity * 4;
  const canRoll = !!zone && !!campaign?.zone_enabled && left > 0 && pending.length === 0;
  const blocked = !zone
    ? 'No zone set by the DM'
    : !campaign?.zone_enabled
      ? 'Scavenging is disabled'
      : pending.length > 0
        ? 'Decide on your finds first'
        : left === 0
          ? 'No scavenges left today (resets 00:00 WIB)'
          : null;

  return (
    <PlayShell title={me.name} active="/play">
      <AutoRefresh />
      <Flash error={one(sp.error)} ok={one(sp.ok)} />

      <main className="player-dashboard-grid">
        <section className="sec">
          <div className="stats">
            <div><span className="k">INT</span><span className="v">{sign(abilityMod(me.int_score))}</span><span className="s">score {me.int_score}</span></div>
            <div><span className="k">Proficiency</span><span className="v">{sign(proficiencyBonus(me.level))}</span><span className="s">level {me.level}</span></div>
            <div><span className="k">Investigation</span><span className="v">{sign(invest)}</span><span className="s">roll bonus</span></div>
          </div>
          <Link href="/play/inventory" className="slotbar">
            <div className="sec-head" style={{ marginBottom: 8 }}>
              <h2>Inventory</h2>
              <span className="count" data-over={over}>{quartersToSlots(inv.usedQ)} / {inv.capacity} slots</span>
            </div>
            <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={inv.capacity} aria-valuenow={quartersToSlots(inv.usedQ)}>
              <div style={{ width: `${Math.min(100, (inv.usedQ / (inv.capacity * 4)) * 100)}%` }} data-over={over} />
            </div>
          </Link>
        </section>

        <section className="sec">
          <div className="sec-head"><h2>Scavenge</h2><span className="count">Sisa Scavenge: {left}/{MAX_SCAVENGES_PER_DAY}</span></div>
          {zone && campaign?.zone_enabled ? (
            <div className="zone-card">
              <div>
                <div className="name">{zone.name}</div>
              </div>
            </div>
          ) : (
            <div className="zone-off">{blocked}</div>
          )}

          {zone && campaign?.zone_enabled && (
            <form action={scavenge} className="stack scavenge-form">
              <RollControls result={last?.roll ? { ...last.roll, kind: last.kind } : null} />
              <RollButton disabled={!canRoll} label={canRoll ? 'Roll Scavenge' : (blocked ?? 'Roll Scavenge')} />
            </form>
          )}
          {me.pending_exhaustion > 0 && (
            <p className="hint" style={{ marginTop: 10 }}>Exhaustion pending: {me.pending_exhaustion} (from a Nat 1). Tell your DM.</p>
          )}
        </section>
      </main>

      {pending.length > 0 && (
        <section className={fresh ? 'sec delay-in' : 'sec'}>
          <div className="sec-head"><h2>Your Finds</h2><span className="count">{pending.length} to decide</span></div>
          <div className="list">
            {pending.map((p) => {
              const item = p.item_id ? items.get(p.item_id) : null;
              const def = item ? toItemDef(item) : null;
              const keepQ = def ? itemQuarters(def) : p.scrap ? scrapQuarters(p.scrap) : 0;
              const breakQ = def && canBreakdown(def) ? scrapQuarters(def.yield) : 0;
              const name = item?.name ?? 'Loose Scrap';
              return (
                <div key={p.id} className="find">
                  <div className="top">
                    <span className="title">{name}</span>
                    {item && <span className="tag">[ {item.is_wondrous ? 'Wondrous' : quartersToSlots(keepQ)} ]</span>}
                  </div>
                  <div className="subline">
                    {item ? (def && canBreakdown(def) ? `Breaks into: ${yieldText(item)}` : 'Wondrous: no slot, cannot be broken down') : scrapLine(p.scrap!)}
                  </div>
                  {item?.description && <div className="hint">{item.description}</div>}
                  <FindActions
                    key={`${p.id}-${one(sp.error) ?? ''}`}
                    findId={p.id}
                    name={name}
                    isScrap={!item}
                    keepQ={keepQ}
                    canBreakdown={!!def && canBreakdown(def)}
                    breakQ={breakQ}
                    freeQ={freeQuarters(inv.capacity, inv.usedQ)}
                    scrap={p.scrap}
                    yieldScrap={def && canBreakdown(def) ? def.yield : null}
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}
    </PlayShell>
  );
}