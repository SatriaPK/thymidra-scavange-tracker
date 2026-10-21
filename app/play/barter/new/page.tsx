import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requirePlayer } from '@/lib/session';
import { loadInventory, type Inventory } from '@/lib/inventory';
import { itemQuarters, quartersToSlots } from '@/lib/core';
import { one, type SearchParams } from '@/lib/format';
import { Flash } from '@/components/Flash';
import { PlayShell } from '@/components/PlayShell';
import { TradeForm, type TradeItemOption } from '@/components/TradeForm';
import type { Character } from '@/lib/types';

const options = (inv: Inventory): TradeItemOption[] =>
  inv.inventory.items.map((h) => ({
    id: h.item.id,
    name: h.item.name,
    qty: h.quantity,
    slots: h.item.is_wondrous ? 'Wondrous' : String(quartersToSlots(itemQuarters(h.def))),
  }));

const free = (inv: Inventory) => String(Math.max(0, quartersToSlots(inv.capacity * 4 - inv.usedQ)));

export default async function NewTradePage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requirePlayer();
  if (!me.setup_done) redirect('/play/setup');
  const sp = await searchParams;
  const toId = one(sp.to);

  const { data } = await db()
    .from('character')
    .select('id, name')
    .eq('campaign_id', me.campaign_id)
    .eq('setup_done', true)
    .neq('id', me.id)
    .order('name');
  const others = (data ?? []) as Pick<Character, 'id' | 'name'>[];
  const target = others.find((c) => c.id === toId) ?? null;

  const [mine, theirs] = target
    ? await Promise.all([loadInventory(me), loadInventory((await db().from('character').select('*').eq('id', target.id).single()).data as Character)])
    : [null, null];

  return (
    <PlayShell title={me.name} active="/play/barter">
      <Flash error={one(sp.error)} ok={one(sp.ok)} />
      <section className="sec">
        <div className="sec-head">
          <h2>{target ? `Trade with ${target.name}` : 'New trade'}</h2>
          <Link href="/play/barter" className="count">Back</Link>
        </div>

        {!target ? (
          others.length === 0 ? (
            <p className="empty">No other characters to trade with yet.</p>
          ) : (
            <>
              <p className="hint">Who do you want to trade with?</p>
              <div className="list">
                {others.map((c) => (
                  <Link key={c.id} href={`/play/barter/new?to=${c.id}`} className="item-row">
                    <span className="main"><span className="title">{c.name}</span></span>
                  </Link>
                ))}
              </div>
            </>
          )
        ) : (
          mine && theirs && (
            <TradeForm
              key={target.id}
              toId={target.id}
              toName={target.name}
              mine={{ items: options(mine), scrap: mine.inventory.scrap, freeSlots: free(mine) }}
              theirs={{ items: options(theirs), scrap: theirs.inventory.scrap, freeSlots: free(theirs) }}
            />
          )
        )}
      </section>
    </PlayShell>
  );
}
