import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'chatbot_session';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsAuth =
    (pathname.startsWith('/admin') && pathname !== '/admin/login') ||
    (pathname.startsWith('/operator') && pathname !== '/operator/login');

  if (!needsAuth) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const loginUrl = pathname.startsWith('/admin') ? '/admin/login' : '/operator/login';
    return NextResponse.redirect(new URL(loginUrl, req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/operator/:path*'],
};
