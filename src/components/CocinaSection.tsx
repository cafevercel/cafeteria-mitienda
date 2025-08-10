'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Minus, Search, ArrowUpDown, Loader2 } from "lucide-react"
import { format, parseISO, isValid } from 'date-fns'
import { es } from 'date-fns/locale'
import { ProductoCocina, Transaccion, Producto } from '@/types'
import { getProductosCocina, reducirProductoCocina, getTransacciones, getInventario, enviarProductoAAlmacen, enviarProductoACafeteria } from '@/app/services/api'
import { toast } from "@/hooks/use-toast"

interface ActionDialogState {
    isOpen: boolean;
    producto: ProductoCocina | null;
}

interface ReduceDialogState {
    isOpen: boolean;
    producto: ProductoCocina | null;
    cantidadAReducir: number;
    parametrosAReducir: Record<string, number>;
}

interface SendDialogState {
    isOpen: boolean;
    producto: ProductoCocina | null;
    destino: 'Cafeteria' | 'Almacen' | '';
    cantidadAEnviar: number;
    parametrosAEnviar: Record<string, number>;
}

const formatDate = (dateString: string): string => {
    try {
        const date = parseISO(dateString)
        if (!isValid(date)) {
            return 'Fecha inválida'
        }
        return format(date, 'dd/MM/yyyy HH:mm', { locale: es })
    } catch (error) {
        console.error(`Error formatting date: ${dateString}`, error)
        return 'Error en fecha'
    }
}

export default function CocinaSection() {
    const [productos, setProductos] = useState<ProductoCocina[]>([])
    const [transacciones, setTransacciones] = useState<Transaccion[]>([])
    const [productosInventario, setProductosInventario] = useState<Producto[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingTransacciones, setLoadingTransacciones] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [searchTermTransacciones, setSearchTermTransacciones] = useState("")
    const [sortBy, setSortBy] = useState<'nombre' | 'cantidad'>('nombre')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
    const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})
    const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())

    // Estados para los diálogos
    const [actionDialog, setActionDialog] = useState<ActionDialogState>({
        isOpen: false,
        producto: null
    })

    const [reduceDialog, setReduceDialog] = useState<ReduceDialogState>({
        isOpen: false,
        producto: null,
        cantidadAReducir: 0,
        parametrosAReducir: {}
    })

    const [sendDialog, setSendDialog] = useState<SendDialogState>({
        isOpen: false,
        producto: null,
        destino: '',
        cantidadAEnviar: 0,
        parametrosAEnviar: {}
    })

    const [processingReduce, setProcessingReduce] = useState(false)
    const [processingSend, setProcessingSend] = useState(false)

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

    const fetchTransacciones = useCallback(async () => {
        try {
            setLoadingTransacciones(true)
            const [transaccionesData, inventarioData] = await Promise.all([
                getTransacciones(), // ← Obtiene TODAS las transacciones
                getInventario()
            ])

            // ✅ NUEVO FILTRO: Solo transacciones donde es_cocina es TRUE
            const transaccionesCocina = transaccionesData.filter(
                (transaccion: Transaccion) => transaccion.es_cocina === true
            )

            setTransacciones(transaccionesCocina) // ← Solo guarda las que tienen es_cocina = true
            setProductosInventario(inventarioData)
        } catch (error) {
            console.error('Error al cargar transacciones:', error)
            toast({
                title: "Error",
                description: "No se pudieron cargar las transacciones",
                variant: "destructive",
            })
        } finally {
            setLoadingTransacciones(false)
        }
    }, [])

    useEffect(() => {
        fetchProductosCocina()
        fetchTransacciones()
    }, [fetchProductosCocina, fetchTransacciones])

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

    // Abrir diálogo de selección de acción
    const openActionDialog = (producto: ProductoCocina) => {
        setActionDialog({
            isOpen: true,
            producto
        })
    }

    const closeActionDialog = () => {
        setActionDialog({
            isOpen: false,
            producto: null
        })
    }

    // Abrir diálogo de reducción (gastar)
    const openReduceDialog = (producto: ProductoCocina) => {
        setReduceDialog({
            isOpen: true,
            producto,
            cantidadAReducir: 0,
            parametrosAReducir: {}
        })
        closeActionDialog()
    }

    const closeReduceDialog = () => {
        setReduceDialog({
            isOpen: false,
            producto: null,
            cantidadAReducir: 0,
            parametrosAReducir: {}
        })
    }

    // Abrir diálogo de envío
    const openSendDialog = (producto: ProductoCocina) => {
        setSendDialog({
            isOpen: true,
            producto,
            destino: '',
            cantidadAEnviar: 0,
            parametrosAEnviar: {}
        })
        closeActionDialog()
    }

    const closeSendDialog = () => {
        setSendDialog({
            isOpen: false,
            producto: null,
            destino: '',
            cantidadAEnviar: 0,
            parametrosAEnviar: {}
        })
    }

    // Manejar reducción de producto (gastar)
    const handleReduceProduct = async () => {
        if (!reduceDialog.producto) return

        const { producto, cantidadAReducir, parametrosAReducir } = reduceDialog

        try {
            setProcessingReduce(true)

            let totalCantidad = cantidadAReducir
            let parametrosArray: Array<{ nombre: string; cantidad: number }> | undefined

            if (producto.tiene_parametros && producto.parametros) {
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

    // Manejar envío de producto
    // Manejar envío de producto
    const handleSendProduct = async () => {
        if (!sendDialog.producto || !sendDialog.destino) return

        const { producto, destino, cantidadAEnviar, parametrosAEnviar } = sendDialog

        try {
            setProcessingSend(true)

            let totalCantidad = cantidadAEnviar
            let parametrosArray: Array<{ nombre: string; cantidad: number }> | undefined

            if (producto.tiene_parametros && producto.parametros) {
                parametrosArray = Object.entries(parametrosAEnviar)
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

            if (destino === 'Almacen') {
                await enviarProductoAAlmacen(
                    producto.id,
                    totalCantidad,
                    parametrosArray
                )
            } else if (destino === 'Cafeteria') {
                await enviarProductoACafeteria(
                    producto.id,
                    totalCantidad,
                    parametrosArray
                )
            }

            await fetchProductosCocina()

            toast({
                title: "Éxito",
                description: `Se envió ${totalCantidad} unidades de ${producto.nombre} a ${destino}`,
            })

            closeSendDialog()

        } catch (error) {
            console.error('Error al enviar producto:', error)
            toast({
                title: "Error",
                description: "No se pudo enviar el producto",
                variant: "destructive",
            })
        } finally {
            setProcessingSend(false)
        }
    }


    const calcularCantidadTotal = (producto: ProductoCocina) => {
        if (producto.tiene_parametros && producto.parametros) {
            return producto.parametros.reduce((sum, param) => sum + param.cantidad, 0)
        }
        return producto.cantidad
    }

    const getProductName = (productoId: string) => {
        const producto = productosInventario.find(p => p.id === productoId || p.id.toString() === productoId)
        return producto?.nombre || `${productoId}`
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

    const filteredTransacciones = transacciones.filter((transaccion) => {
        if (!searchTermTransacciones.trim()) return true

        const nombreProducto = getProductName(transaccion.producto)
        const searchLower = searchTermTransacciones.toLowerCase()

        return (
            nombreProducto.toLowerCase().includes(searchLower) ||
            transaccion.tipo.toLowerCase().includes(searchLower) ||
            formatDate(transaccion.fecha).includes(searchTermTransacciones) ||
            transaccion.producto.toString().toLowerCase().includes(searchLower) ||
            transaccion.desde.toLowerCase().includes(searchLower)
        )
    })

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-orange-800">Gestión de Cocina</CardTitle>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="productos" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="productos">Productos</TabsTrigger>
                            <TabsTrigger value="transacciones">Transacciones</TabsTrigger>
                        </TabsList>

                        {/* Pestaña de Productos */}
                        <TabsContent value="productos" className="space-y-4">
                            {/* Barra de búsqueda para productos */}
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

                            {loading ? (
                                <div className="flex justify-center items-center h-64">
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                </div>
                            ) : filteredAndSortedProducts.length === 0 ? (
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

                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            openActionDialog(producto)
                                                        }}
                                                        disabled={sinStock}
                                                        className="flex-shrink-0"
                                                    >
                                                        <Minus className="h-4 w-4" />
                                                    </Button>
                                                </div>

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
                        </TabsContent>

                        {/* Pestaña de Transacciones */}
                        <TabsContent value="transacciones" className="space-y-4">
                            {/* Barra de búsqueda para transacciones */}
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                <Input
                                    placeholder="Buscar transacciones..."
                                    value={searchTermTransacciones}
                                    onChange={(e) => setSearchTermTransacciones(e.target.value)}
                                    className="pl-10"
                                />
                            </div>

                            {loadingTransacciones ? (
                                <div className="flex justify-center items-center h-64">
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                </div>
                            ) : filteredTransacciones.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <p className="text-lg font-medium">No hay transacciones hacia cocina</p>
                                    <p className="text-sm">
                                        {searchTermTransacciones ? 'No se encontraron transacciones que coincidan con la búsqueda' : 'No se han registrado transacciones hacia cocina'}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
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
                                                            <p className="text-xs text-gray-500">
                                                                Desde: {transaccion.desde}
                                                            </p>
                                                            <p className="text-xs text-gray-500">
                                                                Precio: ${Number(transaccion.precio).toFixed(2)}
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
                                                            <span className={`text-xs px-2 py-1 rounded-full ${transaccion.tipo === 'Entrega' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                                }`}>
                                                                {transaccion.tipo}
                                                            </span>
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                {formatDate(transaccion.fecha)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Dialog para seleccionar acción */}
            <Dialog open={actionDialog.isOpen} onOpenChange={(open) => !open && closeActionDialog()}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Seleccionar acción - {actionDialog.producto?.nombre}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3">
                        <Button
                            onClick={() => openReduceDialog(actionDialog.producto!)}
                            className="w-full"
                            variant="destructive"
                        >
                            Gastar
                        </Button>

                        <Button
                            onClick={() => openSendDialog(actionDialog.producto!)}
                            className="w-full"
                            variant="outline"
                        >
                            Enviar a:
                        </Button>

                        <Button
                            onClick={closeActionDialog}
                            className="w-full"
                            variant="secondary"
                        >
                            Cancelar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Dialog para reducir producto (gastar) */}
            <Dialog open={reduceDialog.isOpen} onOpenChange={(open) => !open && closeReduceDialog()}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Gastar - {reduceDialog.producto?.nombre}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {reduceDialog.producto?.tiene_parametros && reduceDialog.producto.parametros ? (
                            <div className="space-y-3">
                                <p className="text-sm text-gray-600">Especifique la cantidad a gastar para cada parámetro:</p>
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
                                    Total a gastar: {Object.values(reduceDialog.parametrosAReducir).reduce((a, b) => a + b, 0)}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    Cantidad a gastar:
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
                                    'Confirmar Gasto'
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Dialog para enviar producto */}
            <Dialog open={sendDialog.isOpen} onOpenChange={(open) => !open && closeSendDialog()}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Enviar - {sendDialog.producto?.nombre}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Selector de destino */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Enviar a:
                            </label>
                            <Select
                                value={sendDialog.destino}
                                onValueChange={(value: 'Cafeteria' | 'Almacen') =>
                                    setSendDialog(prev => ({ ...prev, destino: value }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar destino" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Cafeteria">Cafetería</SelectItem>
                                    <SelectItem value="Almacen">Almacén</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Cantidad a enviar */}
                        {sendDialog.producto?.tiene_parametros && sendDialog.producto.parametros ? (
                            <div className="space-y-3">
                                <p className="text-sm text-gray-600">Especifique la cantidad a enviar para cada parámetro:</p>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {sendDialog.producto.parametros
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
                                                    value={sendDialog.parametrosAEnviar[parametro.nombre] || 0}
                                                    onChange={(e) => {
                                                        const value = Math.max(0, Math.min(Number(e.target.value), parametro.cantidad))
                                                        setSendDialog(prev => ({
                                                            ...prev,
                                                            parametrosAEnviar: {
                                                                ...prev.parametrosAEnviar,
                                                                [parametro.nombre]: value
                                                            }
                                                        }))
                                                    }}
                                                />
                                            </div>
                                        ))}
                                </div>
                                <div className="text-sm text-gray-600">
                                    Total a enviar: {Object.values(sendDialog.parametrosAEnviar).reduce((a, b) => a + b, 0)}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    Cantidad a enviar:
                                </label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={sendDialog.producto?.cantidad || 0}
                                    value={sendDialog.cantidadAEnviar}
                                    onChange={(e) => {
                                        const value = Math.max(0, Math.min(Number(e.target.value), sendDialog.producto?.cantidad || 0))
                                        setSendDialog(prev => ({
                                            ...prev,
                                            cantidadAEnviar: value
                                        }))
                                    }}
                                    placeholder="Ingrese la cantidad"
                                />
                                <p className="text-sm text-gray-500">
                                    Disponible: {sendDialog.producto?.cantidad || 0}
                                </p>
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-4">
                            <Button
                                variant="outline"
                                onClick={closeSendDialog}
                                disabled={processingSend}
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleSendProduct}
                                disabled={
                                    processingSend ||
                                    !sendDialog.destino ||
                                    (sendDialog.producto?.tiene_parametros
                                        ? Object.values(sendDialog.parametrosAEnviar).reduce((a, b) => a + b, 0) <= 0
                                        : sendDialog.cantidadAEnviar <= 0)
                                }
                            >
                                {processingSend ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Enviando...
                                    </>
                                ) : (
                                    'Confirmar Envío'
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
