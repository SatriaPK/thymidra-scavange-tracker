import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requirePlayer } from '@/lib/session';
import { acceptTrade, cancelTrade, declineTrade } from '@/lib/actions/barter';
import { describeBundle, parseBundle, roomShortfallText } from '@/lib/barter';
import { evaluateTrade, loadItemsById, sweepStaleTrades, tradeItemIds } from '@/lib/barter-data';
import { fmtWib } from '@/lib/format';
import { one, type SearchParams } from '@/lib/format';
import { Flash } from '@/components/Flash';
import { PlayShell } from '@/components/PlayShell';
import type { Character, Trade } from '@/lib/types';

const STATUS: Record<Trade['status'], string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

export default async function BarterPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requirePlayer();
  if (!me.setup_done) redirect('/play/setup');
  const sp = await searchParams;

  // Tawaran yang barangnya sudah berubah dibatalkan otomatis sebelum daftar dimuat.
  await sweepStaleTrades(me.id, me.campaign_id);

  const { data } = await db()
    .from('trade')
    .select('*')
    .eq('campaign_id', me.campaign_id)
    .or(`from_character.eq.${me.id},to_character.eq.${me.id}`)
    .order('created_at', { ascending: false })
    .limit(40);
  const all = (data ?? []) as Trade[];
  const incoming = all.filter((t) => t.status === 'pending' && t.to_character === me.id);
  const outgoing = all.filter((t) => t.status === 'pending' && t.from_character === me.id);
  const history = all.filter((t) => t.status !== 'pending').slice(0, 10);

  const charIds = [...new Set(all.flatMap((t) => [t.from_character, t.to_character]))];
  const { data: chars } = charIds.length ? await db().from('character').select('id, name').in('id', charIds) : { data: [] };
  const nameOf = new Map(((chars ?? []) as Pick<Character, 'id' | 'name'>[]).map((c) => [c.id, c.name]));
  const itemNames = new Map(
    [...(await loadItemsById(all.flatMap(tradeItemIds)))].map(([id, item]) => [id, item.name]),
  );

  const text = (t: Trade) => ({
    offer: describeBundle(parseBundle(t.offer), itemNames),
    request: t.mode === 'swap' ? describeBundle(parseBundle(t.request), itemNames) : null,
  });

  // Untuk tawaran masuk: bisakah diterima sekarang (ruang cukup)?
  const views = new Map(
    (await Promise.all(incoming.map(async (t) => [t.id, await evaluateTrade(t)] as const))),
  );

  return (
    <PlayShell title={me.name} active="/play/barter">
      <Flash error={one(sp.error)} ok={one(sp.ok)} />

      <section className="sec">
        <div className="sec-head">
          <h2>Incoming offers</h2>
          <span className="count">{incoming.length}</span>
        </div>
        {incoming.length === 0 ? (
          <p className="empty">No offers for you.</p>
        ) : (
          <div className="list">
            {incoming.map((t) => {
              const x = text(t);
              const check = views.get(t.id)?.check;
              const blocked = check && !check.ok ? check : null;
              return (
                <div key={t.id} className="find">
                  <div className="top"><span className="title">{nameOf.get(t.from_character) ?? 'Unknown'}</span><span className="tag">[ {t.mode === 'swap' ? 'Swap' : 'Give'} ]</span></div>
                  <div className="subline">{t.mode === 'swap' ? `Offers ${x.offer}, wants ${x.request} from you` : `Gives you ${x.offer}`}</div>
                  {blocked && blocked.reason === 'no_room_receiver' && (
                    <div className="warn">Your Inventory is full ({roomShortfallText(blocked.overQ)}). Make room, then accept.</div>
                  )}
                  {blocked && blocked.reason === 'no_room_sender' && (
                    <div className="warn">{nameOf.get(t.from_character) ?? 'They'} has no room for your items yet.</div>
                  )}
                  <form className="btns">
                    <button type="submit" formAction={acceptTrade.bind(null, t.id)} className="btn btn-sm" disabled={!!blocked}>Accept</button>
                    <button type="submit" formAction={declineTrade.bind(null, t.id)} className="btn btn-sm btn-red">Decline</button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="sec">
        <div className="sec-head">
          <h2>Your offers</h2>
          <Link href="/play/barter/new" className="btn btn-sm">New trade</Link>
        </div>
        {outgoing.length === 0 ? (
          <p className="empty">No pending offers.</p>
        ) : (
          <div className="list">
            {outgoing.map((t) => {
              const x = text(t);
              return (
                <div key={t.id} className="find">
                  <div className="top"><span className="title">To {nameOf.get(t.to_character) ?? 'Unknown'}</span><span className="tag">[ {t.mode === 'swap' ? 'Swap' : 'Give'} ]</span></div>
                  <div className="subline">{t.mode === 'swap' ? `You offer ${x.offer} for ${x.request}` : `You give ${x.offer}`}</div>
                  <form className="btns">
                    <button type="submit" formAction={cancelTrade.bind(null, t.id)} className="btn btn-sm btn-red">Cancel offer</button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {history.length > 0 && (
        <section className="sec">
          <div className="sec-head"><h2>Recent</h2></div>
          <div className="list">
            {history.map((t) => {
              const x = text(t);
              const mine = t.from_character === me.id;
              const other = nameOf.get(mine ? t.to_character : t.from_character) ?? 'Unknown';
              return (
                <div key={t.id} className="find">
                  <div className="top"><span className="title">{mine ? `To ${other}` : `From ${other}`}</span><span className="tag">[ {STATUS[t.status]} ]</span></div>
                  <div className="subline">{t.mode === 'swap' ? `${x.offer} ⇄ ${x.request}` : x.offer}</div>
                  <div className="subline muted">{fmtWib(t.created_at)} WIB</div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </PlayShell>
  );
}
