/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost', 'mitienda-cuba.com', 'mitienda-cuba.vercel.app'],
  },
  // Configuración para desactivar la caché estática en producción
  headers: async () => {
    return [
      {
        // Aplicar a todas las rutas de API
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
          {
            key: 'Surrogate-Control',
            value: 'no-store',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
