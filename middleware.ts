import { NextResponse, type NextRequest } from 'next/server';
import { isCommunityApiRouteDisabled, isCommunityRouteDisabled } from './lib/community/availability';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isCommunityApiRouteDisabled(pathname)) {
    return NextResponse.json(
      { error: 'Community features are currently unavailable.' },
      { status: 404 }
    );
  }

  if (isCommunityRouteDisabled(pathname)) {
    const notFoundUrl = request.nextUrl.clone();
    notFoundUrl.pathname = '/404';
    notFoundUrl.search = '';

    return NextResponse.rewrite(notFoundUrl, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/community/:path*',
    '/profile/:path*',
    '/saves/:path*',
    '/login/:path*',
    '/register/:path*',
    '/api/auth/:path*',
    '/api/community/:path*',
    '/api/moderation/:path*',
    '/api/profile/:path*',
    '/api/reports/:path*',
    '/api/save-shares/:path*',
  ],
};
