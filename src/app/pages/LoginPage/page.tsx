'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { login } from "../../services/auth"
import Image from 'next/image'

export default function LoginPage() {
  const [nombre, setNombre] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      console.log('Intentando iniciar sesión con:', { nombre, password });
      const userData = await login(nombre, password);
      console.log('Respuesta del servidor:', userData);
      
      // En tu componente LoginPage
      if (userData.rol === 'Vendedor') {
        console.log('Redirigiendo a la página de vendedor');
        router.push(`/pages/VendedorPage/${userData.id}`);
      } else if (userData.rol === 'Almacen') {
        console.log('Redirigiendo a la página de almacén');
        router.push('/pages/AlmacenPage');
      } else {
        console.error('Rol de usuario no reconocido:', userData.rol);
        setError('Error: Rol de usuario no reconocido');
      }
    } catch (err) {
      console.error('Error durante el inicio de sesión:', err);
      setError(err instanceof Error ? err.message : 'Error en el inicio de sesión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-orange-50">
      <Card className="w-full max-w-md shadow-lg border-orange-200">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto mb-2">
            <Image 
              src="/logo-placeholder.png" 
              alt="Logo" 
              width={100} 
              height={100}
              className="mx-auto"
              onError={(e) => {
                // Si la imagen da error, usar un fallback
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          </div>
          <CardTitle className="text-2xl font-bold text-orange-800">Iniciar Sesión</CardTitle>
          <CardDescription className="text-orange-600">
            Ingresa tus credenciales para acceder al sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="nombre" className="text-sm font-medium leading-none text-orange-700 peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Nombre de Usuario
              </label>
              <Input
                id="nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                placeholder="Ingresa tu nombre de usuario"
                disabled={isLoading}
                className="border-orange-200 focus:border-orange-400 focus:ring-orange-400"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium leading-none text-orange-700 peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Contraseña
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Ingresa tu contraseña"
                disabled={isLoading}
                className="border-orange-200 focus:border-orange-400 focus:ring-orange-400"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isLoading}>
              {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-orange-600">
            ¿No tienes una cuenta? Contacta al administrador
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}