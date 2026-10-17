import Link from 'next/link';
import { db } from '@/lib/db';
import { requireDm } from '@/lib/session';
import { deleteZones, importZones } from '@/lib/actions/dm';
import { formatZoneId } from '@/lib/ids';
import { one, type SearchParams } from '@/lib/format';
import { Flash } from '@/components/Flash';
import { Header } from '@/components/Header';
import { DownloadIcon, PlusIcon } from '@/components/Icons';
import { ImportButton } from '@/components/ImportButton';
import { SelectableList, type ListRow } from '@/components/SelectableList';
import type { Zone } from '@/lib/types';

export default async function ZonesPage({ searchParams }: { searchParams: SearchParams }) {
  const campaign = await requireDm();
  const sp = await searchParams;

  const { data } = await db().from('zone').select('*').eq('campaign_id', campaign.id).order('zone_no');
  const zones = (data ?? []) as Zone[];

  const counts = new Map<string, { junk: number; rare: number }>();
  if (zones.length) {
    const { data: zi } = await db().from('zone_item').select('zone_id, is_rare').in('zone_id', zones.map((z) => z.id));
    for (const r of zi ?? []) {
      const c = counts.get(r.zone_id as string) ?? { junk: 0, rare: 0 };
      if (r.is_rare) c.rare++;
      else c.junk++;
      counts.set(r.zone_id as string, c);
    }
  }

  const rows: ListRow[] = zones.map((z) => {
    const c = counts.get(z.id) ?? { junk: 0, rare: 0 };
    return {
      id: z.id,
      title: z.name,
      tag: String(z.dc),
      sub: `${c.junk} Junk Item · ${c.rare} Rare Item`,
      idLabel: `ID: ${formatZoneId(z.zone_no)}`,
      editHref: `/dm/zones/${z.id}/edit`,
      viewHref: `/dm/zones/${z.id}`,
      details: [
        ['DC (Difficulty)', String(z.dc)],
        ['Junk Item', String(c.junk)],
        ['Rare Item', String(c.rare)],
        ['Status', z.id === campaign.active_zone_id ? (campaign.zone_enabled ? 'Active' : 'Active (disabled)') : '-'],
      ],
    };
  });

  return (
    <>
      <Header title="Zones" />
      <Flash error={one(sp.error)} ok={one(sp.ok)} />
      <section className="sec">
        <div className="sec-head">
          <h2>Zone Database</h2>
          <span className="count">{zones.length} Zone</span>
        </div>
        <div className="toolbar">
          <Link className="btn" href="/dm/zones/new"><PlusIcon /> New Zone</Link>
          <ImportButton action={importZones} label="Import zones (JSON)" />
          <a className="icon-btn" href="/dm/zones/export" aria-label="Export all zones" title="Export all zones">
            <DownloadIcon />
          </a>
        </div>
        <SelectableList
          rows={rows}
          entity="Zone"
          searchPlaceholder="Search zone..."
          deleteAction={deleteZones}
          exportHref="/dm/zones/export"
          emptyText="No zones yet. Create one or import a JSON file."
        />
      </section>
    </>
  );
}
