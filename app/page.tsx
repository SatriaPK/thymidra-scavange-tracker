import { redirect } from 'next/navigation';
import { playerLogin } from '@/lib/actions/auth';
import { readSession } from '@/lib/session';
import { one, type SearchParams } from '@/lib/format';
import { Flash } from '@/components/Flash';

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const session = await readSession();
  if (session?.role === 'player') redirect('/play');
  const sp = await searchParams;

  return (
    <main className="auth-layout">
      <section className="auth-brand">
        <span className="auth-mark">ST / 01</span>
        <h1>Scavenge<br />Tracker</h1>
        <span className="auth-brand-foot">CAMPAIGN FIELD SYSTEM</span>
      </section>
      <section className="auth-panel">
        <div className="auth-panel-head">
          <span className="auth-kicker">PLAYER</span>
          <span className="auth-index">01 — ACCESS</span>
        </div>
        <Flash error={one(sp.error)} />
        <form action={playerLogin} className="stack auth-form">
          <label className="field">
            <span>Character</span>
            <input name="name" autoComplete="off" autoCapitalize="words" required />
          </label>
          <label className="field">
            <span>Access Code</span>
            <input name="code" className="code" autoComplete="off" autoCapitalize="characters" required />
          </label>
          <button className="btn" type="submit">Enter Campaign <span aria-hidden="true">-&gt;</span></button>
        </form>
      </section>
    </main>
  );
}
