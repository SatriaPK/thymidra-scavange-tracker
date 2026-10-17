import { db } from '@/lib/db';
import { requireDm } from '@/lib/session';
import { wibDay } from '@/lib/core';
import { idsParam, jsonDownload } from '@/lib/download';
import { buildZonesExport } from '@/lib/transfer';
import type { Item, Zone, ZoneItem } from '@/lib/types';

export async function GET(request: Request) {
  const campaign = await requireDm();
  const ids = idsParam(request);

  let query = db().from('zone').select('*').eq('campaign_id', campaign.id).order('zone_no');
  if (ids) query = query.in('id', ids);
  const zones = ((await query).data ?? []) as Zone[];

  const zoneIds = zones.map((z) => z.id);
  const [itemsRes, ziRes] = await Promise.all([
    db().from('item').select('id,item_no').eq('campaign_id', campaign.id),
    zoneIds.length ? db().from('zone_item').select('*').in('zone_id', zoneIds) : Promise.resolve({ data: [] }),
  ]);
  const itemNoById = new Map(((itemsRes.data ?? []) as Pick<Item, 'id' | 'item_no'>[]).map((i) => [i.id, i.item_no]));

  const entries = ((ziRes.data ?? []) as ZoneItem[]).flatMap((r) => {
    const itemNo = itemNoById.get(r.item_id);
    return itemNo === undefined ? [] : [{ zone_id: r.zone_id, weight: r.weight, is_rare: r.is_rare, item_no: itemNo }];
  });

  return jsonDownload(`zones-${wibDay(new Date())}.json`, buildZonesExport(zones, entries));
}
