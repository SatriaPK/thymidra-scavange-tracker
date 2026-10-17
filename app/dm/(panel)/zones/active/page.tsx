import { db } from '@/lib/db';
import { requireDm } from '@/lib/session';
import { setActiveZone } from '@/lib/actions/dm';
import { formatZoneId } from '@/lib/ids';
import { one, type SearchParams } from '@/lib/format';
import { Flash } from '@/components/Flash';
import { Header, SubHeader } from '@/components/Header';
import type { Zone } from '@/lib/types';

export default async function ChangeZonePage({ searchParams }: { searchParams: SearchParams }) {
  const campaign = await requireDm();
  const sp = await searchParams;
  const { data } = await db().from('zone').select('*').eq('campaign_id', campaign.id).order('zone_no');
  const zones = (data ?? []) as Zone[];

  return (
    <>
      <Header title="Zones" />
      <SubHeader back="/dm" title="Change Zone" />
      <Flash error={one(sp.error)} ok={one(sp.ok)} />
      <section className="sec">
        {zones.length === 0 ? (
          <p className="empty">No zones yet. Create a zone first.</p>
        ) : (
          <div className="list">
            {zones.map((z) => (
              <form key={z.id} action={setActiveZone}>
                <input type="hidden" name="zone_id" value={z.id} />
                <button type="submit" className="pick" aria-pressed={z.id === campaign.active_zone_id}>
                  <div>
                    <span className="title">{z.name}</span>
                    <span className="tag">[ {z.dc} ]</span>
                  </div>
                  <div className="subline">
                    ID: {formatZoneId(z.zone_no)}{z.id === campaign.active_zone_id ? ' · Current' : ''}
                  </div>
                </button>
              </form>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
