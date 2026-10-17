import { db } from '@/lib/db';
import { requireDm } from '@/lib/session';
import { wibDay } from '@/lib/core';
import { idsParam, jsonDownload } from '@/lib/download';
import { formatCharId } from '@/lib/ids';
import type { Character } from '@/lib/types';

export async function GET(request: Request) {
  const campaign = await requireDm();
  const ids = idsParam(request);

  let query = db().from('character').select('*').eq('campaign_id', campaign.id).order('char_no');
  if (ids) query = query.in('id', ids);
  const rows = ((await query).data ?? []) as Character[];

  const characters = rows.map((c) => ({
    id: formatCharId(c.char_no),
    name: c.name,
    class: c.class,
    level: c.level,
    code: c.access_code,
    abilities: { str: c.str, dex: c.dex, con: c.con, int: c.int_score, wis: c.wis, cha: c.cha },
    investigation: { proficient: c.invest_proficient, expertise: c.invest_expertise, bonus: c.invest_bonus },
    slot_bonus: c.slot_bonus,
  }));

  return jsonDownload(`characters-${wibDay(new Date())}.json`, { type: 'scavenge-characters', version: 1, characters });
}
