import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value;

  // 로그인 페이지는 인증 없이 접근 가능
  if (request.nextUrl.pathname === '/login') {
    // 이미 로그인된 경우 역할에 따라 리다이렉트
    if (token) {
      const payload = await verifyToken(token);
      if (payload) {
        if (payload.role === 'INSTRUCTOR') {
          return NextResponse.redirect(new URL('/instructor', request.url));
        } else if (payload.role === 'EM') {
          return NextResponse.redirect(new URL('/em', request.url));
        }
      }
    }
    return NextResponse.next();
  }

  // 인증이 필요한 페이지
  const protectedPaths = ['/instructor', '/em'];
  const isProtectedPath = protectedPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  );

  if (isProtectedPath) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // 역할별 경로 보호
    const path = request.nextUrl.pathname;
    if (path.startsWith('/instructor') && payload.role !== 'INSTRUCTOR') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if (path.startsWith('/em') && payload.role !== 'EM') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
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
    '/((?!api|_next/static|_next/image|favicon.ico|logo.svg|icon.svg).*)',
  ],
};



