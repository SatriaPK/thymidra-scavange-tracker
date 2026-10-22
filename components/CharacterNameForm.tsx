import { saveCharacterDm } from '@/lib/actions/dm';

/**
 * Form karakter untuk DM: hanya nama (dan kode akses untuk karakter baru).
 * Class, level, dan stat diisi pemain sendiri saat login pertama.
 */
export function CharacterNameForm({
  id,
  name,
  code,
  submitLabel,
}: {
  id?: string;
  name: string;
  /** Kode akses yang sudah dibuat (karakter baru). Dikirim bersama form. */
  code?: string;
  submitLabel: string;
}) {
  return (
    <form action={saveCharacterDm}>
      {id && <input type="hidden" name="id" value={id} />}
      {code && <input type="hidden" name="access_code" value={code} />}

      <div className="sec stack">
        <label className="field">
          <span>Character Name<span className="req">*</span></span>
          <input name="name" defaultValue={name} required maxLength={40} autoComplete="off" />
        </label>
        <small className="hint">
          The player fills in their own class, level, and stats the first time they log in with the code.
        </small>
      </div>

      <div className="sec">
        <button className="btn" type="submit">{submitLabel}</button>
      </div>
    </form>
  );
}
