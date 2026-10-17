'use client';

import type { ButtonHTMLAttributes } from 'react';

/** Tombol submit yang meminta konfirmasi dulu (untuk aksi permanen seperti Discard). */
export function ConfirmSubmit({
  message,
  ...props
}: { message: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="submit"
      {...props}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    />
  );
}
