'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import getProductosVendedor from "@/app/services/api"

interface Producto {
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
}

export default function ProductosVendedor() {
  const [productos, setProductos] = useState<Producto[]>([])
  const params = useParams()
  const id = params.id as string

  useEffect(() => {
    const fetchProductos = async () => {
      try {
        const response = await getProductosVendedor(id)
        setProductos(response.data)
      } catch (error) {
        console.error('Error al obtener productos:', error)
      }
    }
    fetchProductos()
  }, [id])

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Productos del Vendedor</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Cantidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productos.map((producto) => (
                <TableRow key={producto.id}>
                  <TableCell>{producto.nombre}</TableCell>
                  <TableCell>${producto.precio.toFixed(2)}</TableCell>
                  <TableCell>{producto.cantidad}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
