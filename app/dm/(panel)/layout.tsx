import { requireDm } from '@/lib/session';
import { DmSidebar } from '@/components/DmSidebar';

export default async function DmLayout({ children }: { children: React.ReactNode }) {
  const campaign = await requireDm();
  return (
    <div className="workspace dm-workspace">
      <DmSidebar campaignName={campaign.name} />
      <div className="app workspace-content">{children}</div>
    </div>
  );
}
