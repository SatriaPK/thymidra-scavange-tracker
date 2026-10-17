import { db } from '@/lib/db';
import { requireDm } from '@/lib/session';
import { wibDay } from '@/lib/core';
import { idsParam, jsonDownload } from '@/lib/download';
import { buildItemsExport } from '@/lib/transfer';
import type { Item } from '@/lib/types';

export async function GET(request: Request) {
  const campaign = await requireDm();
  const ids = idsParam(request);

  let query = db().from('item').select('*').eq('campaign_id', campaign.id).order('item_no');
  if (ids) query = query.in('id', ids);
  const { data } = await query;

  return jsonDownload(`items-${wibDay(new Date())}.json`, buildItemsExport((data ?? []) as Item[]));
}
