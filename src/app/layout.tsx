import './styles/globals.css'
import { Inter } from 'next/font/google'
import QueryProvider from '@/providers/QueryProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Cafetería MiTienda',
  description: 'Sistema de Gestión de Inventario y Ventas',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#FFA500" />
      </head>
      <body className={`${inter.className} bg-orange-50 min-h-screen`}>
        <QueryProvider>
          {/* Resto de tu layout */}
          {children}
        </QueryProvider>
      </body>
    </html>
  )
}