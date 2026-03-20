import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { SideNav } from '@/components/layout/SideNav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) {
    redirect('/login');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SideNav userEmail={session.user?.email ?? undefined} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
