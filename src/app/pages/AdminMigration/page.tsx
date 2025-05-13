'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import axios from 'axios'

export default function AdminMigrationPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const runActiveFieldMigration = async () => {
    setIsLoading(true)
    setResult(null)
    
    try {
      const response = await axios.post('/api/migration/add-active-field')
      setResult(JSON.stringify(response.data, null, 2))
      toast({
        title: "Éxito",
        description: "Migración completada correctamente",
      })
    } catch (error) {
      console.error('Error al ejecutar la migración:', error)
      setResult(JSON.stringify(error, null, 2))
      toast({
        title: "Error",
        description: "Error al ejecutar la migración",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-8">Panel de Administración - Migraciones</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Añadir campo 'activo' a Usuarios</CardTitle>
            <CardDescription>
              Añade el campo booleano 'activo' a la tabla de usuarios para permitir activar/desactivar el acceso de vendedores.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              Esta migración añade un nuevo campo 'activo' a la tabla de usuarios que permite controlar si un vendedor
              puede acceder al sistema o no. Por defecto, todos los usuarios serán marcados como activos.
            </p>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={runActiveFieldMigration} 
              disabled={isLoading}
              className="bg-blue-500 hover:bg-blue-600"
            >
              {isLoading ? 'Ejecutando...' : 'Ejecutar migración'}
            </Button>
          </CardFooter>
        </Card>
        
        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Resultado</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-4 rounded-md overflow-auto text-xs">
                {result}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
} 