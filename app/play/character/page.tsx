import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requirePlayer } from '@/lib/session';
import { abilityMod, investigationModifier, proficiencyBonus, slotCapacity } from '@/lib/core';
import { sign } from '@/lib/format';
import { PlayShell } from '@/components/PlayShell';

export default async function CharacterPage() {
  const me = await requirePlayer();
  if (!me.setup_done) redirect('/play/setup');

  const abilities: [string, string, number][] = [
    ['STR', 'Strength', me.str],
    ['DEX', 'Dexterity', me.dex],
    ['CON', 'Constitution', me.con],
    ['INT', 'Intelligence', me.int_score],
    ['WIS', 'Wisdom', me.wis],
    ['CHA', 'Charisma', me.cha],
  ];
  const investigation = investigationModifier({
    level: me.level,
    intScore: me.int_score,
    proficient: me.invest_proficient,
    expertise: me.invest_expertise,
    bonus: me.invest_bonus,
  });

  return (
    <PlayShell title={me.name} active="/play/character">
      <section className="sec">
        <div className="sec-head">
          <h2>Ability Scores</h2>
          <Link href="/play/setup" className="link-green">Edit</Link>
        </div>
        <div className="character-abilities">
          {abilities.map(([shortLabel, label, score]) => (
            <div className="character-ability" key={shortLabel} aria-label={`${label}: ${score}, modifier ${sign(abilityMod(score))}`}>
              <span className="character-ability-name">{shortLabel}</span>
              <strong>{sign(abilityMod(score))}</strong>
              <span className="character-ability-score">{score}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="sec">
        <div className="sec-head"><h2>Character Details</h2></div>
        <div className="character-summary">
          <div className="character-stat character-stat-wide">
            <span className="character-stat-label">Class</span>
            <strong>{me.class || '-'}</strong>
          </div>
          <div className="character-stat">
            <span className="character-stat-label">Level</span>
            <strong>{me.level}</strong>
          </div>
          <div className="character-stat">
            <span className="character-stat-label">Proficiency Bonus</span>
            <strong>{sign(proficiencyBonus(me.level))}</strong>
          </div>
          <div className="character-stat">
            <span className="character-stat-label">Investigation Mod</span>
            <strong>{sign(investigation)}</strong>
          </div>
          <div className="character-stat">
            <span className="character-stat-label">Inventory Slots</span>
            <strong>{slotCapacity({ strScore: me.str, slotBonus: me.slot_bonus })}</strong>
          </div>
        </div>
      </section>

      <section className="rows rule">
        <div className="kv"><span className="k">Investigation Proficient</span><span className="v">{me.invest_proficient ? 'Yes' : 'No'}</span></div>
        <div className="kv"><span className="k">Investigation Expertise</span><span className="v">{me.invest_expertise ? 'Yes' : 'No'}</span></div>
        <div className="kv"><span className="k">Bonus Investigation Modifier</span><span className="v">{sign(me.invest_bonus)}</span></div>
        <div className="kv"><span className="k">Bonus Inventory Slots</span><span className="v">{sign(me.slot_bonus)}</span></div>
      </section>
    </PlayShell>
  );
}
