'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Search, ArrowUpDown, Loader2, Calendar, TrendingDown, FileText, Building2, Trash2 } from "lucide-react"
import { getGastosCombinados, deleteGasto } from '@/app/services/api'
import { toast } from "@/hooks/use-toast"

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
        origenId?: string;
        fechaCreacion?: string;
        metadata?: {
            gastoId?: string;
            balanceId?: string;
            fechaInicio?: string;
            fechaFin?: string;
        };
    }>;
    total: number;
}

// ✅ Componente para mostrar un gasto individual
const GastoItem: React.FC<{
    gasto: GastoCombinado['gastos'][0];
    onDelete: (gastoId: string) => void;
}> = ({ gasto, onDelete }) => {

    // ✅ Obtener el ID del gasto de manera más robusta
    const gastoId = gasto.gastoId || gasto.metadata?.gastoId || gasto.origenId;
    const canDelete = gasto.tipo === 'directo' && gastoId;

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!gastoId) return;

        if (confirm('¿Estás seguro de que quieres eliminar este gasto?')) {
            onDelete(gastoId);
        }
    };

    return (
        <div className="flex items-center justify-between p-3 bg-white rounded border hover:bg-gray-50 transition-colors">
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
                            Cocina
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                    {gasto.tipo === 'balance' && gasto.fechaInicio && gasto.fechaFin && (
                        <span>
                            Período: {new Date(gasto.fechaInicio).toLocaleDateString('es-ES')} - {new Date(gasto.fechaFin).toLocaleDateString('es-ES')}
                        </span>
                    )}
                    {gasto.fechaCreacion && (
                        <span>
                            <Calendar className="h-3 w-3 inline mr-1" />
                            {new Date(gasto.fechaCreacion).toLocaleString('es-ES')}
                        </span>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-3">
                <span className="font-semibold text-red-600">
                    ${Number(gasto.cantidad).toFixed(2)}
                </span>
                {canDelete && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDelete}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Eliminar gasto"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    );
};

// ✅ Componente para el header del día
const DayHeader: React.FC<{
    dia: GastoCombinado;
    isExpanded: boolean;
    onToggle: () => void;
}> = ({ dia, isExpanded, onToggle }) => (
    <div
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors bg-white"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggle();
            }
        }}
    >
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <span className="text-gray-400" aria-hidden="true">
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
                                Cocina: {dia.gastos.filter(g => g.tipo === 'directo').length}
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
);

// ✅ Custom hook para manejar gastos
const useGastos = (sortOrder: 'asc' | 'desc') => {
    const [gastosPorDia, setGastosPorDia] = useState<GastoCombinado[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchGastos = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getGastosCombinados();

            const gastosOrdenados = [...data].sort((a, b) => {
                const fechaA = new Date(a.fecha.split('/').reverse().join('-'));
                const fechaB = new Date(b.fecha.split('/').reverse().join('-'));
                return sortOrder === 'desc'
                    ? fechaB.getTime() - fechaA.getTime()
                    : fechaA.getTime() - fechaB.getTime();
            });

            setGastosPorDia(gastosOrdenados);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error desconocido';
            console.error('Error al cargar gastos:', error);
            toast({
                title: "Error",
                description: `No se pudieron cargar los gastos: ${message}`,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    }, [sortOrder]);

    return { gastosPorDia, loading, fetchGastos };
};

export default function GastosSection() {
    const [searchTerm, setSearchTerm] = useState("");
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

    // ✅ Usar el custom hook
    const { gastosPorDia, loading, fetchGastos } = useGastos(sortOrder);

    useEffect(() => {
        fetchGastos();
    }, [fetchGastos]);

    const handleSort = () => {
        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    };

    const toggleDayExpansion = (fecha: string) => {
        setExpandedDays(prev => {
            const newSet = new Set(prev);
            if (newSet.has(fecha)) {
                newSet.delete(fecha);
            } else {
                newSet.add(fecha);
            }
            return newSet;
        });
    };

    // ✅ Función mejorada para eliminar gastos
    // En GastosSection - Actualizar la función handleDeleteGasto
    const handleDeleteGasto = async (gastoId: string) => {
        try {
            const response = await deleteGasto(gastoId);

            // ✅ Mostrar información detallada del resultado
            const message = response.cantidadDevuelta
                ? `Gasto eliminado y cantidad devuelta a cocina: ${JSON.stringify(response.cantidadDevuelta)}`
                : "Gasto eliminado correctamente";

            toast({
                title: "Éxito",
                description: message,
            });

            fetchGastos(); // Recargar los datos
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error desconocido';
            console.error('Error al eliminar gasto:', error);
            toast({
                title: "Error",
                description: `No se pudo eliminar el gasto: ${message}`,
                variant: "destructive",
            });
        }
    };


    // ✅ Optimizar filtrado con useMemo
    const filteredGastosPorDia = useMemo(() => {
        if (!searchTerm.trim()) return gastosPorDia;

        const searchLower = searchTerm.toLowerCase();
        return gastosPorDia.filter(dia =>
            dia.gastos.some(gasto =>
                gasto.nombre.toLowerCase().includes(searchLower)
            )
        ).map(dia => ({
            ...dia,
            gastos: dia.gastos.filter(gasto =>
                gasto.nombre.toLowerCase().includes(searchLower)
            )
        }));
    }, [gastosPorDia, searchTerm]);

    // ✅ Calcular estadísticas con useMemo
    const estadisticas = useMemo(() => {
        const totalGeneral = gastosPorDia.reduce((sum, dia) => sum + dia.total, 0);
        const totalGastosDirectos = gastosPorDia.reduce((sum, dia) =>
            sum + dia.gastos.filter(g => g.tipo === 'directo').length, 0
        );
        const totalGastosBalance = gastosPorDia.reduce((sum, dia) =>
            sum + dia.gastos.filter(g => g.tipo === 'balance').length, 0
        );

        return { totalGeneral, totalGastosDirectos, totalGastosBalance };
    }, [gastosPorDia]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2 text-gray-600">Cargando gastos...</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-orange-800">Gastos del Sistema</CardTitle>
                            <p className="text-sm text-gray-600 mt-1">
                                Gastos registrados directamente y desde balances financieros
                            </p>
                            {/* ✅ Mostrar estadísticas */}
                            <div className="flex gap-4 mt-2 text-sm text-gray-500">
                                <span>Total: ${estadisticas.totalGeneral.toFixed(2)}</span>
                                <span>Directos: {estadisticas.totalGastosDirectos}</span>
                                <span>Balance: {estadisticas.totalGastosBalance}</span>
                            </div>
                        </div>
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
                                const isExpanded = expandedDays.has(dia.fecha);

                                return (
                                    <div key={dia.fecha} className="border rounded-lg overflow-hidden">
                                        <DayHeader
                                            dia={dia}
                                            isExpanded={isExpanded}
                                            onToggle={() => toggleDayExpansion(dia.fecha)}
                                        />

                                        {isExpanded && (
                                            <div className="border-t bg-gray-50">
                                                <div className="p-4 space-y-2">
                                                    {dia.gastos.map((gasto, index) => (
                                                        <GastoItem
                                                            key={`${gasto.tipo}-${gasto.gastoId || gasto.origenId || gasto.metadata?.gastoId}-${index}`}
                                                            gasto={gasto}
                                                            onDelete={handleDeleteGasto}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
