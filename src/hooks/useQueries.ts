'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  getAllVentas, 
  getInventario, 
  deleteSale, 
  entregarProducto, 
  editarProducto,
  getVendedores,
  getProductosCompartidos
} from '@/app/services/api'
import { Producto, Venta } from '@/types'
import { toast } from '@/hooks/use-toast'

// Hook para obtener todas las ventas
export function useVentas() {
  return useQuery({
    queryKey: ['ventas'],
    queryFn: getAllVentas,
  })
}

// Hook para obtener el inventario
export function useInventario() {
  return useQuery({
    queryKey: ['inventario'],
    queryFn: getInventario,
  })
}

// Hook para obtener vendedores
export function useVendedores() {
  return useQuery({
    queryKey: ['vendedores'],
    queryFn: getVendedores,
  })
}

// Hook para obtener productos compartidos
export function useProductosCompartidos() {
  return useQuery({
    queryKey: ['productos-compartidos'],
    queryFn: getProductosCompartidos,
  })
}

// Hook para eliminar una venta
export function useDeleteSale() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, vendedorId }: { id: string, vendedorId: string }) => 
      deleteSale(id, vendedorId),
    onSuccess: () => {
      // Invalidar consultas relacionadas para forzar una recarga
      queryClient.invalidateQueries({ queryKey: ['ventas'] })
      queryClient.invalidateQueries({ queryKey: ['inventario'] })
      
      toast({
        title: "Venta eliminada",
        description: "La venta ha sido eliminada y las cantidades devueltas al inventario",
      })
    },
    onError: (error) => {
      console.error('Error al eliminar la venta:', error)
      toast({
        title: "Error",
        description: "No se pudo eliminar la venta",
        variant: "destructive",
      })
    }
  })
}

// Hook para entregar un producto
export function useEntregarProducto() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ 
      productoId, 
      cantidad, 
      parametros 
    }: { 
      productoId: string, 
      cantidad: number, 
      parametros?: Array<{ nombre: string; cantidad: number }> 
    }) => 
      entregarProducto(productoId, cantidad, parametros),
    onSuccess: () => {
      // Invalidar consultas relacionadas
      queryClient.invalidateQueries({ queryKey: ['inventario'] })
      queryClient.invalidateQueries({ queryKey: ['productos-compartidos'] })
      
      toast({
        title: "Producto entregado",
        description: "El producto ha sido entregado correctamente",
      })
    },
    onError: (error) => {
      console.error('Error al entregar el producto:', error)
      toast({
        title: "Error",
        description: "No se pudo entregar el producto",
        variant: "destructive",
      })
    }
  })
}

// Hook para editar un producto
export function useEditarProducto() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ 
      producto, 
      imageUrl 
    }: { 
      producto: Producto, 
      imageUrl?: string 
    }) => {
      const formData = new FormData()
      formData.append('nombre', producto.nombre)
      formData.append('precio', producto.precio.toString())
      formData.append('cantidad', producto.cantidad.toString())
      if (producto.precio_compra !== undefined) {
        formData.append('precio_compra', producto.precio_compra.toString())
      }
      if (producto.porcentajeGanancia !== undefined) {
        formData.append('porcentajeGanancia', producto.porcentajeGanancia.toString())
      }
      formData.append('tiene_parametros', producto.tieneParametros ? 'true' : 'false')
      
      if (producto.parametros && producto.parametros.length > 0) {
        formData.append('parametros', JSON.stringify(producto.parametros))
      }
      
      if (imageUrl) {
        formData.append('fotoUrl', imageUrl)
      }
      
      return editarProducto(producto.id, formData)
    },
    onSuccess: () => {
      // Invalidar consultas relacionadas
      queryClient.invalidateQueries({ queryKey: ['inventario'] })
      queryClient.invalidateQueries({ queryKey: ['productos-compartidos'] })
      
      toast({
        title: "Producto actualizado",
        description: "El producto ha sido actualizado correctamente",
      })
    },
    onError: (error) => {
      console.error('Error al editar el producto:', error)
      toast({
        title: "Error",
        description: "No se pudo actualizar el producto",
        variant: "destructive",
      })
    }
  })
}