'use client';

import { useState } from 'react';

export interface PoolRow {
  id: string;
  no: string; // ID tampilan, mis. "001"
  name: string;
  slot: string; // "3" atau "-"
  weight: number;
  chance: number; // persen di dalam pool
}

const PAGE_SIZE = 5;

/** Tabel isi pool zona dengan paginasi. Bobot bisa diedit bila onWeightChange diberikan. */
export function PoolTable({
  rows,
  onWeightChange,
  emptyText,
}: {
  rows: PoolRow[];
  onWeightChange?: (id: string, weight: number) => void;
  emptyText: string;
}) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const slice = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  // Tampilkan maksimal 5 nomor halaman di sekitar halaman aktif.
  const start = Math.max(1, Math.min(current - 2, pages - 4));
  const nums = Array.from({ length: Math.min(5, pages) }, (_, i) => start + i);

  const fmt = (p: number) => (p >= 10 ? p.toFixed(0) : p >= 1 ? p.toFixed(1) : p.toFixed(2));

  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr><th>ID</th><th>Item Name</th><th>Slot</th><th>Weight</th><th>Chance</th></tr>
        </thead>
        <tbody>
          {slice.length === 0 && (
            <tr><td colSpan={5} className="muted" style={{ whiteSpace: 'normal', padding: 16 }}>{emptyText}</td></tr>
          )}
          {slice.map((r) => (
            <tr key={r.id}>
              <td>{r.no}</td>
              <td className="name">{r.name}</td>
              <td>{r.slot}</td>
              <td>
                {onWeightChange ? (
                  <input
                    type="number"
                    min={1}
                    max={9999}
                    value={r.weight}
                    aria-label={`Weight for ${r.name}`}
                    onChange={(e) => onWeightChange(r.id, Math.min(9999, Math.max(1, Math.floor(Number(e.target.value)) || 1)))}
                  />
                ) : (
                  r.weight
                )}
              </td>
              <td>{fmt(r.chance)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pager">
        <button type="button" onClick={() => setPage(current - 1)} disabled={current <= 1} aria-label="Previous page">&lsaquo;</button>
        <div className="nums">
          {nums.map((n) => (
            <button key={n} type="button" onClick={() => setPage(n)} aria-current={n === current}>{n}</button>
          ))}
        </div>
        <button type="button" onClick={() => setPage(current + 1)} disabled={current >= pages} aria-label="Next page">&rsaquo;</button>
      </div>
    </div>
  );
}
