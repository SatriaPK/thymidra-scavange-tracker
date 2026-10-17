'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from './Icons';

interface Props {
  open: boolean;
  title: string;
  /** Isi pesan, atau konten bebas (mis. form) bila `children` diberikan. */
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Aksi permanen: tombol konfirmasi berwarna merah. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal konfirmasi pengganti window.confirm. Memakai gaya .modal yang sudah ada.
 * Dirender lewat portal ke body supaya tidak terjebak di dalam <form> atau <details>.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  const titleId = useId();
  const textId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Fokus awal ke Cancel supaya Enter tidak langsung mengonfirmasi aksi permanen.
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="modal-back" onClick={onCancel}>
      <div
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h3 id={titleId}>{title}</h3>
          <button type="button" className="icon-plain" onClick={onCancel} aria-label="Close">
            <CloseIcon />
          </button>
        </header>
        <div className="block" style={{ borderTop: 0 }}>
          <p id={textId} style={{ marginTop: 0, color: 'var(--ink)', whiteSpace: 'pre-line' }}>{message}</p>
        </div>
        <div className="actions-row">
          <button ref={cancelRef} type="button" className="btn btn-ghost" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className={danger ? 'btn btn-red' : 'btn'} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Pembungkus untuk modal dengan isi bebas (tanpa tombol bawaan); dipakai modal inventori penuh. */
export function ModalShell({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <header>
          <h3 id={titleId}>{title}</h3>
          <button type="button" className="icon-plain" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}
