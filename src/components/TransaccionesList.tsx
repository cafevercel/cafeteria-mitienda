'use client'

import { useState, useEffect, useMemo } from 'react'
import { format, parseISO, isValid } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card } from "@/components/ui/card"
import { Transaccion, Producto } from '@/types'
import { getInventario } from '@/app/services/api'

interface TransaccionesListProps {
  transacciones: Transaccion[]
  searchTerm: string
  vendedorId: string
}

const formatDate = (dateString: string): string => {
  try {
    const date = parseISO(dateString)
    if (!isValid(date)) {
      return 'Fecha inválida'
    }
    return format(date, 'dd/MM/yyyy', { locale: es })
  } catch (error) {
    console.error(`Error formatting date: ${dateString}`, error)
    return 'Error en fecha'
  }
}

export default function TransaccionesList({ transacciones, searchTerm, vendedorId }: TransaccionesListProps) {
  const [productos, setProductos] = useState<Producto[]>([])

  useEffect(() => {
    const fetchProductos = async () => {
      try {
        const inventario = await getInventario()
        const productosConvertidos = inventario.map(p => ({
          ...p,
          foto: p.foto || null
        })) as unknown as Producto[]
        setProductos(productosConvertidos)
      } catch (error) {
        console.error('Error al cargar productos:', error)
      }
    }

    fetchProductos()
  }, [])

  // Función para obtener el nombre del producto
  const getProductName = (productoId: string) => {
    const producto = productos.find(p => p.id === productoId || p.id.toString() === productoId)
    return producto?.nombre || productoId
  }

  const filteredTransacciones = useMemo(() => {
    console.log('🔍 Total transacciones recibidas:', transacciones.length)

    // ✅ FILTRO CORREGIDO - Solo comparar con boolean
    const transaccionesSinCocina = transacciones.filter((transaccion) => {
      const esCocina = transaccion.es_cocina

      console.log(`🔍 Transacción ${transaccion.id}:`, {
        es_cocina: esCocina,
        tipo_es_cocina: typeof esCocina,
        hacia: transaccion.hacia,
        desde: transaccion.desde
      })

      // ✅ SOLO COMPARAR CON BOOLEAN
      return esCocina !== true
    })

    console.log('🔍 Transacciones después del filtro:', transaccionesSinCocina.length)

    if (!searchTerm.trim()) return transaccionesSinCocina

    // Aplicar búsqueda
    return transaccionesSinCocina.filter((transaccion) => {
      const nombreProducto = getProductName(transaccion.producto)
      const searchLower = searchTerm.toLowerCase()

      return (
        nombreProducto.toLowerCase().includes(searchLower) ||
        transaccion.tipo.toLowerCase().includes(searchLower) ||
        formatDate(transaccion.fecha).includes(searchTerm) ||
        transaccion.producto.toString().toLowerCase().includes(searchLower) ||
        (transaccion.parametros && transaccion.parametros.some(param =>
          param.nombre.toLowerCase().includes(searchLower)
        ))
      )
    })
  }, [transacciones, searchTerm, productos])



  if (filteredTransacciones.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">
          {searchTerm ? 'No se encontraron transacciones que coincidan con la búsqueda' : 'No hay transacciones registradas'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {filteredTransacciones.map((transaccion) => (
        <Card key={transaccion.id} className="p-4">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-sm">
                    {getProductName(transaccion.producto)}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Cantidad: {transaccion.cantidad}
                  </p>
                  {transaccion.parametros && transaccion.parametros.length > 0 && (
                    <div className="mt-1">
                      <p className="text-xs text-gray-500">Parámetros:</p>
                      <ul className="text-xs text-gray-500 list-disc list-inside">
                        {transaccion.parametros.map((param, idx) => (
                          <li key={idx}>
                            {param.nombre}: {param.cantidad}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-1 rounded-full ${transaccion.tipo === 'Entrega'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                    }`}>
                    {transaccion.tipo}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">{formatDate(transaccion.fecha)}</p>
                  <p className="text-xs text-gray-400">
                    {transaccion.desde} → {transaccion.hacia}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
