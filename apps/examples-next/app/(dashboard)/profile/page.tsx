'use client';

import { useNestAuth } from '@ackplus/nest-auth-react';

export default function ProfilePage() {
  const { user } = useNestAuth();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">My Profile</h1>
      
      <div className="bg-white dark:bg-zinc-950 rounded-lg border dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-2xl font-bold">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-semibold">{(user as any)?.firstName} {(user as any)?.lastName}</h2>
              <p className="text-gray-500">{user?.email}</p>
            </div>
          </div>

          <div className="border-t dark:border-zinc-800 pt-6">
            <h3 className="font-medium mb-4">Account Details</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6 text-sm">
              <div>
                <dt className="text-gray-500 mb-1">User ID</dt>
                <dd className="font-mono text-xs">{user?.id}</dd>
              </div>
              <div>
                <dt className="text-gray-500 mb-1">Email</dt>
                <dd>{user?.email}</dd>
              </div>
              <div>
                <dt className="text-gray-500 mb-1">Phone</dt>
                <dd>{user?.phone || 'Not set'}</dd>
              </div>
              <div>
                <dt className="text-gray-500 mb-1">Status</dt>
                <dd className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  Active
                </dd>
              </div>
            </dl>
          </div>
          
          <div className="border-t dark:border-zinc-800 pt-6">
             <h3 className="font-medium mb-4">Raw User Data</h3>
             <pre className="bg-gray-50 dark:bg-zinc-900 p-4 rounded text-xs overflow-auto max-h-60">
               {JSON.stringify(user, null, 2)}
             </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
