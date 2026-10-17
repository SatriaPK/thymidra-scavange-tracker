import { db } from '@/lib/db';
import { requireDm } from '@/lib/session';
import { loadPickerItems } from '@/lib/zone-data';
import { formatZoneId } from '@/lib/ids';
import { one, type SearchParams } from '@/lib/format';
import { Flash } from '@/components/Flash';
import { Header } from '@/components/Header';
import { ZoneEditor } from '@/components/ZoneEditor';

export default async function NewZonePage({ searchParams }: { searchParams: SearchParams }) {
  const campaign = await requireDm();
  const sp = await searchParams;

  const [items, last] = await Promise.all([
    loadPickerItems(campaign.id),
    db().from('zone').select('zone_no').eq('campaign_id', campaign.id).order('zone_no', { ascending: false }).limit(1),
  ]);
  const next = ((last.data?.[0]?.zone_no as number | undefined) ?? 0) + 1;

  return (
    <>
      <Header title="Zones" />
      <Flash error={one(sp.error)} ok={one(sp.ok)} />
      <ZoneEditor
        items={items}
        initial={{ idLabel: `ID: ${formatZoneId(next)}`, name: '', dc: '', junk: [], rare: [] }}
      />
    </>
  );
}
