import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dmLogin } from '@/lib/actions/auth';
import { readSession } from '@/lib/session';
import { one, type SearchParams } from '@/lib/format';
import { Flash } from '@/components/Flash';

export default async function DmLogin({ searchParams }: { searchParams: SearchParams }) {
  const session = await readSession();
  if (session?.role === 'dm') redirect('/dm');
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
          <span className="auth-kicker">DUNGEON MASTER</span>
          <span className="auth-index">02 — ACCESS</span>
        </div>
        <Flash error={one(sp.error)} />
        <form action={dmLogin} className="stack auth-form">
          <label className="field">
            <span>Campaign Code</span>
            <input name="code" type="password" autoComplete="off" required />
          </label>
          <button className="btn" type="submit">Enter Campaign <span aria-hidden="true">-&gt;</span></button>
        </form>
        <Link href="/" className="auth-back">&lt;- Player login</Link>
      </section>
    </main>
  );
}
