'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Tiap refresh menjalankan ulang semua query halaman. 15 detik cukup untuk melihat perubahan dari DM;
// saat tab kembali aktif, refresh langsung dijalankan (lihat visibilitychange di bawah).
const REFRESH_INTERVAL_MS = 15_000;

export function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const interval = window.setInterval(refreshIfVisible, REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', refreshIfVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [router]);

  return null;
}
