'use client';

import { useNestAuth } from '@ackplus/nest-auth-react';
import { Loader2 } from 'lucide-react';
import { ApiCallDemo } from '@/components/demo/api-call';

export default function DashboardPage() {
  const { user, status } = useNestAuth();

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-zinc-950 p-6 rounded-lg border dark:border-zinc-800 shadow-sm">
        <h1 className="text-2xl font-bold mb-2">Welcome back!</h1>
        <p className="text-gray-500 dark:text-gray-400">
          You are securely logged in as <span className="font-semibold text-foreground">{user?.email}</span>.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-zinc-950 p-6 rounded-lg border dark:border-zinc-800 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Session Info</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b dark:border-zinc-800">
              <span className="text-gray-500">User ID</span>
              <span className="font-mono">{user?.id}</span>
            </div>
            <div className="flex justify-between py-2 border-b dark:border-zinc-800">
              <span className="text-gray-500">Email Verified</span>
              <span className={user?.isVerified ? 'text-green-600' : 'text-yellow-600'}>
                {user?.isVerified ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b dark:border-zinc-800">
              <span className="text-gray-500">Role</span>
              <span className="capitalize">{user?.roles?.[0] || 'User'}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Auth Status</span>
              <span className="text-green-600 font-medium">Authenticated</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-950 p-6 rounded-lg border dark:border-zinc-800 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <p className="text-sm text-gray-500 mb-4">
            Demonstrating API calls and other actions.
          </p>
          <ApiCallDemo />
        </div>
      </div>
    </div>
  );
}
