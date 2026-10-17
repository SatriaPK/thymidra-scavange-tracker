'use client';

import { useRef } from 'react';
import { UploadIcon } from './Icons';

/** Tombol ikon upload: memilih file JSON lalu langsung mengirimnya ke server action. */
export function ImportButton({
  action,
  label,
}: {
  action: (formData: FormData) => Promise<void>;
  label: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form ref={formRef} action={action}>
      <input
        ref={inputRef}
        type="file"
        name="file"
        accept="application/json,.json"
        hidden
        onChange={() => {
          if (inputRef.current?.files?.length) formRef.current?.requestSubmit();
        }}
      />
      <button type="button" className="icon-btn" aria-label={label} title={label} onClick={() => inputRef.current?.click()}>
        <UploadIcon />
      </button>
    </form>
  );
}
