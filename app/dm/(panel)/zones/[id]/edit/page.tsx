import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireDm } from '@/lib/session';
import { loadPickerItems, loadZoneItems } from '@/lib/zone-data';
import { formatZoneId } from '@/lib/ids';
import { isUuid, one, type SearchParams } from '@/lib/format';
import { Flash } from '@/components/Flash';
import { Header } from '@/components/Header';
import { ZoneEditor } from '@/components/ZoneEditor';
import type { Zone } from '@/lib/types';

export default async function EditZonePage({
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

  return (
    <>
      <Header title="Zones" />
      <Flash error={one(sp.error)} ok={one(sp.ok)} />
      <ZoneEditor
        items={items}
        initial={{
          id: zone.id,
          idLabel: `ID: ${formatZoneId(zone.zone_no)}`,
          name: zone.name,
          dc: String(zone.dc),
          junk: zi.filter((r) => !r.is_rare).map((r) => ({ item_id: r.item_id, weight: r.weight })),
          rare: zi.filter((r) => r.is_rare).map((r) => ({ item_id: r.item_id, weight: r.weight })),
        }}
      />
    </>
  );
}
