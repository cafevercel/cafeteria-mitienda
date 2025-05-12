'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"

export default function MigrationPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const handleMigration = async () => {
    if (!confirm('¿Estás seguro de que deseas migrar el inventario? Esta acción modificará la estructura de la base de datos.')) {
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/migration/inventory', {
        method: 'POST',
      })

      const data = await response.json()
      
      if (response.ok) {
        setResult('✅ Migración completada correctamente')
        toast({
          title: "Éxito",
          description: "Migración completada correctamente",
        })
      } else {
        setResult(`❌ Error: ${data.error || 'Ocurrió un error desconocido'}`)
        toast({
          title: "Error",
          description: data.error || 'Ocurrió un error durante la migración',
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error durante la migración:', error)
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Ocurrió un error desconocido'}`)
      toast({
        title: "Error",
        description: "Error al conectar con el servidor",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Migración de Inventario</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-gray-600">
            Esta página te permite migrar las tablas de inventario al nuevo formato que no
            requiere ID de usuario, permitiendo el inventario compartido.
          </p>
          <div className="space-y-4">
            <Button
              onClick={handleMigration}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Migrando...' : 'Iniciar Migración'}
            </Button>
            
            {result && (
              <div className={`p-3 rounded-md ${result.startsWith('✅') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                {result}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 