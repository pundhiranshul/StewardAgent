import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedUser = process.env.APP_USERNAME;
  const expectedPassword = process.env.APP_PASSWORD;

  let isAuthorized = false;

  // If no credentials configured, just allow access
  if (!expectedUser || !expectedPassword) {
    isAuthorized = true;
  } else if (authHeader) {
    // Check the basic auth header
    const authValue = authHeader.split(' ')[1];
    const [user, pwd] = atob(authValue).split(':');

    if (user === expectedUser && pwd === expectedPassword) {
      isAuthorized = true;
    }
  }

  if (isAuthorized) {
    const requestHeaders = new Headers(request.headers);
    if (request.nextUrl.pathname.startsWith('/api/')) {
      const apiKey = process.env.BACKEND_API_KEY || 'steward-secret-key-123';
      requestHeaders.set('X-API-KEY', apiKey);
    }
    
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // Not authorized, prompt for password
  return new NextResponse('Auth required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  });
}

// Apply this proxy to all paths except Next.js static files
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
