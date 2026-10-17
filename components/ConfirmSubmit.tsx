'use client';

import { useRef, useState, type ButtonHTMLAttributes } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * Tombol submit yang meminta konfirmasi lewat modal dulu (untuk aksi permanen seperti Discard).
 * Setelah dikonfirmasi, form dikirim dengan tombol ini sebagai pengirim, sehingga formAction-nya ikut terpakai.
 */
export function ConfirmSubmit({
  message,
  dialogTitle = 'Are you sure?',
  confirmLabel = 'Confirm',
  ...props
}: { message: string; dialogTitle?: string; confirmLabel?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={ref}
        type="submit"
        {...props}
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
      />
      <ConfirmDialog
        open={open}
        title={dialogTitle}
        message={message}
        confirmLabel={confirmLabel}
        danger
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          const btn = ref.current;
          btn?.form?.requestSubmit(btn);
        }}
      />
    </>
  );
}
