import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check for access token cookie
  // Note: We use 'accessToken' to match NestAuth backend defaults
  const token = request.cookies.get('accessToken');
  const { pathname } = request.nextUrl;

  // Public paths that don't need protection
  const publicPaths = ['/login', '/signup', '/forgot-password', '/reset-password', '/'];
  
  // Check if the current path is public
  const isPublicPath = publicPaths.some(path => pathname === path || pathname.startsWith(`${path}/`));
  const isProtectedPath = ['/dashboard', '/profile'].some(path => pathname.startsWith(path));

  // If user has token and tries to access auth pages, redirect to dashboard
  if (token && (pathname === '/login' || pathname === '/signup' || pathname === '/forgot-password')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // If user tries to access protected routes without token, redirect to login
  if (!token && isProtectedPath) {
    const url = new URL('/login', request.url);
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
