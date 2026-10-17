'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { CloseIcon, DownloadIcon, PencilIcon, SearchIcon, TrashIcon } from './Icons';

export interface ListRow {
  id: string;
  title: string;
  tag?: string;
  sub: string;
  idLabel: string;
  editHref: string;
  viewHref?: string;
  description?: string;
  details: [string, string][];
}

interface Props {
  rows: ListRow[];
  entity: string; // "Item", "Zone", "Character"
  searchPlaceholder: string;
  deleteAction: (formData: FormData) => Promise<void>;
  exportHref: string;
  emptyText: string;
}

export function SelectableList({ rows, entity, searchPlaceholder, deleteAction, exportHref, emptyText }: Props) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<ListRow | null>(null);
  // Form hapus yang menunggu konfirmasi lewat modal, dan form yang sudah dikonfirmasi (lolos satu kali).
  const [ask, setAsk] = useState<{ form: HTMLFormElement; count: number } | null>(null);
  const confirmed = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.title} ${r.sub} ${r.idLabel}`.toLowerCase().includes(q));
  }, [rows, query]);

  // Buang pilihan yang barisnya sudah tidak ada (mis. setelah dihapus).
  const selectedIds = useMemo(() => {
    const live = new Set(rows.map((r) => r.id));
    return [...picked].filter((id) => live.has(id));
  }, [picked, rows]);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const confirmDelete = (e: React.FormEvent<HTMLFormElement>, count: number) => {
    if (confirmed.current === e.currentTarget) {
      confirmed.current = null;
      return; // sudah dikonfirmasi di modal, lanjutkan submit
    }
    e.preventDefault();
    setAsk({ form: e.currentTarget, count });
  };

  const askNoun = ask ? (ask.count === 1 ? entity.toLowerCase() : `${entity.toLowerCase()}s`) : '';

  return (
    <>
      <label className="search">
        <SearchIcon />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
        />
      </label>

      {shown.length === 0 ? (
        <p className="empty">{rows.length === 0 ? emptyText : 'No match.'}</p>
      ) : (
        <ul className="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {shown.map((r) => (
            <li key={r.id} className="item-row">
              <input
                type="checkbox"
                checked={picked.has(r.id)}
                onChange={() => toggle(r.id)}
                aria-label={`Select ${r.title}`}
              />
              <button type="button" className="main" onClick={() => setOpen(r)}>
                <div>
                  <span className="title">{r.title}</span>
                  {r.tag && <span className="tag">[ {r.tag} ]</span>}
                </div>
                <div className="subline">{r.sub}</div>
              </button>
              <Link href={r.editHref} className="icon-plain" aria-label={`Edit ${r.title}`}>
                <PencilIcon />
              </Link>
              <form action={deleteAction} onSubmit={(e) => confirmDelete(e, 1)}>
                <input type="hidden" name="ids" value={r.id} />
                <button type="submit" className="icon-plain" aria-label={`Delete ${r.title}`}>
                  <TrashIcon />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {selectedIds.length > 0 && (
        <div className="selbar" role="region" aria-label="Selection actions">
          <span>{selectedIds.length} {entity} Selected</span>
          <div className="icons">
            <a
              className="icon-plain"
              href={`${exportHref}?ids=${selectedIds.join(',')}`}
              aria-label="Export selected"
              title="Export selected"
            >
              <DownloadIcon />
            </a>
            <form action={deleteAction} onSubmit={(e) => confirmDelete(e, selectedIds.length)}>
              {selectedIds.map((id) => (
                <input key={id} type="hidden" name="ids" value={id} />
              ))}
              <button type="submit" className="icon-plain" aria-label="Delete selected" title="Delete selected">
                <TrashIcon />
              </button>
            </form>
          </div>
        </div>
      )}

      {open && (
        <div className="modal-back" onClick={() => setOpen(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label={open.title} onClick={(e) => e.stopPropagation()}>
            <header>
              <div>
                <h3>{open.title}</h3>
                <div className="idl">{open.idLabel}</div>
              </div>
              <button type="button" className="icon-plain" onClick={() => setOpen(null)} aria-label="Close">
                <CloseIcon />
              </button>
            </header>

            {open.description !== undefined && (
              <div className="block">
                <span>Description</span>
                <p>{open.description || '-'}</p>
              </div>
            )}

            {open.details.map(([k, v], i) => (
              <div key={k} className={`kv ${i === 0 && open.description === undefined ? '' : 'divide'}`}>
                <span className="k">{k}</span>
                <span className="v">{v}</span>
              </div>
            ))}

            <div className="actions-row">
              {open.viewHref && (
                <Link className="btn btn-ghost" href={open.viewHref}>Open</Link>
              )}
              <Link className="btn" href={open.editHref}>Edit</Link>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!ask}
        title={`Delete ${askNoun}?`}
        message={ask ? `Delete ${ask.count} ${askNoun}? This cannot be undone.` : ''}
        confirmLabel="Delete"
        danger
        onCancel={() => setAsk(null)}
        onConfirm={() => {
          const form = ask?.form;
          setAsk(null);
          if (!form) return;
          confirmed.current = form;
          form.requestSubmit();
        }}
      />
    </>
  );
}
