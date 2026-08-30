'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { format, startOfWeek, endOfWeek, isValid } from "date-fns"
import { es } from 'date-fns/locale'
import { Calendar as CalendarIcon, Banknote, CreditCard, DollarSign, User, Loader2 } from "lucide-react"

interface VentaDiaria {
  vendedor_id: string;
  vendedor_nombre: string;
  total_ventas: number | string | null;
  total_efectivo?: number | string | null;
  total_transferencia?: number | string | null;
}

interface VentaSemanal {
  week_start: string;
  week_end: string;
  vendedor_id: string;
  vendedor_nombre: string;
  total_ventas: number | string | null;
  total_efectivo?: number | string | null;
  total_transferencia?: number | string | null;
}

interface VentasSemana {
  fechaInicio: string;
  fechaFin: string;
  ventas: VentaSemanal[];
}

interface SalesSectionProps {
  userRole: 'Almacen' | 'Vendedor';
}

const parseLocalDate = (dateString: string): Date => {
  let dateOnly: string;

  if (dateString.includes('T')) {
    dateOnly = dateString.split('T')[0];
  } else if (dateString.includes(' ')) {
    dateOnly = dateString.split(' ')[0];
  } else {
    dateOnly = dateString;
  }

  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export default function SalesSection({ userRole }: SalesSectionProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [ventasDiarias, setVentasDiarias] = useState<VentaDiaria[]>([])
  const [ventasSemanales, setVentasSemanales] = useState<VentasSemana[]>([])
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const obtenerVentasDelDia = useCallback(async (fecha: Date) => {
    setIsLoading(true)
    setError(null)

    try {
      const formattedDate = format(fecha, 'yyyy-MM-dd')
      const response = await fetch(`/api/ventas-diarias?fecha=${formattedDate}&role=${userRole}`)

      if (!response.ok) {
        throw new Error('Error al obtener las ventas diarias')
      }

      const data: VentaDiaria[] = await response.json()
      setVentasDiarias(data)
    } catch (error) {
      console.error('Error al obtener ventas diarias:', error)
      setError('Error al obtener las ventas diarias. Por favor, intenta de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }, [userRole])

  const agruparVentasPorSemana = useCallback((ventas: VentaSemanal[]) => {
    const weekMap = new Map<string, VentasSemana>()

    ventas.forEach((venta) => {
      const weekStart = parseLocalDate(venta.week_start)
      const weekEnd = parseLocalDate(venta.week_end)

      if (!isValid(weekStart) || !isValid(weekEnd)) {
        console.error(`Invalid date in venta: ${venta.week_start} - ${venta.week_end}`)
        return
      }

      const weekEndWithTime = new Date(weekEnd)
      weekEndWithTime.setHours(23, 59, 59, 999)

      const weekKey = `${format(weekStart, 'yyyy-MM-dd')}_${format(weekEnd, 'yyyy-MM-dd')}`

      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, {
          fechaInicio: format(weekStart, 'yyyy-MM-dd'),
          fechaFin: format(weekEnd, 'yyyy-MM-dd'),
          ventas: []
        })
      }

      const currentWeek = weekMap.get(weekKey)!
      currentWeek.ventas.push({
        ...venta,
        week_start: format(weekStart, 'yyyy-MM-dd'),
        week_end: format(weekEndWithTime, 'yyyy-MM-dd')
      })
    })

    return Array.from(weekMap.values()).sort((a, b) => {
      const dateA = parseLocalDate(a.fechaInicio)
      const dateB = parseLocalDate(b.fechaInicio)
      return isValid(dateB) && isValid(dateA) ? dateB.getTime() - dateA.getTime() : 0
    })
  }, [])

  const obtenerVentasSemanales = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const today = new Date()
      const startDate = startOfWeek(today, { weekStartsOn: 1 })
      const endDate = endOfWeek(today, { weekStartsOn: 1 })

      const response = await fetch(
        `/api/ventas-semanales?role=${userRole}&startDate=${format(startDate, 'yyyy-MM-dd')}&endDate=${format(endDate, 'yyyy-MM-dd')}`
      )

      if (!response.ok) {
        throw new Error('Error al obtener las ventas semanales')
      }

      const data: VentaSemanal[] = await response.json()
      const ventasAgrupadasPorSemana = agruparVentasPorSemana(data)

      setVentasSemanales(ventasAgrupadasPorSemana)

      if (ventasAgrupadasPorSemana.length > 0 && !selectedWeek) {
        setSelectedWeek(`${ventasAgrupadasPorSemana[0].fechaInicio},${ventasAgrupadasPorSemana[0].fechaFin}`)
      }
    } catch (error) {
      console.error('Error al obtener ventas semanales:', error)
      setError('Error al obtener las ventas semanales. Por favor, intenta de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }, [selectedWeek, agruparVentasPorSemana, userRole])

  useEffect(() => {
    obtenerVentasSemanales()
  }, [obtenerVentasSemanales])

  const handleMostrarVentasDiarias = () => {
    if (selectedDate) {
      obtenerVentasDelDia(selectedDate)
    }
  }

  const formatTotalVentas = (total: number | string | null | undefined): string => {
    if (total === null || total === undefined) return '$0.00'
    const numTotal = typeof total === 'string' ? parseFloat(total) : total
    return isNaN(numTotal) ? '$0.00' : `$${numTotal.toFixed(2)}`
  }

  const totalVentasDiarias = ventasDiarias.reduce((sum, venta) => {
    const ventaTotal = typeof venta.total_ventas === 'string' ? parseFloat(venta.total_ventas) : (venta.total_ventas || 0)
    return sum + (isNaN(ventaTotal) ? 0 : ventaTotal)
  }, 0)

  const totalEfectivoDiario = ventasDiarias.reduce((sum, venta) => {
    const efTotal = typeof venta.total_efectivo === 'string' ? parseFloat(venta.total_efectivo) : (venta.total_efectivo || 0)
    return sum + (isNaN(efTotal) ? 0 : efTotal)
  }, 0)

  const totalTransferenciaDiario = ventasDiarias.reduce((sum, venta) => {
    const trTotal = typeof venta.total_transferencia === 'string' ? parseFloat(venta.total_transferencia) : (venta.total_transferencia || 0)
    return sum + (isNaN(trTotal) ? 0 : trTotal)
  }, 0)

  const ventasSemanalesFiltradas = selectedWeek
    ? ventasSemanales.find(semana => `${semana.fechaInicio},${semana.fechaFin}` === selectedWeek)?.ventas || []
    : []

  const totalVentasSemanales = ventasSemanalesFiltradas.reduce((sum, venta) => {
    const ventaTotal = typeof venta.total_ventas === 'string' ? parseFloat(venta.total_ventas) : (venta.total_ventas || 0)
    return sum + (isNaN(ventaTotal) ? 0 : ventaTotal)
  }, 0)

  const totalEfectivoSemanal = ventasSemanalesFiltradas.reduce((sum, venta) => {
    const efTotal = typeof venta.total_efectivo === 'string' ? parseFloat(venta.total_efectivo) : (venta.total_efectivo || 0)
    return sum + (isNaN(efTotal) ? 0 : efTotal)
  }, 0)

  const totalTransferenciaSemanal = ventasSemanalesFiltradas.reduce((sum, venta) => {
    const trTotal = typeof venta.total_transferencia === 'string' ? parseFloat(venta.total_transferencia) : (venta.total_transferencia || 0)
    return sum + (isNaN(trTotal) ? 0 : trTotal)
  }, 0)

  return (
    <Card className="w-full shadow-sm">
      <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
        <CardTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <span>📊</span>
          <span>Ventas</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-6 pt-0">
        <Tabs defaultValue="daily" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="daily" className="text-xs sm:text-sm font-medium">Por Día</TabsTrigger>
            <TabsTrigger value="weekly" className="text-xs sm:text-sm font-medium">Por Semana</TabsTrigger>
          </TabsList>

          {/* TAB: POR DÍA */}
          <TabsContent value="daily" className="space-y-4 focus-visible:outline-none">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full sm:w-[280px] justify-start text-left font-normal text-xs sm:text-sm h-10",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {selectedDate ? format(selectedDate, "PPP", { locale: es }) : "Seleccionar fecha"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Button 
                onClick={handleMostrarVentasDiarias} 
                disabled={isLoading}
                className="w-full sm:w-auto h-10 px-5 text-xs sm:text-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cargando...
                  </>
                ) : (
                  'Cargar Ventas'
                )}
              </Button>
            </div>

            {error && (
              <div className="text-red-500 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg p-3 text-xs sm:text-sm">
                {error}
              </div>
            )}

            {!isLoading && ventasDiarias.length > 0 && (
              <div className="space-y-4">
                {/* Tarjetas de Resumen General */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
                  <div className="bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800 rounded-xl p-3 sm:p-4 flex items-center justify-between shadow-xs">
                    <div>
                      <p className="text-[11px] sm:text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                        Efectivo
                      </p>
                      <p className="text-lg sm:text-2xl font-black text-emerald-800 dark:text-emerald-200 mt-0.5">
                        {formatTotalVentas(totalEfectivoDiario)}
                      </p>
                    </div>
                    <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/60 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0">
                      <Banknote className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                  </div>

                  <div className="bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800 rounded-xl p-3 sm:p-4 flex items-center justify-between shadow-xs">
                    <div>
                      <p className="text-[11px] sm:text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                        Transferencia
                      </p>
                      <p className="text-lg sm:text-2xl font-black text-blue-800 dark:text-blue-200 mt-0.5">
                        {formatTotalVentas(totalTransferenciaDiario)}
                      </p>
                    </div>
                    <div className="p-2.5 bg-blue-100 dark:bg-blue-900/60 rounded-xl text-blue-600 dark:text-blue-400 shrink-0">
                      <CreditCard className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 flex items-center justify-between shadow-xs">
                    <div>
                      <p className="text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase tracking-wide">
                        Ingresos Totales
                      </p>
                      <p className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                        {formatTotalVentas(totalVentasDiarias)}
                      </p>
                    </div>
                    <div className="p-2.5 bg-slate-200/80 dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300 shrink-0">
                      <DollarSign className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                  </div>
                </div>

                {/* VISTA MOBILE: Tarjetas por vendedor */}
                <div className="block md:hidden space-y-3">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
                    Desglose por Vendedor
                  </div>
                  {ventasDiarias.map((venta) => (
                    <div
                      key={venta.vendedor_id}
                      className="bg-white dark:bg-slate-900 border rounded-xl p-3.5 shadow-xs space-y-3"
                    >
                      <div className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400">
                            <User className="h-4 w-4" />
                          </div>
                          <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                            {venta.vendedor_nombre}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-gray-500 uppercase block">Total</span>
                          <span className="text-sm font-bold text-slate-900 dark:text-white">
                            {formatTotalVentas(venta.total_ventas)}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-lg p-2">
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium block">
                            💵 Efectivo
                          </span>
                          <span className="font-bold text-emerald-800 dark:text-emerald-300 text-sm">
                            {formatTotalVentas(venta.total_efectivo)}
                          </span>
                        </div>
                        <div className="bg-blue-50/70 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-lg p-2">
                          <span className="text-[10px] text-blue-700 dark:text-blue-400 font-medium block">
                            💳 Transferencia
                          </span>
                          <span className="font-bold text-blue-800 dark:text-blue-300 text-sm">
                            {formatTotalVentas(venta.total_transferencia)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {userRole === 'Almacen' && (
                    <div className="bg-slate-900 text-white dark:bg-slate-800 rounded-xl p-3.5 shadow-sm space-y-2 mt-3">
                      <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                        <span className="font-bold text-sm">Totales Consolidados</span>
                        <span className="font-extrabold text-base text-emerald-400">
                          {formatTotalVentas(totalVentasDiarias)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Total Efectivo</span>
                          <span className="font-bold text-emerald-400 text-sm">
                            {formatTotalVentas(totalEfectivoDiario)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Total Transferencia</span>
                          <span className="font-bold text-blue-400 text-sm">
                            {formatTotalVentas(totalTransferenciaDiario)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* VISTA DESKTOP/TABLET: Tabla completa */}
                <div className="hidden md:block rounded-xl border overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-800/60">
                      <TableRow>
                        <TableHead className="font-semibold">Vendedor</TableHead>
                        <TableHead className="text-right font-semibold">Efectivo</TableHead>
                        <TableHead className="text-right font-semibold">Transferencia</TableHead>
                        <TableHead className="text-right font-semibold">Ingresos Totales</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ventasDiarias.map((venta) => (
                        <TableRow key={venta.vendedor_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <TableCell className="font-medium text-slate-800 dark:text-slate-200">
                            {venta.vendedor_nombre}
                          </TableCell>
                          <TableCell className="text-right text-emerald-600 dark:text-emerald-400 font-semibold">
                            {formatTotalVentas(venta.total_efectivo)}
                          </TableCell>
                          <TableCell className="text-right text-blue-600 dark:text-blue-400 font-semibold">
                            {formatTotalVentas(venta.total_transferencia)}
                          </TableCell>
                          <TableCell className="text-right font-bold text-slate-900 dark:text-white">
                            {formatTotalVentas(venta.total_ventas)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {userRole === 'Almacen' && (
                        <TableRow className="font-bold bg-slate-100/80 dark:bg-slate-800 border-t-2">
                          <TableCell className="text-slate-900 dark:text-white">Total Consolidado</TableCell>
                          <TableCell className="text-right text-emerald-700 dark:text-emerald-300">
                            {formatTotalVentas(totalEfectivoDiario)}
                          </TableCell>
                          <TableCell className="text-right text-blue-700 dark:text-blue-300">
                            {formatTotalVentas(totalTransferenciaDiario)}
                          </TableCell>
                          <TableCell className="text-right text-slate-900 dark:text-white font-extrabold">
                            {formatTotalVentas(totalVentasDiarias)}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {!isLoading && ventasDiarias.length === 0 && (
              <div className="text-center text-gray-500 py-10 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl border border-dashed">
                <CalendarIcon className="mx-auto h-8 w-8 text-gray-400 mb-2 opacity-60" />
                <p className="text-sm">No hay ventas registradas para la fecha seleccionada.</p>
              </div>
            )}
          </TabsContent>

          {/* TAB: POR SEMANA */}
          <TabsContent value="weekly" className="space-y-4 focus-visible:outline-none">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-4">
              <Select value={selectedWeek || ''} onValueChange={setSelectedWeek}>
                <SelectTrigger className="w-full sm:w-[320px] text-xs sm:text-sm h-10">
                  <SelectValue placeholder="Seleccionar semana" />
                </SelectTrigger>
                <SelectContent>
                  {ventasSemanales.map((semana, index) => (
                    <SelectItem
                      key={index}
                      value={`${semana.fechaInicio},${semana.fechaFin}`}
                      className="text-xs sm:text-sm"
                    >
                      {`${format(parseLocalDate(semana.fechaInicio), 'dd/MM/yyyy', { locale: es })} - ${format(parseLocalDate(semana.fechaFin), 'dd/MM/yyyy', { locale: es })}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={obtenerVentasSemanales} 
                disabled={isLoading}
                className="w-full sm:w-auto h-10 px-5 text-xs sm:text-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cargando...
                  </>
                ) : (
                  'Cargar Ventas'
                )}
              </Button>
            </div>

            {error && (
              <div className="text-red-500 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg p-3 text-xs sm:text-sm">
                {error}
              </div>
            )}

            {!isLoading && ventasSemanales.length > 0 && selectedWeek && (
              <div className="space-y-4">
                {/* Tarjetas de Resumen General Semanal */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
                  <div className="bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800 rounded-xl p-3 sm:p-4 flex items-center justify-between shadow-xs">
                    <div>
                      <p className="text-[11px] sm:text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                        Efectivo Semanal
                      </p>
                      <p className="text-lg sm:text-2xl font-black text-emerald-800 dark:text-emerald-200 mt-0.5">
                        {formatTotalVentas(totalEfectivoSemanal)}
                      </p>
                    </div>
                    <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/60 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0">
                      <Banknote className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                  </div>

                  <div className="bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800 rounded-xl p-3 sm:p-4 flex items-center justify-between shadow-xs">
                    <div>
                      <p className="text-[11px] sm:text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                        Transferencia Semanal
                      </p>
                      <p className="text-lg sm:text-2xl font-black text-blue-800 dark:text-blue-200 mt-0.5">
                        {formatTotalVentas(totalTransferenciaSemanal)}
                      </p>
                    </div>
                    <div className="p-2.5 bg-blue-100 dark:bg-blue-900/60 rounded-xl text-blue-600 dark:text-blue-400 shrink-0">
                      <CreditCard className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 flex items-center justify-between shadow-xs">
                    <div>
                      <p className="text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase tracking-wide">
                        Ingresos Totales Semanales
                      </p>
                      <p className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                        {formatTotalVentas(totalVentasSemanales)}
                      </p>
                    </div>
                    <div className="p-2.5 bg-slate-200/80 dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300 shrink-0">
                      <DollarSign className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                  </div>
                </div>

                {/* VISTA MOBILE: Tarjetas por vendedor */}
                <div className="block md:hidden space-y-3">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
                    Desglose Semanal por Vendedor
                  </div>
                  {ventasSemanalesFiltradas.map((venta) => (
                    <div
                      key={venta.vendedor_id}
                      className="bg-white dark:bg-slate-900 border rounded-xl p-3.5 shadow-xs space-y-3"
                    >
                      <div className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400">
                            <User className="h-4 w-4" />
                          </div>
                          <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                            {venta.vendedor_nombre}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-gray-500 uppercase block">Total</span>
                          <span className="text-sm font-bold text-slate-900 dark:text-white">
                            {formatTotalVentas(venta.total_ventas)}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-lg p-2">
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium block">
                            💵 Efectivo
                          </span>
                          <span className="font-bold text-emerald-800 dark:text-emerald-300 text-sm">
                            {formatTotalVentas(venta.total_efectivo)}
                          </span>
                        </div>
                        <div className="bg-blue-50/70 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-lg p-2">
                          <span className="text-[10px] text-blue-700 dark:text-blue-400 font-medium block">
                            💳 Transferencia
                          </span>
                          <span className="font-bold text-blue-800 dark:text-blue-300 text-sm">
                            {formatTotalVentas(venta.total_transferencia)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {userRole === 'Almacen' && (
                    <div className="bg-slate-900 text-white dark:bg-slate-800 rounded-xl p-3.5 shadow-sm space-y-2 mt-3">
                      <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                        <span className="font-bold text-sm">Totales Semanales</span>
                        <span className="font-extrabold text-base text-emerald-400">
                          {formatTotalVentas(totalVentasSemanales)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Total Efectivo</span>
                          <span className="font-bold text-emerald-400 text-sm">
                            {formatTotalVentas(totalEfectivoSemanal)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Total Transferencia</span>
                          <span className="font-bold text-blue-400 text-sm">
                            {formatTotalVentas(totalTransferenciaSemanal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* VISTA DESKTOP/TABLET: Tabla completa */}
                <div className="hidden md:block rounded-xl border overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-800/60">
                      <TableRow>
                        <TableHead className="font-semibold">Vendedor</TableHead>
                        <TableHead className="text-right font-semibold">Efectivo</TableHead>
                        <TableHead className="text-right font-semibold">Transferencia</TableHead>
                        <TableHead className="text-right font-semibold">Ingresos Totales</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ventasSemanalesFiltradas.map((venta) => (
                        <TableRow key={venta.vendedor_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <TableCell className="font-medium text-slate-800 dark:text-slate-200">
                            {venta.vendedor_nombre}
                          </TableCell>
                          <TableCell className="text-right text-emerald-600 dark:text-emerald-400 font-semibold">
                            {formatTotalVentas(venta.total_efectivo)}
                          </TableCell>
                          <TableCell className="text-right text-blue-600 dark:text-blue-400 font-semibold">
                            {formatTotalVentas(venta.total_transferencia)}
                          </TableCell>
                          <TableCell className="text-right font-bold text-slate-900 dark:text-white">
                            {formatTotalVentas(venta.total_ventas)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {userRole === 'Almacen' && (
                        <TableRow className="font-bold bg-slate-100/80 dark:bg-slate-800 border-t-2">
                          <TableCell className="text-slate-900 dark:text-white">Total Consolidado</TableCell>
                          <TableCell className="text-right text-emerald-700 dark:text-emerald-300">
                            {formatTotalVentas(totalEfectivoSemanal)}
                          </TableCell>
                          <TableCell className="text-right text-blue-700 dark:text-blue-300">
                            {formatTotalVentas(totalTransferenciaSemanal)}
                          </TableCell>
                          <TableCell className="text-right text-slate-900 dark:text-white font-extrabold">
                            {formatTotalVentas(totalVentasSemanales)}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {!isLoading && ventasSemanales.length === 0 && (
              <div className="text-center text-gray-500 py-10 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl border border-dashed">
                <CalendarIcon className="mx-auto h-8 w-8 text-gray-400 mb-2 opacity-60" />
                <p className="text-sm">No hay ventas registradas para la semana seleccionada.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}