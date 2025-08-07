'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Minus, Search, ArrowUpDown, Loader2 } from "lucide-react"
import { ProductoCocina } from '@/types'
import { getProductosCocina, reducirProductoCocina } from '@/app/services/api'
import { toast } from "@/hooks/use-toast"

interface ReduceDialogState {
    isOpen: boolean;
    producto: ProductoCocina | null;
    cantidadAReducir: number;
    parametrosAReducir: Record<string, number>;
}

export default function CocinaSection() {
    const [productos, setProductos] = useState<ProductoCocina[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [sortBy, setSortBy] = useState<'nombre' | 'cantidad'>('nombre')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
    const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})
    const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
    const [reduceDialog, setReduceDialog] = useState<ReduceDialogState>({
        isOpen: false,
        producto: null,
        cantidadAReducir: 0,
        parametrosAReducir: {}
    })
    const [processingReduce, setProcessingReduce] = useState(false)

    const fetchProductosCocina = useCallback(async () => {
        try {
            setLoading(true)
            const data = await getProductosCocina()
            setProductos(data)
        } catch (error) {
            console.error('Error al cargar productos de cocina:', error)
            toast({
                title: "Error",
                description: "No se pudieron cargar los productos de cocina",
                variant: "destructive",
            })
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchProductosCocina()
    }, [fetchProductosCocina])

    const handleSort = (key: 'nombre' | 'cantidad') => {
        if (sortBy === key) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortBy(key)
            setSortOrder('asc')
        }
    }

    const toggleProductExpansion = (productId: string) => {
        setExpandedProducts(prev => {
            const newSet = new Set(prev)
            if (newSet.has(productId)) {
                newSet.delete(productId)
            } else {
                newSet.add(productId)
            }
            return newSet
        })
    }

    const openReduceDialog = (producto: ProductoCocina) => {
        setReduceDialog({
            isOpen: true,
            producto,
            cantidadAReducir: 0,
            parametrosAReducir: {}
        })
    }

    const closeReduceDialog = () => {
        setReduceDialog({
            isOpen: false,
            producto: null,
            cantidadAReducir: 0,
            parametrosAReducir: {}
        })
    }

    const handleReduceProduct = async () => {
        if (!reduceDialog.producto) return

        const { producto, cantidadAReducir, parametrosAReducir } = reduceDialog

        try {
            setProcessingReduce(true)

            let totalCantidad = cantidadAReducir
            let parametrosArray: Array<{ nombre: string; cantidad: number }> | undefined

            if (producto.tiene_parametros && producto.parametros) {
                // Para productos con parámetros
                parametrosArray = Object.entries(parametrosAReducir)
                    .filter(([_, cantidad]) => cantidad > 0)
                    .map(([nombre, cantidad]) => ({ nombre, cantidad }))

                totalCantidad = parametrosArray.reduce((sum, p) => sum + p.cantidad, 0)
            }

            if (totalCantidad <= 0) {
                toast({
                    title: "Error",
                    description: "Debe especificar una cantidad mayor a 0",
                    variant: "destructive",
                })
                return
            }

            await reducirProductoCocina(
                producto.id,
                totalCantidad,
                parametrosArray
            )

            // Actualizar la lista de productos
            await fetchProductosCocina()

            toast({
                title: "Éxito",
                description: `Se redujo ${totalCantidad} unidades de ${producto.nombre} y se registró el gasto`,
            })

            closeReduceDialog()

        } catch (error) {
            console.error('Error al reducir producto:', error)
            toast({
                title: "Error",
                description: "No se pudo reducir el producto",
                variant: "destructive",
            })
        } finally {
            setProcessingReduce(false)
        }
    }

    const calcularCantidadTotal = (producto: ProductoCocina) => {
        if (producto.tiene_parametros && producto.parametros) {
            return producto.parametros.reduce((sum, param) => sum + param.cantidad, 0)
        }
        return producto.cantidad
    }

    const filteredAndSortedProducts = productos
        .filter(producto =>
            producto.nombre.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            if (sortBy === 'nombre') {
                return sortOrder === 'asc'
                    ? a.nombre.localeCompare(b.nombre)
                    : b.nombre.localeCompare(a.nombre)
            } else {
                const cantidadA = calcularCantidadTotal(a)
                const cantidadB = calcularCantidadTotal(b)
                return sortOrder === 'asc'
                    ? cantidadA - cantidadB
                    : cantidadB - cantidadA
            }
        })

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-orange-800">Productos en Cocina</CardTitle>

                    {/* Barra de búsqueda */}
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <Input
                                placeholder="Buscar productos..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>

                        {/* Botones de ordenamiento */}
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSort('nombre')}
                                className="flex items-center gap-1"
                            >
                                Nombre
                                <ArrowUpDown className="h-3 w-3" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSort('cantidad')}
                                className="flex items-center gap-1"
                            >
                                Cantidad
                                <ArrowUpDown className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent>
                    {filteredAndSortedProducts.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <p className="text-lg font-medium">No hay productos en cocina</p>
                            <p className="text-sm">No se encontraron productos que coincidan con la búsqueda</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredAndSortedProducts.map((producto) => {
                                const cantidadTotal = calcularCantidadTotal(producto)
                                const isExpanded = expandedProducts.has(producto.id)
                                const tieneParametros = producto.tiene_parametros && producto.parametros && producto.parametros.length > 0
                                const sinStock = cantidadTotal === 0

                                return (
                                    <div
                                        key={producto.id}
                                        className={`border rounded-lg p-3 ${sinStock ? 'bg-red-50 border-red-200' : 'bg-white'}`}
                                    >
                                        <div
                                            className={`flex items-center gap-3 ${tieneParametros ? 'cursor-pointer' : ''}`}
                                            onClick={() => tieneParametros && toggleProductExpansion(producto.id)}
                                        >
                                            {/* Imagen del producto */}
                                            <div className="w-12 h-12 relative rounded-md overflow-hidden flex-shrink-0">
                                                <Image
                                                    src={imageErrors[producto.id] ? '/placeholder.svg' : (producto.foto || '/placeholder.svg')}
                                                    alt={producto.nombre}
                                                    fill
                                                    className="object-cover"
                                                    onError={() => {
                                                        setImageErrors(prev => ({
                                                            ...prev,
                                                            [producto.id]: true
                                                        }))
                                                    }}
                                                />
                                            </div>

                                            {/* Información del producto */}
                                            <div className="flex-1 min-w-0">
                                                <h3 className={`font-medium ${sinStock ? 'text-red-600' : 'text-gray-900'}`}>
                                                    {producto.nombre}
                                                </h3>
                                                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                                                    <span>Precio: ${Number(producto.precio).toFixed(2)}</span>
                                                    <span className={sinStock ? 'text-red-600 font-semibold' : ''}>
                                                        Cantidad: {cantidadTotal}
                                                    </span>
                                                </div>
                                                {tieneParametros && (
                                                    <p className="text-xs text-blue-500">
                                                        {isExpanded ? 'Ocultar parámetros' : 'Ver parámetros'} ({producto.parametros?.length || 0})
                                                    </p>
                                                )}
                                            </div>

                                            {/* Botón de reducir */}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    openReduceDialog(producto)
                                                }}
                                                disabled={sinStock}
                                                className="flex-shrink-0"
                                            >
                                                <Minus className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        {/* Parámetros expandidos */}
                                        {isExpanded && tieneParametros && (
                                            <div className="mt-3 pl-15 border-t pt-3">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {producto.parametros?.map((parametro, idx) => (
                                                        <div key={idx} className="bg-gray-50 p-2 rounded border">
                                                            <div className="font-medium text-sm">{parametro.nombre}</div>
                                                            <div className={`text-sm ${parametro.cantidad === 0 ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>
                                                                Cantidad: {parametro.cantidad}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Dialog para reducir producto */}
            <Dialog open={reduceDialog.isOpen} onOpenChange={(open) => !open && closeReduceDialog()}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Reducir cantidad - {reduceDialog.producto?.nombre}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {reduceDialog.producto?.tiene_parametros && reduceDialog.producto.parametros ? (
                            <div className="space-y-3">
                                <p className="text-sm text-gray-600">Especifique la cantidad a reducir para cada parámetro:</p>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {reduceDialog.producto.parametros
                                        .filter(param => param.cantidad > 0)
                                        .map((parametro, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2 border rounded">
                                                <div>
                                                    <p className="font-medium text-sm">{parametro.nombre}</p>
                                                    <p className="text-xs text-gray-500">Disponible: {parametro.cantidad}</p>
                                                </div>
                                                <Input
                                                    type="number"
                                                    className="w-20"
                                                    min={0}
                                                    max={parametro.cantidad}
                                                    value={reduceDialog.parametrosAReducir[parametro.nombre] || 0}
                                                    onChange={(e) => {
                                                        const value = Math.max(0, Math.min(Number(e.target.value), parametro.cantidad))
                                                        setReduceDialog(prev => ({
                                                            ...prev,
                                                            parametrosAReducir: {
                                                                ...prev.parametrosAReducir,
                                                                [parametro.nombre]: value
                                                            }
                                                        }))
                                                    }}
                                                />
                                            </div>
                                        ))}
                                </div>
                                <div className="text-sm text-gray-600">
                                    Total a reducir: {Object.values(reduceDialog.parametrosAReducir).reduce((a, b) => a + b, 0)}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    Cantidad a reducir:
                                </label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={reduceDialog.producto?.cantidad || 0}
                                    value={reduceDialog.cantidadAReducir}
                                    onChange={(e) => {
                                        const value = Math.max(0, Math.min(Number(e.target.value), reduceDialog.producto?.cantidad || 0))
                                        setReduceDialog(prev => ({
                                            ...prev,
                                            cantidadAReducir: value
                                        }))
                                    }}
                                    placeholder="Ingrese la cantidad"
                                />
                                <p className="text-sm text-gray-500">
                                    Disponible: {reduceDialog.producto?.cantidad || 0}
                                </p>
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-4">
                            <Button
                                variant="outline"
                                onClick={closeReduceDialog}
                                disabled={processingReduce}
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleReduceProduct}
                                disabled={
                                    processingReduce ||
                                    (reduceDialog.producto?.tiene_parametros
                                        ? Object.values(reduceDialog.parametrosAReducir).reduce((a, b) => a + b, 0) <= 0
                                        : reduceDialog.cantidadAReducir <= 0)
                                }
                            >
                                {processingReduce ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Procesando...
                                    </>
                                ) : (
                                    'Confirmar Reducción'
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
