'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'

// Componente cliente para la imagen con manejo de errores
const LogoImage = () => {
  const [imageError, setImageError] = useState(false);
  
  if (imageError) {
    return null; // No mostrar nada si hay error
  }
  
  return (
    <Image 
      src="/logo-placeholder.png" 
      alt="Logo" 
      width={400} 
      height={400}
      className="mb-6"
      onError={() => setImageError(true)}
    />
  );
};

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-orange-50">
      <div className="max-w-4xl w-full bg-white rounded-lg shadow-lg p-8 border border-orange-200">
        <h1 className="text-4xl font-bold mb-4 text-center text-orange-800">Sistema de Gestión de Mercado</h1>
        <p className="text-center mb-8 text-orange-700">
          Plataforma para controlar inventario, ventas y gestión de productos
        </p>
        
        <div className="flex flex-col items-center justify-center gap-4">
          <LogoImage />
          
          <Link 
            href="/pages/LoginPage" 
            className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors duration-200 text-center w-full max-w-xs font-medium"
          >
            Iniciar Sesión
          </Link>
        </div>
        
        <div className="mt-12 text-center text-orange-600 text-sm">
          © {new Date().getFullYear()} Sistema Mercado
        </div>
      </div>
    </main>
  )
}