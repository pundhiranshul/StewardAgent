import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const path = request.nextUrl.pathname;

  // Only protect /api/ routes
  if (path.startsWith('/api/')) {
    const accessCode = requestHeaders.get('x-access-code');
    const expectedPassword = process.env.APP_PASSWORD;

    // Check if the route needs protection and if the access code matches
    if (expectedPassword && accessCode !== expectedPassword) {
      return NextResponse.json(
        { error: 'Invalid Access Code. Please enter the correct code.' },
        { status: 401 }
      );
    }

    // Inject the real backend API key for the Oracle server
    const apiKey = process.env.BACKEND_API_KEY || 'steward-secret-key-123';
    requestHeaders.set('X-API-KEY', apiKey);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

// Apply this middleware only to /api routes.
// All pages and static assets will bypass this and be publicly accessible.
export const config = {
  matcher: ['/api/:path*'],
};
