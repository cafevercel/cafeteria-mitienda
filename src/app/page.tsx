import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">Bienvenido al Sistema de Punto de Venta</h1>
      <div className="flex gap-4">
        <Link href="/pages/LoginPage" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
          Iniciar Sesión
        </Link>
      </div>
    </main>
  )
}