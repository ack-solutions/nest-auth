'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useNestAuth } from '@ackplus/nest-auth-react';
import { Button } from '@/components/ui/button';
import { Shield, User, LogOut, LayoutDashboard } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { logout, user } = useNestAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900">
      <header className="border-b bg-white dark:bg-zinc-950 dark:border-zinc-800">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl">
            <Shield className="w-6 h-6 text-blue-600" />
            <span>Nest Auth</span>
          </div>
          
          <nav className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm font-medium hover:text-blue-600 flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
            <Link href="/profile" className="text-sm font-medium hover:text-blue-600 flex items-center gap-2">
              <User className="w-4 h-4" />
              Profile
            </Link>
            <Button variant="ghost" onClick={handleLogout} className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/10">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
