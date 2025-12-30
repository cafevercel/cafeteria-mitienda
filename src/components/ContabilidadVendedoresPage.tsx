'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Calendar,
  Calculator,
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  User,
  ChevronDown,
  ChevronUp,
  Plus
} from "lucide-react"
import { format, startOfDay, endOfDay, isAfter, isBefore, isEqual } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "@/hooks/use-toast"
import { Vendedor, CalculoContabilidadVendedor } from '@/types'
import GastosVendedorDialog from './GastosVendedorDialog'
import { cn } from "@/lib/utils"
import { getContabilidadVendedores } from '@/app/services/api'

interface ContabilidadVendedoresPageProps {
  vendedores: Vendedor[]
  onRefresh: () => void
}

export default function ContabilidadVendedoresPage({ vendedores, onRefresh }: ContabilidadVendedoresPageProps) {
  const [fechaInicio, setFechaInicio] = useState<Date | null>(null)
  const [fechaFin, setFechaFin] = useState<Date | null>(null)
  const [showDatePicker, setShowDatePicker] = useState<'inicio' | 'fin' | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [calculos, setCalculos] = useState<CalculoContabilidadVendedor[]>([])
  const [expandedSellers, setExpandedSellers] = useState<Set<string>>(new Set())
  const [showGastosDialog, setShowGastosDialog] = useState(false)
  const [selectedVendedor, setSelectedVendedor] = useState<Vendedor | null>(null)
  const [filtroVendedor, setFiltroVendedor] = useState('')

  const handleDateSelect = (type: 'inicio' | 'fin', date: Date | undefined) => {
    if (type === 'inicio') {
      setFechaInicio(date || null)
    } else {
      setFechaFin(date || null)
    }
    setShowDatePicker(null)
  }

  const handleCalcular = async () => {
    if (!fechaInicio || !fechaFin) {
      toast({
        title: "Error",
        description: "Debe seleccionar un rango de fechas",
        variant: "destructive",
      })
      return
    }

    if (isAfter(fechaInicio, fechaFin)) {
      toast({
        title: "Error",
        description: "La fecha de inicio debe ser anterior a la fecha fin",
        variant: "destructive",
      })
      return
    }

    setIsCalculating(true)
    try {
      const fechaInicioStr = format(fechaInicio, 'yyyy-MM-dd')
      const fechaFinStr = format(fechaFin, 'yyyy-MM-dd')

      const data = await getContabilidadVendedores(fechaInicioStr, fechaFinStr)
      setCalculos(data)
      toast({
        title: "Éxito",
        description: "Cálculos completados correctamente",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron realizar los cálculos",
        variant: "destructive",
      })
    } finally {
      setIsCalculating(false)
    }
  }

  const toggleSellerExpansion = (vendedorId: string) => {
    const newExpanded = new Set(expandedSellers)
    if (newExpanded.has(vendedorId)) {
      newExpanded.delete(vendedorId)
    } else {
      newExpanded.add(vendedorId)
    }
    setExpandedSellers(newExpanded)
  }

  const handleGastosClick = (vendedor: Vendedor) => {
    setSelectedVendedor(vendedor)
    setShowGastosDialog(true)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CU', {
      style: 'currency',
      currency: 'CUP',
      minimumFractionDigits: 2
    }).format(value)
  }

  const getDaysInRange = () => {
    if (!fechaInicio || !fechaFin) return 0
    const diffTime = fechaFin.getTime() - fechaInicio.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
  }

  const filteredVendedores = vendedores.filter(vendedor =>
    vendedor.nombre.toLowerCase().includes(filtroVendedor.toLowerCase())
  )

  const filteredCalculos = calculos.filter(calculo =>
    filtroVendedor === '' ||
    calculo.vendedorNombre.toLowerCase().includes(filtroVendedor.toLowerCase())
  )

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
          Contabilidad de Vendedores
        </h2>
      </div>

      {/* Date Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Seleccionar Período
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <Label htmlFor="fecha-inicio" className="text-sm">Fecha de Inicio</Label>
              <Popover open={showDatePicker === 'inicio'} onOpenChange={(open) => setShowDatePicker(open ? 'inicio' : null)}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal text-sm",
                      !fechaInicio && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    <span className="truncate">
                      {fechaInicio ? format(fechaInicio, "PPP", { locale: es }) : "Seleccionar fecha"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={fechaInicio || undefined}
                    onSelect={(date) => handleDateSelect('inicio', date)}
                    disabled={(date) => date < startOfDay(new Date(2000, 0, 1))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label htmlFor="fecha-fin" className="text-sm">Fecha Fin</Label>
              <Popover open={showDatePicker === 'fin'} onOpenChange={(open) => setShowDatePicker(open ? 'fin' : null)}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal text-sm",
                      !fechaFin && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    <span className="truncate">
                      {fechaFin ? format(fechaFin, "PPP", { locale: es }) : "Seleccionar fecha"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={fechaFin || undefined}
                    onSelect={(date) => handleDateSelect('fin', date)}
                    disabled={(date) => {
                      const isBefore2000 = date < startOfDay(new Date(2000, 0, 1))
                      const isBeforeStart = fechaInicio ? date < startOfDay(fechaInicio) : false
                      return isBefore2000 || isBeforeStart
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="sm:col-span-2 lg:col-span-1">
              <Button
                onClick={handleCalcular}
                disabled={isCalculating || !fechaInicio || !fechaFin}
                className="w-full"
                size="sm"
              >
                <Calculator className="mr-2 h-4 w-4" />
                <span className="text-sm">
                  {isCalculating ? 'Calculando...' : 'Calcular'}
                </span>
              </Button>
            </div>
          </div>

          {fechaInicio && fechaFin && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Período seleccionado:</strong> {format(fechaInicio, "PPP", { locale: es })} - {format(fechaFin, "PPP", { locale: es })}
                <br />
                <strong>Total de días:</strong> {getDaysInRange()} días
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sellers List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            Lista de Vendedores
          </CardTitle>
          <div className="mt-4">
            <Input
              placeholder="Filtrar vendedores..."
              value={filtroVendedor}
              onChange={(e) => setFiltroVendedor(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredVendedores.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {filtroVendedor ? 'No se encontraron vendedores con ese filtro' : 'No hay vendedores registrados'}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredVendedores.map((vendedor) => (
                <div
                  key={vendedor.id}
                  className="p-3 sm:p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <User className="h-5 w-5 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-sm sm:text-base break-words">{vendedor.nombre}</h3>
                        {vendedor.telefono && (
                          <p className="text-xs sm:text-sm text-gray-500 break-words">{vendedor.telefono}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end sm:justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleGastosClick(vendedor)}
                        className="w-full sm:w-auto"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Gastos
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {calculos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Resultados de Cálculos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredCalculos.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No hay resultados para mostrar
              </div>
            ) : (
              <div className="space-y-4">
                {filteredCalculos.map((calculo) => {
                  const isExpanded = expandedSellers.has(calculo.vendedorId)
                  return (
                    <div key={calculo.vendedorId} className="border rounded-lg overflow-hidden">
                      <div
                        className="p-4 cursor-pointer hover:bg-gray-50"
                        onClick={() => toggleSellerExpansion(calculo.vendedorId)}
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <h3 className="font-medium text-lg truncate">{calculo.vendedorNombre}</h3>
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 flex-shrink-0" />
                              ) : (
                                <ChevronDown className="h-4 w-4 flex-shrink-0" />
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="text-center sm:text-left">
                              <p className="text-xs sm:text-sm text-gray-500">Venta Total</p>
                              <p className="font-medium text-sm sm:text-base break-words">{formatCurrency(calculo.ventaTotal)}</p>
                            </div>
                            <div className="text-center sm:text-right">
                              <p className="text-xs sm:text-sm text-gray-500">Resultado</p>
                              <p className={cn(
                                "font-medium text-sm sm:text-base break-words",
                                calculo.resultado >= 0 ? "text-green-600" : "text-red-600"
                              )}>
                                {formatCurrency(calculo.resultado)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t bg-gray-50 p-3 sm:p-4">
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
                            <div className="text-center p-2 sm:p-3 bg-white rounded-lg">
                              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 mx-auto mb-1" />
                              <p className="text-xs sm:text-sm text-gray-500">Venta Total</p>
                              <p className="font-medium text-xs sm:text-sm break-words">{formatCurrency(calculo.ventaTotal)}</p>
                            </div>
                            <div className="text-center p-2 sm:p-3 bg-white rounded-lg">
                              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 mx-auto mb-1" />
                              <p className="text-xs sm:text-sm text-gray-500">Ganancia Bruta</p>
                              <p className="font-medium text-green-600 text-xs sm:text-sm break-words">{formatCurrency(calculo.gananciaBruta)}</p>
                            </div>
                            <div className="text-center p-2 sm:p-3 bg-white rounded-lg">
                              <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 mx-auto mb-1" />
                              <p className="text-xs sm:text-sm text-gray-500">Gastos</p>
                              <p className="font-medium text-red-600 text-xs sm:text-sm break-words">{formatCurrency(calculo.gastos)}</p>
                            </div>
                            <div className="text-center p-2 sm:p-3 bg-white rounded-lg">
                              <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 mx-auto mb-1" />
                              <p className="text-xs sm:text-sm text-gray-500">Salario</p>
                              <p className="font-medium text-red-600 text-xs sm:text-sm break-words">{formatCurrency(calculo.salario)}</p>
                            </div>
                          </div>

                          <Separator className="my-4" />

                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
                            {/* Sales Detail */}
                            <div>
                              <h4 className="font-medium mb-3 flex items-center gap-2 text-sm sm:text-base">
                                <FileText className="h-4 w-4" />
                                Detalle de Ventas
                              </h4>
                              <div className="space-y-2 max-h-60 overflow-y-auto">
                                {calculo.detalles.ventas.length === 0 ? (
                                  <p className="text-xs sm:text-sm text-gray-500 italic">No hay ventas en este período</p>
                                ) : (
                                  calculo.detalles.ventas.map((venta, index) => (
                                    <div key={index} className="p-2 sm:p-3 bg-white rounded border">
                                      <div className="space-y-1">
                                        <p className="font-medium text-xs sm:text-sm break-words">{venta.producto}</p>
                                        <p className="text-xs text-gray-500">
                                          {venta.cantidad} × {formatCurrency(venta.precioVenta)}
                                        </p>
                                        <div className="flex justify-between items-center pt-1">
                                          <p className="text-xs text-gray-500">
                                            Costo: {formatCurrency(venta.precioCompra)}
                                          </p>
                                          <p className="font-medium text-xs sm:text-sm">{formatCurrency(venta.gananciaProducto)}</p>
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>

                            {/* Expenses Detail */}
                            <div>
                              <h4 className="font-medium mb-3 flex items-center gap-2 text-sm sm:text-base">
                                <TrendingDown className="h-4 w-4" />
                                Desglose de Gastos
                              </h4>
                              <div className="space-y-2 max-h-60 overflow-y-auto">
                                {calculo.detalles.gastosDesglosados.length === 0 ? (
                                  <p className="text-xs sm:text-sm text-gray-500 italic">No hay gastos registrados</p>
                                ) : (
                                  calculo.detalles.gastosDesglosados.map((gasto, index) => (
                                    <div key={index} className="p-2 sm:p-3 bg-white rounded border">
                                      <div className="space-y-1">
                                        <p className="font-medium text-xs sm:text-sm break-words">{gasto.nombre}</p>
                                        <p className="text-xs text-gray-500">
                                          {formatCurrency(gasto.valorMensual)}/mes
                                        </p>
                                        <div className="flex justify-between items-center pt-1">
                                          <Badge variant="secondary" className="text-xs">
                                            {gasto.diasSeleccionados} días
                                          </Badge>
                                          <p className="font-medium text-xs sm:text-sm text-red-600">
                                            {formatCurrency(gasto.valorProrrateado)}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
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
      )}

      {/* Global Accounting Summary */}
      {calculos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Resumen Global de Contabilidad
            </CardTitle>
            <div className="mt-2">
              <p className="text-sm text-gray-500">
                Período: {fechaInicio && fechaFin ? `${format(fechaInicio, "PPP", { locale: es })} - ${format(fechaFin, "PPP", { locale: es })}` : ''}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {/* Calculate global totals */}
            {(() => {
              const totalVentaGlobal = filteredCalculos.reduce((sum, calc) => sum + calc.ventaTotal, 0)
              const totalGananciaBrutaGlobal = filteredCalculos.reduce((sum, calc) => sum + calc.gananciaBruta, 0)
              const totalGastosGlobal = filteredCalculos.reduce((sum, calc) => sum + calc.gastos, 0)
              const totalSalariosGlobal = filteredCalculos.reduce((sum, calc) => sum + calc.salario, 0)
              const resultadoGlobal = filteredCalculos.reduce((sum, calc) => sum + calc.resultado, 0)

              return (
                <div className="space-y-6">
                  {/* Main totals grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                    <div className="text-center p-3 sm:p-4 bg-blue-50 rounded-lg border">
                      <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500 mx-auto mb-2" />
                      <p className="text-xs sm:text-sm text-gray-600 font-medium">Venta Total Global</p>
                      <p className="font-bold text-sm sm:text-lg text-blue-600 break-words">{formatCurrency(totalVentaGlobal)}</p>
                    </div>
                    <div className="text-center p-3 sm:p-4 bg-green-50 rounded-lg border">
                      <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-green-500 mx-auto mb-2" />
                      <p className="text-xs sm:text-sm text-gray-600 font-medium">Ganancia Bruta Global</p>
                      <p className="font-bold text-sm sm:text-lg text-green-600 break-words">{formatCurrency(totalGananciaBrutaGlobal)}</p>
                    </div>
                    <div className="text-center p-3 sm:p-4 bg-red-50 rounded-lg border">
                      <TrendingDown className="h-5 w-5 sm:h-6 sm:w-6 text-red-500 mx-auto mb-2" />
                      <p className="text-xs sm:text-sm text-gray-600 font-medium">Gastos Totales</p>
                      <p className="font-bold text-sm sm:text-lg text-red-600 break-words">{formatCurrency(totalGastosGlobal)}</p>
                    </div>
                    <div className="text-center p-3 sm:p-4 bg-red-50 rounded-lg border">
                      <TrendingDown className="h-5 w-5 sm:h-6 sm:w-6 text-red-500 mx-auto mb-2" />
                      <p className="text-xs sm:text-sm text-gray-600 font-medium">Salarios Totales</p>
                      <p className="font-bold text-sm sm:text-lg text-red-600 break-words">{formatCurrency(totalSalariosGlobal)}</p>
                    </div>
                    <div className="text-center p-3 sm:p-4 bg-gray-50 rounded-lg border sm:col-span-2 lg:col-span-1">
                      <Calculator className="h-5 w-5 sm:h-6 sm:w-6 text-gray-500 mx-auto mb-2" />
                      <p className="text-xs sm:text-sm text-gray-600 font-medium">Resultado Final</p>
                      <p className={cn(
                        "font-bold text-sm sm:text-lg break-words",
                        resultadoGlobal >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {formatCurrency(resultadoGlobal)}
                      </p>
                    </div>
                  </div>

                  {/* Summary statistics */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Vendedores Analizados</p>
                      <p className="text-2xl font-bold text-gray-800">{filteredCalculos.length}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Venta Promedio por Vendedor</p>
                      <p className="text-lg font-semibold text-gray-800 break-words">
                        {filteredCalculos.length > 0 ? formatCurrency(totalVentaGlobal / filteredCalculos.length) : formatCurrency(0)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Margen de Ganancia</p>
                      <p className={cn(
                        "text-lg font-semibold break-words",
                        totalVentaGlobal > 0 ? (totalGananciaBrutaGlobal / totalVentaGlobal >= 0.3 ? "text-green-600" : "text-yellow-600") : "text-gray-600"
                      )}>
                        {totalVentaGlobal > 0 ? `${((totalGananciaBrutaGlobal / totalVentaGlobal) * 100).toFixed(1)}%` : '0%'}
                      </p>
                    </div>
                  </div>

                  {/* Additional financial insights */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm sm:text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Análisis Financiero Adicional
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-white rounded border">
                        <p className="text-xs sm:text-sm text-gray-600">Gastos como % de Ventas</p>
                        <p className="font-semibold text-sm sm:text-base text-red-600">
                          {totalVentaGlobal > 0 ? `${((totalGastosGlobal / totalVentaGlobal) * 100).toFixed(1)}%` : '0%'}
                        </p>
                      </div>
                      <div className="p-3 bg-white rounded border">
                        <p className="text-xs sm:text-sm text-gray-600">Salarios como % de Ventas</p>
                        <p className="font-semibold text-sm sm:text-base text-red-600">
                          {totalVentaGlobal > 0 ? `${((totalSalariosGlobal / totalVentaGlobal) * 100).toFixed(1)}%` : '0%'}
                        </p>
                      </div>
                      <div className="p-3 bg-white rounded border">
                        <p className="text-xs sm:text-sm text-gray-600">Margen de Ganancia Neto</p>
                        <p className={cn(
                          "font-semibold text-sm sm:text-base",
                          totalVentaGlobal > 0 ? (resultadoGlobal / totalVentaGlobal >= 0.15 ? "text-green-600" :
                            resultadoGlobal / totalVentaGlobal >= 0 ? "text-yellow-600" : "text-red-600") : "text-gray-600"
                        )}>
                          {totalVentaGlobal > 0 ? `${((resultadoGlobal / totalVentaGlobal) * 100).toFixed(1)}%` : '0%'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </CardContent>
        </Card>
      )}

      {/* Gastos Vendedor Dialog */}
      {selectedVendedor && (
        <GastosVendedorDialog
          isOpen={showGastosDialog}
          onClose={() => {
            setShowGastosDialog(false)
            setSelectedVendedor(null)
            onRefresh()
          }}
          onRefresh={onRefresh}
          vendedor={selectedVendedor}
        />
      )}
    </div>
  )
}