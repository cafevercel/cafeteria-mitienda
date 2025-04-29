import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ALLOWED_ORIGINS = [
  'http://localhost:3000', 
  'https://mitienda-cuba.com',
  'https://mitienda-cuba.vercel.app'
];

export function middleware(request: NextRequest) {
  // Solo aplicar a rutas de API
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // Obtener el origen de la solicitud
    const origin = request.headers.get('origin') || '';
    const isAllowedOrigin = ALLOWED_ORIGINS.includes(origin);

    // Para solicitudes OPTIONS (preflight)
    if (request.method === 'OPTIONS') {
      const preflightResponse = new NextResponse(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': isAllowedOrigin ? origin : ALLOWED_ORIGINS[0],
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
          'Access-Control-Max-Age': '86400',
        }
      });
      return preflightResponse;
    }

    // Clonar la respuesta para poder modificar headers
    const response = NextResponse.next();

    // Añadir headers CORS
    response.headers.set('Access-Control-Allow-Origin', isAllowedOrigin ? origin : ALLOWED_ORIGINS[0]);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    response.headers.set('Access-Control-Allow-Credentials', 'true');

    return response;
  }

  // Para rutas que no son API, continuar normalmente
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};