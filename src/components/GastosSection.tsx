'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Search, ArrowUpDown, Loader2, Calendar, DollarSign, TrendingDown, FileText, Building2, Plus, Trash2 } from "lucide-react"
import { GastoBalance } from '@/types'
import { getGastosCombinados, createGasto, deleteGasto } from '@/app/services/api'
import { toast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

interface GastoCombinado {
    fecha: string;
    gastos: Array<{
        nombre: string;
        cantidad: number;
        tipo: 'balance' | 'directo';
        balanceId?: string;
        fechaInicio?: string;
        fechaFin?: string;
        gastoId?: string;
        fechaCreacion?: string;
    }>;
    total: number;
}

export default function GastosSection() {
    const [gastosPorDia, setGastosPorDia] = useState<GastoCombinado[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
    const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())

    // Estados para el formulario de nuevo gasto
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [nuevoGasto, setNuevoGasto] = useState({ nombre: '', cantidad: '' })
    const [creatingGasto, setCreatingGasto] = useState(false)

    const fetchGastos = useCallback(async () => {
        try {
            setLoading(true)
            const data = await getGastosCombinados()

            // Ordenar según el sortOrder
            const gastosOrdenados = [...data].sort((a, b) => {
                const fechaA = new Date(a.fecha.split('/').reverse().join('-'))
                const fechaB = new Date(b.fecha.split('/').reverse().join('-'))
                return sortOrder === 'desc'
                    ? fechaB.getTime() - fechaA.getTime()
                    : fechaA.getTime() - fechaB.getTime()
            })

            setGastosPorDia(gastosOrdenados)
        } catch (error) {
            console.error('Error al cargar gastos:', error)
            toast({
                title: "Error",
                description: "No se pudieron cargar los gastos",
                variant: "destructive",
            })
        } finally {
            setLoading(false)
        }
    }, [sortOrder])

    useEffect(() => {
        fetchGastos()
    }, [fetchGastos])

    const handleSort = () => {
        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    }

    const toggleDayExpansion = (fecha: string) => {
        setExpandedDays(prev => {
            const newSet = new Set(prev)
            if (newSet.has(fecha)) {
                newSet.delete(fecha)
            } else {
                newSet.add(fecha)
            }
            return newSet
        })
    }

    const handleCreateGasto = async () => {
        if (!nuevoGasto.nombre || !nuevoGasto.cantidad) {
            toast({
                title: "Error",
                description: "Todos los campos son obligatorios",
                variant: "destructive",
            })
            return
        }

        try {
            setCreatingGasto(true)
            await createGasto({
                nombre: nuevoGasto.nombre,
                cantidad: parseFloat(nuevoGasto.cantidad)
            })

            toast({
                title: "Éxito",
                description: "Gasto creado correctamente",
            })

            setNuevoGasto({ nombre: '', cantidad: '' })
            setIsDialogOpen(false)
            fetchGastos()
        } catch (error) {
            toast({
                title: "Error",
                description: "No se pudo crear el gasto",
                variant: "destructive",
            })
        } finally {
            setCreatingGasto(false)
        }
    }

    const handleDeleteGasto = async (gastoId: string) => {
        if (!confirm('¿Estás seguro de que quieres eliminar este gasto?')) {
            return
        }

        try {
            await deleteGasto(gastoId)
            toast({
                title: "Éxito",
                description: "Gasto eliminado correctamente",
            })
            fetchGastos()
        } catch (error) {
            toast({
                title: "Error",
                description: "No se pudo eliminar el gasto",
                variant: "destructive",
            })
        }
    }

    const filteredGastosPorDia = gastosPorDia.filter(dia =>
        dia.gastos.some(gasto =>
            gasto.nombre.toLowerCase().includes(searchTerm.toLowerCase())
        )
    ).map(dia => ({
        ...dia,
        gastos: dia.gastos.filter(gasto =>
            gasto.nombre.toLowerCase().includes(searchTerm.toLowerCase())
        )
    }))

    const totalGeneral = gastosPorDia.reduce((sum, dia) => sum + dia.total, 0)
    const totalGastosDirectos = gastosPorDia.reduce((sum, dia) =>
        sum + dia.gastos.filter(g => g.tipo === 'directo').length, 0
    )
    const totalGastosBalance = gastosPorDia.reduce((sum, dia) =>
        sum + dia.gastos.filter(g => g.tipo === 'balance').length, 0
    )

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
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-orange-800">Gastos del Sistema</CardTitle>
                            <p className="text-sm text-gray-600">
                                Gastos registrados directamente y desde balances financieros
                            </p>
                        </div>

                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-orange-600 hover:bg-orange-700">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Nuevo Gasto
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Crear Nuevo Gasto</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                    <div>
                                        <Label htmlFor="nombre">Nombre del Gasto</Label>
                                        <Input
                                            id="nombre"
                                            value={nuevoGasto.nombre}
                                            onChange={(e) => setNuevoGasto(prev => ({ ...prev, nombre: e.target.value }))}
                                            placeholder="Ej: Alquiler, Servicios, etc."
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="cantidad">Cantidad</Label>
                                        <Input
                                            id="cantidad"
                                            type="number"
                                            step="0.01"
                                            value={nuevoGasto.cantidad}
                                            onChange={(e) => setNuevoGasto(prev => ({ ...prev, cantidad: e.target.value }))}
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <Button
                                            variant="outline"
                                            onClick={() => setIsDialogOpen(false)}
                                            disabled={creatingGasto}
                                        >
                                            Cancelar
                                        </Button>
                                        <Button
                                            onClick={handleCreateGasto}
                                            disabled={creatingGasto}
                                            className="bg-orange-600 hover:bg-orange-700"
                                        >
                                            {creatingGasto ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    Creando...
                                                </>
                                            ) : (
                                                'Crear Gasto'
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>


                    {/* Controles de búsqueda y ordenamiento */}
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <Input
                                placeholder="Buscar gastos..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSort}
                            className="flex items-center gap-1"
                        >
                            Fecha
                            <ArrowUpDown className="h-3 w-3" />
                            <span className="text-xs ml-1">
                                ({sortOrder === 'desc' ? 'Reciente' : 'Antiguo'})
                            </span>
                        </Button>
                    </div>
                </CardHeader>

                <CardContent>
                    {filteredGastosPorDia.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <TrendingDown className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                            <p className="text-lg font-medium">No hay gastos registrados</p>
                            <p className="text-sm">
                                {searchTerm
                                    ? 'No se encontraron gastos que coincidan con la búsqueda'
                                    : 'Los gastos pueden registrarse directamente o desde balances financieros'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredGastosPorDia.map((dia) => {
                                const isExpanded = expandedDays.has(dia.fecha)

                                return (
                                    <div key={dia.fecha} className="border rounded-lg overflow-hidden">
                                        <div
                                            className="p-4 cursor-pointer hover:bg-gray-50 transition-colors bg-white"
                                            onClick={() => toggleDayExpansion(dia.fecha)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-gray-400">
                                                        {isExpanded ? '▼' : '▶'}
                                                    </span>
                                                    <div>
                                                        <h3 className="font-semibold text-gray-900">{dia.fecha}</h3>
                                                        <p className="text-sm text-gray-600">
                                                            {dia.gastos.length} gasto{dia.gastos.length !== 1 ? 's' : ''}
                                                            <span className="ml-2 text-xs">
                                                                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded mr-1">
                                                                    Balance: {dia.gastos.filter(g => g.tipo === 'balance').length}
                                                                </span>
                                                                <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                                                                    Directo: {dia.gastos.filter(g => g.tipo === 'directo').length}
                                                                </span>
                                                            </span>
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-lg font-bold text-red-600">
                                                        ${dia.total.toFixed(2)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="border-t bg-gray-50">
                                                <div className="p-4 space-y-2">
                                                    {dia.gastos.map((gasto, index) => (
                                                        <div
                                                            key={`${gasto.tipo}-${gasto.balanceId || gasto.gastoId}-${index}`}
                                                            className="flex items-center justify-between p-3 bg-white rounded border hover:bg-gray-50 transition-colors"
                                                        >
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <p className="font-medium text-gray-900">{gasto.nombre}</p>
                                                                    {gasto.tipo === 'balance' ? (
                                                                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded flex items-center gap-1">
                                                                            <Building2 className="h-3 w-3" />
                                                                            Balance
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded flex items-center gap-1">
                                                                            <FileText className="h-3 w-3" />
                                                                            Directo
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                                                    {gasto.tipo === 'balance' ? (
                                                                        <>
                                                                            <span></span>

                                                                        </>
                                                                    ) : (
                                                                        <span>
                                                                            
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className="font-semibold text-red-600">
                                                                    ${Number(gasto.cantidad).toFixed(2)}
                                                                </span>
                                                                {gasto.tipo === 'directo' && gasto.gastoId && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            handleDeleteGasto(gasto.gastoId!)
                                                                        }}
                                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                )}
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
        </div>
    )
}
