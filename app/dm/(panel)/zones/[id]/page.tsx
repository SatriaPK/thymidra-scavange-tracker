import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireDm } from '@/lib/session';
import { setActiveZone } from '@/lib/actions/dm';
import { loadPickerItems, loadZoneItems } from '@/lib/zone-data';
import { dropChances } from '@/lib/core';
import { formatItemId, formatZoneId } from '@/lib/ids';
import { isUuid, one, type SearchParams } from '@/lib/format';
import { Flash } from '@/components/Flash';
import { Header, SubHeader } from '@/components/Header';
import { PoolTable, type PoolRow } from '@/components/PoolTable';
import type { Zone, ZoneItem } from '@/lib/types';

export default async function ZoneViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const campaign = await requireDm();
  const { id } = await params;
  const sp = await searchParams;
  if (!isUuid(id)) notFound();

  const { data } = await db().from('zone').select('*').eq('id', id).eq('campaign_id', campaign.id).maybeSingle();
  if (!data) notFound();
  const zone = data as Zone;

  const [items, zi] = await Promise.all([loadPickerItems(campaign.id), loadZoneItems(zone.id)]);
  const byId = new Map(items.map((i) => [i.id, i]));

  const rowsOf = (entries: ZoneItem[]): PoolRow[] => {
    const list = entries
      .filter((e) => byId.has(e.item_id))
      .sort((a, b) => byId.get(a.item_id)!.no - byId.get(b.item_id)!.no);
    const chances = new Map(dropChances(list.map((e) => ({ itemId: e.item_id, weight: e.weight }))).map((c) => [c.itemId, c.percent]));
    return list.map((e) => {
      const it = byId.get(e.item_id)!;
      return {
        id: e.item_id,
        no: formatItemId(it.no),
        name: it.name,
        slot: it.slot > 0 ? String(it.slot) : '-',
        weight: e.weight,
        chance: chances.get(e.item_id) ?? 0,
      };
    });
  };
  const junk = rowsOf(zi.filter((r) => !r.is_rare));
  const rare = rowsOf(zi.filter((r) => r.is_rare));
  const isActive = campaign.active_zone_id === zone.id;

  return (
    <>
      <Header title="Zones" />
      <SubHeader back="/dm/zones" title={zone.name} right={`ID: ${formatZoneId(zone.zone_no)}`} />
      <Flash error={one(sp.error)} ok={one(sp.ok)} />

      <div className="kv rule" style={{ borderBottom: '1px solid var(--ink)' }}>
        <span className="k">DC (Difficulty)</span>
        <span className="v">{zone.dc}</span>
      </div>

      <section className="sec">
        <div className="sec-head"><h2>Junk Item <span className="count">({junk.length} Item)</span></h2></div>
        <PoolTable rows={junk} emptyText="No items." />
      </section>

      <section className="sec">
        <div className="sec-head"><h2>Rare Item <span className="count">({rare.length} Item)</span></h2></div>
        <PoolTable rows={rare} emptyText="No items." />
      </section>

      <div className="sec actions">
        <Link href={`/dm/zones/${zone.id}/edit`} className="btn btn-ghost">Edit</Link>
        {isActive ? (
          <span className="btn btn-ghost" style={{ cursor: 'default', opacity: 0.6 }}>Active zone</span>
        ) : (
          <form action={setActiveZone} style={{ flex: 1 }}>
            <input type="hidden" name="zone_id" value={zone.id} />
            <button type="submit" className="btn">Set as Active</button>
          </form>
        )}
      </div>
    </>
  );
}
