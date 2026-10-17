import Link from 'next/link';
import { db } from '@/lib/db';
import { requireDm } from '@/lib/session';
import { setZoneEnabled } from '@/lib/actions/dm';
import { one, type SearchParams } from '@/lib/format';
import { Flash } from '@/components/Flash';
import { Header } from '@/components/Header';
import { ArrowRightIcon, GearIcon } from '@/components/Icons';
import type { Character, Zone } from '@/lib/types';

export default async function DmDashboard({ searchParams }: { searchParams: SearchParams }) {
  const campaign = await requireDm();
  const sp = await searchParams;

  const [zoneRes, charsRes] = await Promise.all([
    campaign.active_zone_id
      ? db().from('zone').select('*').eq('id', campaign.active_zone_id).maybeSingle()
      : Promise.resolve({ data: null }),
    db().from('character').select('*').eq('campaign_id', campaign.id).order('char_no'),
  ]);
  const zone = zoneRes.data as Zone | null;
  const characters = (charsRes.data ?? []) as Character[];

  let junk = 0;
  let rare = 0;
  if (zone) {
    const { data } = await db().from('zone_item').select('is_rare').eq('zone_id', zone.id);
    for (const r of data ?? []) r.is_rare ? rare++ : junk++;
  }

  return (
    <>
      <Header title={campaign.name} />
      <Flash error={one(sp.error)} ok={one(sp.ok)} />

      <main className="dm-dashboard-grid">
        <section className="sec">
          <div className="sec-head">
            <h2>Active Zone</h2>
            <Link href="/dm/zones" className="go" aria-label="All zones"><ArrowRightIcon /></Link>
          </div>

          {!zone ? (
            <div className="zone-off">No active zone</div>
          ) : !campaign.zone_enabled ? (
            <div className="zone-off">Zone Disabled</div>
          ) : (
            <div className="zone-card">
              <div>
                <div className="name">{zone.name}</div>
                <div className="sub-line">{junk} Junk Item, {rare} Rare Item</div>
              </div>
              <Link href={`/dm/zones/${zone.id}`} className="icon-plain" aria-label="Zone details"><GearIcon /></Link>
            </div>
          )}

          <div className="actions">
            {zone && (
              <form action={setZoneEnabled}>
                <input type="hidden" name="enabled" value={campaign.zone_enabled ? '0' : '1'} />
                <button type="submit" className={`btn ${campaign.zone_enabled ? 'btn-red' : 'btn-green'}`}>
                  {campaign.zone_enabled ? 'Disable' : 'Enable'}
                </button>
              </form>
            )}
            <Link href="/dm/zones/active" className="btn">Change Zone</Link>
          </div>
        </section>

        <section className="sec">
          <div className="sec-head">
            <h2>Campaign Character</h2>
            <Link href="/dm/characters" className="go" aria-label="All characters"><ArrowRightIcon /></Link>
          </div>
          {characters.length === 0 ? (
            <p className="muted">No characters yet.</p>
          ) : (
            <div className="chargrid">
              {characters.map((c) => (
                <Link key={c.id} href={`/dm/characters/${c.id}`} className="charcard">
                  <b>{c.name}</b>
                  <span>{c.class || '-'} lv. {c.level}</span>
                </Link>
              ))}
            </div>
          )}
          <Link href="/dm/characters" className="btn">Manage Character</Link>
        </section>
      </main>
    </>
  );
}
