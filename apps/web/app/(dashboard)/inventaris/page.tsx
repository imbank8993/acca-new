'use client';
import { useDashboardUser } from '@/components/UserContext';
import InventoryView from '@/app/inventaris/view';

export default function Page() {
  const { user } = useDashboardUser();
  if (!user) return null;
  return <InventoryView user={user} />;
}
