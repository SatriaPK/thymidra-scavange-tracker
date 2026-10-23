import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requirePlayer } from '@/lib/session';
import { loadInventory } from '@/lib/inventory';
import { one, type SearchParams } from '@/lib/format';
import { Flash } from '@/components/Flash';
import { InventoryView } from '@/components/InventoryView';
import { PlayShell } from '@/components/PlayShell';

export default async function InventoryPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requirePlayer();
  if (!me.setup_done) redirect('/play/setup');
  const sp = await searchParams;
  const inv = await loadInventory(me);

  return (
    <PlayShell title={me.name} active="/play/inventory">
      <Flash error={one(sp.error)} ok={one(sp.ok)} />
      {me.import_allowed && (
        <div className="notice">
          Your DM opened paper import. <Link href="/play/import">Import your paper sheet</Link> (one use).
        </div>
      )}
      <InventoryView inv={inv} loc="inventory" selected={one(sp.scrap)} />
    </PlayShell>
  );
}