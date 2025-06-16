'use client'

import { useState, useEffect } from 'react'
import { format, parseISO, isValid } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card } from "@/components/ui/card"
import { Transaccion, Producto } from '@/types'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
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
  // Usar React Query para obtener productos
  const { data: productos = [] } = useQuery({
    queryKey: ['inventario'],
    queryFn: getInventario,
  })
  
  const getProductImage = (productoId: string) => {
    const producto = productos.find(p => p.id === productoId)
    return producto?.foto || '/product-placeholder.svg'
  }

  const filteredTransacciones = transacciones.filter(
    (transaccion) =>
      transaccion.tipo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      formatDate(transaccion.fecha).includes(searchTerm)
  )

  if (filteredTransacciones.length === 0) {
    return <div className="text-center py-4">No se encontraron transacciones</div>
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
                    {transaccion.producto}
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
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    transaccion.tipo === 'Entrega' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {transaccion.tipo}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">{formatDate(transaccion.fecha)}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}