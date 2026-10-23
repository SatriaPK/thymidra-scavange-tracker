import Link from 'next/link';
import { requirePlayer } from '@/lib/session';
import { saveCharacter } from '@/lib/actions/player';
import { one, type SearchParams } from '@/lib/format';
import { CharacterForm } from '@/components/CharacterForm';
import { Flash } from '@/components/Flash';

export default async function SetupPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requirePlayer();
  const sp = await searchParams;

  return (
    <div className="app">
      <header className="hdr">
        <h1>{me.setup_done ? 'Edit Character' : 'Welcome'}</h1>
        {me.setup_done && <Link href="/play" className="muted">Back</Link>}
      </header>
      <div className="sec">
        <p className="muted" style={{ margin: 0 }}>
          {me.setup_done
            ? 'Stat changes are recorded in the DM log.'
            : `Hi ${me.name}. Fill in your character first. Modifier and inventory slots are calculated automatically.`}
        </p>
      </div>
      <Flash error={one(sp.error)} />
      <CharacterForm
        action={saveCharacter}
        nameEditable={false}
        submitLabel={me.setup_done ? 'Save Character' : 'Save and Start'}
        initial={{
          name: me.name,
          class: me.class ?? '',
          level: me.setup_done ? String(me.level) : '',
          str: me.setup_done ? String(me.str) : '',
          dex: me.setup_done ? String(me.dex) : '',
          con: me.setup_done ? String(me.con) : '',
          int_score: me.setup_done ? String(me.int_score) : '',
          wis: me.setup_done ? String(me.wis) : '',
          cha: me.setup_done ? String(me.cha) : '',
          invest_proficient: me.invest_proficient,
          invest_expertise: me.invest_expertise,
          invest_bonus: me.setup_done ? String(me.invest_bonus) : '',
          slot_bonus: me.setup_done ? String(me.slot_bonus) : '',
          feature_double_slots: !!me.feature_double_slots,
          feature_reroll_nat1: !!me.feature_reroll_nat1,
        }}
      />
    </div>
  );
}
