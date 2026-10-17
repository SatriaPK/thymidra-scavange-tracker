import 'server-only';
import { db } from './db';
import { itemHasYield } from './item';
import { yieldNonZero } from './format';
import type { PickerItem } from '@/components/ZoneEditor';
import type { Item, ZoneItem } from './types';

/** Semua item campaign dalam bentuk ringan untuk editor zona. */
export async function loadPickerItems(campaignId: string): Promise<PickerItem[]> {
  const { data } = await db().from('item').select('*').eq('campaign_id', campaignId).order('item_no');
  return ((data ?? []) as Item[]).map((i) => ({
    id: i.id,
    no: i.item_no,
    name: i.name,
    slot: itemHasYield(i) ? i.slot_weight : 0,
    wondrous: i.is_wondrous,
    yieldText: yieldNonZero(i),
  }));
}

export async function loadZoneItems(zoneId: string): Promise<ZoneItem[]> {
  const { data } = await db().from('zone_item').select('*').eq('zone_id', zoneId);
  return (data ?? []) as ZoneItem[];
}
