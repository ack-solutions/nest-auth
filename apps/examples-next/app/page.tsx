'use client';

import Link from 'next/link';
import { useNestAuth } from '@ackplus/nest-auth-react';
import { Loader2, ShieldCheck, LayoutDashboard, LogIn, UserPlus } from 'lucide-react';

export default function Home() {
  const { user, status } = useNestAuth();
  const isLoading = status === 'loading';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start text-center sm:text-left max-w-2xl">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-12 h-12 text-blue-600" />
          <h1 className="text-4xl font-bold tracking-tight">Nest Auth Example</h1>
        </div>
        
        <p className="text-lg text-gray-600 dark:text-gray-300">
          A complete production-ready example demonstrating the full authentication flow
          using <code>@ackplus/nest-auth-client</code> and <code>@ackplus/nest-auth-react</code>.
        </p>

        <div className="flex gap-4 items-center flex-col sm:flex-row w-full sm:w-auto">
          {isLoading ? (
            <div className="flex items-center gap-2 px-6 py-3 bg-gray-100 rounded-full">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Checking session...</span>
            </div>
          ) : user ? (
            <div className="flex flex-col gap-4 items-center sm:items-start">
              <div className="flex items-center gap-2 text-green-600 font-medium">
                <div className="w-2 h-2 rounded-full bg-green-600" />
                Logged in as {user.email}
              </div>
              <div className="flex gap-4">
                <Link
                  href="/dashboard"
                  className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-blue-600 text-white gap-2 hover:bg-blue-700 text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Go to Dashboard
                </Link>
                <Link
                  href="/profile"
                  className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
                >
                  View Profile
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex gap-4 w-full justify-center sm:justify-start">
              <Link
                href="/login"
                className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
              >
                <LogIn className="w-4 h-4" />
                Login
              </Link>
              <Link
                href="/signup"
                className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
              >
                <UserPlus className="w-4 h-4" />
                Sign Up
              </Link>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mt-8 text-sm">
          <Feature 
            title="SSR Support" 
            desc="Works with Next.js App Router and Server Components" 
          />
          <Feature 
            title="Secure" 
            desc="HttpOnly cookies and CSRF protection" 
          />
          <Feature 
            title="Type Safe" 
            desc="Full TypeScript support with shared interfaces" 
          />
          <Feature 
            title="Middleware" 
            desc="Edge-compatible route protection" 
          />
        </div>
      </main>
    </div>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="p-4 rounded-lg border border-black/[.05] dark:border-white/[.05] bg-black/[.01] dark:bg-white/[.01]">
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-gray-500 dark:text-gray-400">{desc}</p>
    </div>
  );
}
