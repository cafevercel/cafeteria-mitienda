'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  Plus,
  ArrowLeftRight,
  PieChart,
  Edit2,
  Wallet
} from "lucide-react"
import { format, startOfDay, endOfDay, isAfter } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "@/hooks/use-toast"
import { Vendedor, CalculoContabilidadVendedor } from '@/types'
import GastosVendedorDialog from './GastosVendedorDialog'
import SalariosMensualesVendedorDialog from './SalariosMensualesVendedorDialog'
import ComparativaPage from './ComparativaPage'
import { cn } from "@/lib/utils"
import { getContabilidadVendedores } from '@/app/services/api'

interface ContabilidadVendedoresPageProps {
  vendedores: Vendedor[]
  onRefresh: () => void
}

const MONTHS = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' }
]

interface DatePickerConMesesProps {
  label: string
  value: Date | null
  onChange: (date: Date) => void
}

const MONTH_SHORT_LABELS = [
  { value: 0, label: 'Ene' },
  { value: 1, label: 'Feb' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Abr' },
  { value: 4, label: 'May' },
  { value: 5, label: 'Jun' },
  { value: 6, label: 'Jul' },
  { value: 7, label: 'Ago' },
  { value: 8, label: 'Sep' },
  { value: 9, label: 'Oct' },
  { value: 10, label: 'Nov' },
  { value: 11, label: 'Dic' }
]

function DatePickerConMeses({ label, value, onChange }: DatePickerConMesesProps) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState<Date>(value || new Date())

  const currentYear = viewMonth.getFullYear()
  const currentMonthIdx = viewMonth.getMonth()

  const handleMonthClick = (monthIdx: number) => {
    setViewMonth(new Date(currentYear, monthIdx, 1))
  }

  const handleYearChange = (yearStr: string) => {
    const year = parseInt(yearStr)
    setViewMonth(new Date(year, currentMonthIdx, 1))
  }

  return (
    <div className="w-full">
      <Label className="text-xs font-semibold text-slate-700 block mb-1">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal text-xs sm:text-sm h-10 border-slate-300 shadow-xs bg-white",
              !value && "text-muted-foreground"
            )}
          >
            <Calendar className="mr-2 h-4 w-4 text-blue-600 flex-shrink-0" />
            <span className="truncate">{value ? format(value, "dd/MM/yyyy") : "Seleccionar fecha"}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[calc(100vw-2rem)] max-w-xs sm:w-80 p-2.5 sm:p-3" align="start" collisionPadding={12}>
          {/* Header con Selección de Año */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700">Mes y Año:</span>
            <Select value={currentYear.toString()} onValueChange={handleYearChange}>
              <SelectTrigger className="h-7 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                  <SelectItem key={y} value={y.toString()} className="text-xs">
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Grilla de los 12 Meses del Año */}
          <div className="grid grid-cols-4 gap-1 sm:gap-1.5 mb-2.5 bg-slate-100 p-1.5 rounded-lg">
            {MONTH_SHORT_LABELS.map((m) => {
              const isSelectedMonth = m.value === currentMonthIdx
              return (
                <Button
                  key={m.value}
                  type="button"
                  size="sm"
                  variant={isSelectedMonth ? "default" : "ghost"}
                  onClick={() => handleMonthClick(m.value)}
                  className={cn(
                    "h-7 text-xs px-0.5 font-medium transition-all",
                    isSelectedMonth ? "bg-blue-600 text-white font-bold shadow-xs" : "hover:bg-white text-slate-700"
                  )}
                >
                  {m.label}
                </Button>
              )
            })}
          </div>

          <Separator className="mb-2" />

          {/* Calendario con los días del mes elegido */}
          <div className="flex justify-center">
            <CalendarComponent
              mode="single"
              month={viewMonth}
              onMonthChange={setViewMonth}
              selected={value || undefined}
              onSelect={(d) => {
                if (d) {
                  onChange(d)
                  setOpen(false)
                }
              }}
              className="rounded-md border p-1 sm:p-2 w-full"
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default function ContabilidadVendedoresPage({ vendedores, onRefresh }: ContabilidadVendedoresPageProps) {
  const [activeTab, setActiveTab] = useState<'balance' | 'comparativa'>('balance')
  const [fechaInicio, setFechaInicio] = useState<Date | null>(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [fechaFin, setFechaFin] = useState<Date | null>(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0))
  
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())

  const [showDatePicker, setShowDatePicker] = useState<'inicio' | 'fin' | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [calculos, setCalculos] = useState<CalculoContabilidadVendedor[]>([])
  const [expandedSellers, setExpandedSellers] = useState<Set<string>>(new Set())
  const [showGastosDialog, setShowGastosDialog] = useState(false)
  const [selectedVendedor, setSelectedVendedor] = useState<Vendedor | null>(null)
  const [filtroVendedor, setFiltroVendedor] = useState('')
  const [showGastosDetalleModal, setShowGastosDetalleModal] = useState(false)

  // Diálogo para editar salario mensual del vendedor
  const [showSalarioDialog, setShowSalarioDialog] = useState(false)
  const [salarioModalData, setSalarioModalData] = useState<{ vendedorId: string; vendedorNombre: string; salario: string }>({ vendedorId: '', vendedorNombre: '', salario: '' })

  const handleQuickMonthSelect = (mes: number, anio: number) => {
    setSelectedMonth(mes)
    setSelectedYear(anio)
    const start = new Date(anio, mes - 1, 1)
    const end = new Date(anio, mes, 0)
    setFechaInicio(start)
    setFechaFin(end)
  }

  const handleCalcular = async () => {
    if (!fechaInicio || !fechaFin) {
      toast({ title: "Error", description: "Debe seleccionar un rango de fechas", variant: "destructive" })
      return
    }

    if (isAfter(fechaInicio, fechaFin)) {
      toast({ title: "Error", description: "La fecha de inicio debe ser anterior a la fecha fin", variant: "destructive" })
      return
    }

    setIsCalculating(true)
    try {
      const fechaInicioStr = format(fechaInicio, 'yyyy-MM-dd')
      const fechaFinStr = format(fechaFin, 'yyyy-MM-dd')

      const data = await getContabilidadVendedores(fechaInicioStr, fechaFinStr)
      setCalculos(data)
      toast({ title: "Éxito", description: "Cálculos completados correctamente" })
    } catch (error) {
      toast({ title: "Error", description: "No se pudieron realizar los cálculos", variant: "destructive" })
    } finally {
      setIsCalculating(false)
    }
  }

  useEffect(() => {
    handleCalcular()
  }, [])

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

  const handleOpenSalarioModal = (vendedorId: string, vendedorNombre: string, actualSalario: number) => {
    setSalarioModalData({ vendedorId, vendedorNombre, salario: actualSalario.toString() })
    setShowSalarioDialog(true)
  }

  const handleSaveSalarioMensual = async () => {
    if (!salarioModalData.salario || parseFloat(salarioModalData.salario) < 0) {
      toast({ title: 'Error', description: 'Ingrese un salario válido', variant: 'destructive' })
      return
    }
    try {
      const res = await fetch('/api/salarios-mensuales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: salarioModalData.vendedorId,
          mes: selectedMonth,
          anio: selectedYear,
          salario: parseFloat(salarioModalData.salario)
        })
      })
      if (!res.ok) throw new Error('Error al guardar salario')
      toast({ title: 'Éxito', description: 'Salario actualizado correctamente para el mes' })
      setShowSalarioDialog(false)
      handleCalcular()
    } catch (err) {
      toast({ title: 'Error', description: 'No se pudo guardar el salario', variant: 'destructive' })
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CU', { style: 'currency', currency: 'CUP', minimumFractionDigits: 2 }).format(value)
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy")
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
    filtroVendedor === '' || calculo.vendedorNombre.toLowerCase().includes(filtroVendedor.toLowerCase())
  )

  // Totales Globales
  const totalVentaGlobal = filteredCalculos.reduce((sum, calc) => sum + calc.ventaTotal, 0)
  const totalVentaEfectivoGlobal = filteredCalculos.reduce((sum, calc) => sum + calc.ventaEfectivo, 0)
  const totalVentaTransferenciaGlobal = filteredCalculos.reduce((sum, calc) => sum + calc.ventaTransferencia, 0)

  const totalGananciaBrutaGlobal = filteredCalculos.reduce((sum, calc) => sum + calc.gananciaBruta, 0)
  const totalGananciaEfectivoGlobal = filteredCalculos.reduce((sum, calc) => sum + calc.gananciaEfectivo, 0)
  const totalGananciaTransferenciaGlobal = filteredCalculos.reduce((sum, calc) => sum + calc.gananciaTransferencia, 0)

  const totalGastosFijosGlobal = filteredCalculos.reduce((sum, calc) => sum + calc.gastosFijos, 0)
  const totalGastosVariablesGlobal = filteredCalculos.reduce((sum, calc) => sum + calc.gastosVariables, 0)
  const totalGastosMermaGlobal = filteredCalculos.length > 0 ? filteredCalculos[0].gastosMerma : 0
  const totalSalariosGlobal = filteredCalculos.reduce((sum, calc) => sum + calc.salario, 0)

  const totalGastosAgrupadosGlobal = totalGastosFijosGlobal + totalGastosVariablesGlobal + totalGastosMermaGlobal + totalSalariosGlobal
  const utilidadFinalGlobal = totalGananciaBrutaGlobal - totalGastosAgrupadosGlobal

  const margenGananciaBrutoPct = totalVentaGlobal > 0 ? (totalGananciaBrutaGlobal / totalVentaGlobal) * 100 : 0
  const margenGananciaNetoPct = totalVentaGlobal > 0 ? (utilidadFinalGlobal / totalVentaGlobal) * 100 : 0

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Tab Navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 flex-shrink-0">
            <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-xl md:text-2xl font-bold text-slate-900 truncate">
              Contabilidad de Puntos de Venta
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 truncate">
              Balances financieros, utilidades y comparativas
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
          <Button
            variant={activeTab === 'balance' ? 'default' : 'outline'}
            onClick={() => setActiveTab('balance')}
            size="sm"
            className="w-full sm:w-auto text-xs sm:text-sm h-9"
          >
            <Calculator className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Balance
          </Button>
          <Button
            variant={activeTab === 'comparativa' ? 'default' : 'outline'}
            onClick={() => setActiveTab('comparativa')}
            size="sm"
            className="w-full sm:w-auto text-xs sm:text-sm h-9"
          >
            <ArrowLeftRight className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Comparativa
          </Button>
        </div>
      </div>

      {activeTab === 'comparativa' ? (
        <ComparativaPage vendedores={vendedores} />
      ) : (
        <>
          {/* Selección Rápida de Período / Solo Fecha Inicio y Fecha Fin */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="p-3.5 sm:p-5">
              <CardTitle className="text-base sm:text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                  Seleccionar Período
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 sm:p-5 pt-0 sm:pt-0">
              <div className="space-y-3 sm:space-y-4">
                {/* Solo Fecha Inicio y Fecha Fin con el Popover de los 12 meses */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200">
                  <DatePickerConMeses
                    label="Fecha de Inicio"
                    value={fechaInicio}
                    onChange={(date) => setFechaInicio(date)}
                  />
                  <DatePickerConMeses
                    label="Fecha Fin"
                    value={fechaFin}
                    onChange={(date) => setFechaFin(date)}
                  />
                </div>

                <Button
                  onClick={handleCalcular}
                  disabled={isCalculating}
                  className="w-full h-10 sm:h-11 text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-700 shadow-xs"
                >
                  <Calculator className="mr-2 h-4 w-4" />
                  {isCalculating ? 'Calculando Balance...' : 'Calcular Balance del Período'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* NUEVO SISTEMA DE BALANCE */}
          {calculos.length > 0 && (
            <Card className="border border-indigo-100 shadow-md overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-3.5 sm:p-5">
                <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2">
                  <CardTitle className="text-base sm:text-xl font-bold flex items-center gap-2">
                    <Wallet className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-400 flex-shrink-0" />
                    Balance y Resultados
                  </CardTitle>
                  <Badge variant="outline" className="text-white border-white/30 text-xs px-2 py-0.5 self-start xs:self-auto">
                    {MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 space-y-4 sm:space-y-6">
                
                {/* 1. VENTAS Y GANANCIAS */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                  {/* Venta Total */}
                  <div className="p-3.5 sm:p-4 rounded-xl bg-blue-50/80 border border-blue-200 space-y-2.5">
                    <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1">
                      <span className="text-xs sm:text-sm font-semibold text-blue-900">Venta Total</span>
                      <span className="text-lg sm:text-xl md:text-2xl font-extrabold text-blue-700 tracking-tight break-all">
                        {formatCurrency(totalVentaGlobal)}
                      </span>
                    </div>
                    <Separator className="bg-blue-200" />
                    <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 text-xs pt-0.5">
                      <div className="p-2 sm:p-2.5 bg-white rounded-lg border border-blue-100 shadow-xs">
                        <span className="text-slate-500 block text-[11px] sm:text-xs">💵 Efectivo</span>
                        <span className="font-bold text-slate-800 text-xs sm:text-sm break-all">{formatCurrency(totalVentaEfectivoGlobal)}</span>
                      </div>
                      <div className="p-2 sm:p-2.5 bg-white rounded-lg border border-blue-100 shadow-xs">
                        <span className="text-slate-500 block text-[11px] sm:text-xs">💳 Transferencia</span>
                        <span className="font-bold text-slate-800 text-xs sm:text-sm break-all">{formatCurrency(totalVentaTransferenciaGlobal)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Ganancia Total Bruta */}
                  <div className="p-3.5 sm:p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 space-y-2.5">
                    <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1">
                      <span className="text-xs sm:text-sm font-semibold text-emerald-900">Ganancia Total (Bruta)</span>
                      <span className="text-lg sm:text-xl md:text-2xl font-extrabold text-emerald-700 tracking-tight break-all">
                        {formatCurrency(totalGananciaBrutaGlobal)}
                      </span>
                    </div>
                    <Separator className="bg-emerald-200" />
                    <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 text-xs pt-0.5">
                      <div className="p-2 sm:p-2.5 bg-white rounded-lg border border-emerald-100 shadow-xs">
                        <span className="text-slate-500 block text-[11px] sm:text-xs">💵 Ganancia Efectivo</span>
                        <span className="font-bold text-slate-800 text-xs sm:text-sm break-all">{formatCurrency(totalGananciaEfectivoGlobal)}</span>
                      </div>
                      <div className="p-2 sm:p-2.5 bg-white rounded-lg border border-emerald-100 shadow-xs">
                        <span className="text-slate-500 block text-[11px] sm:text-xs">💳 Ganancia Transf.</span>
                        <span className="font-bold text-slate-800 text-xs sm:text-sm break-all">{formatCurrency(totalGananciaTransferenciaGlobal)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. GASTOS TOTALES INTERACTIVOS */}
                <div
                  className="p-3.5 sm:p-4 rounded-xl bg-rose-50 border-2 border-rose-200 cursor-pointer hover:bg-rose-100/80 active:scale-[0.99] transition-all shadow-xs"
                  onClick={() => setShowGastosDetalleModal(true)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-rose-950 text-sm sm:text-base flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-rose-600 flex-shrink-0" />
                        Gastos Totales
                      </h3>
                      <p className="text-[11px] sm:text-xs text-rose-700 mt-0.5">Toca aquí para ver el desglose detallado</p>
                    </div>
                    <span className="text-xl sm:text-2xl font-black text-rose-700 break-all">{formatCurrency(totalGastosAgrupadosGlobal)}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-rose-200/80 text-xs">
                    <div className="p-2 sm:p-2.5 bg-white rounded-lg border border-rose-100 shadow-xs">
                      <span className="text-slate-500 block text-[10px] sm:text-xs truncate">Gastos Fijos (GF)</span>
                      <span className="font-bold text-slate-800 text-xs sm:text-sm break-all">{formatCurrency(totalGastosFijosGlobal)}</span>
                    </div>
                    <div className="p-2 sm:p-2.5 bg-white rounded-lg border border-rose-100 shadow-xs">
                      <span className="text-slate-500 block text-[10px] sm:text-xs truncate">Gastos Var. (GV)</span>
                      <span className="font-bold text-slate-800 text-xs sm:text-sm break-all">{formatCurrency(totalGastosVariablesGlobal)}</span>
                    </div>
                    <div className="p-2 sm:p-2.5 bg-white rounded-lg border border-rose-100 shadow-xs">
                      <span className="text-slate-500 block text-[10px] sm:text-xs truncate">Merma (GM)</span>
                      <span className="font-bold text-slate-800 text-xs sm:text-sm break-all">{formatCurrency(totalGastosMermaGlobal)}</span>
                    </div>
                    <div className="p-2 sm:p-2.5 bg-white rounded-lg border border-rose-100 shadow-xs">
                      <span className="text-slate-500 block text-[10px] sm:text-xs truncate">Salarios (S)</span>
                      <span className="font-bold text-slate-800 text-xs sm:text-sm break-all">{formatCurrency(totalSalariosGlobal)}</span>
                    </div>
                  </div>
                </div>

                {/* 3. UTILIDAD FINAL Y MARGEN BRUTO */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900 text-white flex justify-between items-center shadow-xs">
                    <div className="min-w-0">
                      <span className="text-[10px] sm:text-xs text-slate-400 block font-medium uppercase tracking-wider">UTILIDAD FINAL</span>
                      <span className="text-xl sm:text-2xl md:text-3xl font-black text-emerald-400 break-all">{formatCurrency(utilidadFinalGlobal)}</span>
                    </div>
                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 flex-shrink-0 ml-2">
                      <TrendingUp className="h-6 w-6 sm:h-7 sm:w-7" />
                    </div>
                  </div>

                  <div className="p-3.5 sm:p-4 rounded-xl bg-slate-100 border border-slate-200 flex justify-between items-center shadow-xs">
                    <div className="min-w-0">
                      <span className="text-[10px] sm:text-xs text-slate-500 block font-medium uppercase tracking-wider">MARGEN DE GANANCIA BRUTO</span>
                      <span className="text-xl sm:text-2xl md:text-3xl font-black text-slate-800">{margenGananciaBrutoPct.toFixed(1)}%</span>
                    </div>
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 flex-shrink-0 ml-2">
                      <PieChart className="h-6 w-6 sm:h-7 sm:w-7" />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* 4. ANÁLISIS PORCENTUAL (% SOBRE VENTAS) */}
                <div className="space-y-2.5 sm:space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
                    <PieChart className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                    Gastos y Métodos de Pago como % de las Ventas
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                    <div className="p-2.5 sm:p-3 bg-white border border-slate-200 rounded-lg shadow-xs">
                      <span className="text-[10px] sm:text-xs text-slate-500 block truncate">Gastos Fijos %</span>
                      <span className="font-bold text-xs sm:text-sm text-rose-600">
                        {totalVentaGlobal > 0 ? `${((totalGastosFijosGlobal / totalVentaGlobal) * 100).toFixed(1)}%` : '0%'}
                      </span>
                    </div>

                    <div className="p-2.5 sm:p-3 bg-white border border-slate-200 rounded-lg shadow-xs">
                      <span className="text-[10px] sm:text-xs text-slate-500 block truncate">Gastos Variables %</span>
                      <span className="font-bold text-xs sm:text-sm text-rose-600">
                        {totalVentaGlobal > 0 ? `${((totalGastosVariablesGlobal / totalVentaGlobal) * 100).toFixed(1)}%` : '0%'}
                      </span>
                    </div>

                    <div className="p-2.5 sm:p-3 bg-white border border-slate-200 rounded-lg shadow-xs">
                      <span className="text-[10px] sm:text-xs text-slate-500 block truncate">Merma %</span>
                      <span className="font-bold text-xs sm:text-sm text-rose-700">
                        {totalVentaGlobal > 0 ? `${((totalGastosMermaGlobal / totalVentaGlobal) * 100).toFixed(1)}%` : '0%'}
                      </span>
                    </div>

                    <div className="p-2.5 sm:p-3 bg-white border border-slate-200 rounded-lg shadow-xs">
                      <span className="text-[10px] sm:text-xs text-slate-500 block truncate">Salarios %</span>
                      <span className="font-bold text-xs sm:text-sm text-rose-600">
                        {totalVentaGlobal > 0 ? `${((totalSalariosGlobal / totalVentaGlobal) * 100).toFixed(1)}%` : '0%'}
                      </span>
                    </div>

                    <div className="p-2.5 sm:p-3 bg-white border border-slate-200 rounded-lg shadow-xs">
                      <span className="text-[10px] sm:text-xs text-slate-500 block truncate">Ventas Efectivo %</span>
                      <span className="font-bold text-xs sm:text-sm text-blue-600">
                        {totalVentaGlobal > 0 ? `${((totalVentaEfectivoGlobal / totalVentaGlobal) * 100).toFixed(1)}%` : '0%'}
                      </span>
                    </div>

                    <div className="p-2.5 sm:p-3 bg-white border border-slate-200 rounded-lg shadow-xs">
                      <span className="text-[10px] sm:text-xs text-slate-500 block truncate">Ventas Transf. %</span>
                      <span className="font-bold text-xs sm:text-sm text-indigo-600">
                        {totalVentaGlobal > 0 ? `${((totalVentaTransferenciaGlobal / totalVentaGlobal) * 100).toFixed(1)}%` : '0%'}
                      </span>
                    </div>

                    <div className="p-2.5 sm:p-3 bg-white border border-slate-200 rounded-lg shadow-xs col-span-2 sm:col-span-3 lg:col-span-2">
                      <span className="text-[10px] sm:text-xs text-slate-500 block truncate">Margen Ganancia Neto</span>
                      <span className={cn(
                        "font-extrabold text-sm sm:text-base",
                        margenGananciaNetoPct >= 15 ? "text-emerald-600" : margenGananciaNetoPct >= 0 ? "text-yellow-600" : "text-rose-600"
                      )}>
                        {margenGananciaNetoPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>
          )}

          {/* LISTA Y DESGLOSE POR VENDEDOR */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="p-3.5 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <User className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600 flex-shrink-0" />
                  <span>Lista de Puntos de Venta</span>
                  <Badge variant="secondary" className="text-xs ml-1">
                    {filteredCalculos.length}
                  </Badge>
                </CardTitle>
                <div className="w-full sm:w-64">
                  <Input
                    placeholder="Filtrar por nombre..."
                    value={filtroVendedor}
                    onChange={(e) => setFiltroVendedor(e.target.value)}
                    className="w-full text-xs h-9 bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3.5 sm:p-5 pt-0 sm:pt-0">
              <div className="space-y-3">
                {filteredCalculos.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs sm:text-sm">
                    No se encontraron puntos de venta para el filtro aplicado.
                  </div>
                ) : (
                  filteredCalculos.map((calculo) => {
                    const isExpanded = expandedSellers.has(calculo.vendedorId)
                    return (
                      <div key={calculo.vendedorId} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                        <div
                          className="p-3.5 sm:p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                          onClick={() => toggleSellerExpansion(calculo.vendedorId)}
                        >
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between md:justify-start gap-2">
                                <h3 className="font-bold text-slate-800 text-sm sm:text-base truncate">{calculo.vendedorNombre}</h3>
                                <span className="md:hidden text-slate-400">
                                  {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-x-2 sm:gap-x-3 gap-y-1 text-xs text-slate-500 mt-1.5">
                                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-medium text-[11px] sm:text-xs">
                                  Venta: <strong>{formatCurrency(calculo.ventaTotal)}</strong>
                                </span>
                                <span className={cn(
                                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium text-[11px] sm:text-xs",
                                  calculo.utilidadFinal >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                                )}>
                                  Utilidad: <strong>{formatCurrency(calculo.utilidadFinal)}</strong>
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 sm:gap-2 self-stretch sm:self-auto justify-end pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 sm:flex-initial text-xs bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 hover:text-rose-800 h-8 px-2.5"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const vendObj = vendedores.find(v => v.id.toString() === calculo.vendedorId.toString()) || ({ id: calculo.vendedorId, nombre: calculo.vendedorNombre } as Vendedor)
                                  handleGastosClick(vendObj)
                                }}
                              >
                                <Plus className="h-3.5 w-3.5 mr-1" /> Gastos
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 sm:flex-initial text-xs h-8 px-2.5"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleOpenSalarioModal(calculo.vendedorId, calculo.vendedorNombre, calculo.salario)
                                }}
                              >
                                <Edit2 className="h-3.5 w-3.5 mr-1" /> Salario Mes
                              </Button>

                              <div className="hidden md:block pl-1 text-slate-400">
                                {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                              </div>
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 space-y-3 text-xs">
                            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 bg-white p-2.5 sm:p-3 rounded-lg border border-slate-200">
                              <span className="font-semibold text-slate-700 text-xs sm:text-sm">Gestión de Gastos del Mes:</span>
                              <Button
                                size="sm"
                                className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white text-xs h-8"
                                onClick={() => {
                                  const vendObj = vendedores.find(v => v.id.toString() === calculo.vendedorId.toString()) || ({ id: calculo.vendedorId, nombre: calculo.vendedorNombre } as Vendedor)
                                  handleGastosClick(vendObj)
                                }}
                              >
                                <Plus className="h-3.5 w-3.5 mr-1" /> Agregar / Gestionar Gastos
                              </Button>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <div className="p-2 sm:p-2.5 bg-white rounded-lg border border-slate-200 shadow-xs">
                                <span className="text-slate-400 block text-[10px] sm:text-xs truncate">Venta Efectivo</span>
                                <span className="font-bold text-xs sm:text-sm text-slate-800 break-all">{formatCurrency(calculo.ventaEfectivo)}</span>
                              </div>
                              <div className="p-2 sm:p-2.5 bg-white rounded-lg border border-slate-200 shadow-xs">
                                <span className="text-slate-400 block text-[10px] sm:text-xs truncate">Venta Transferencia</span>
                                <span className="font-bold text-xs sm:text-sm text-slate-800 break-all">{formatCurrency(calculo.ventaTransferencia)}</span>
                              </div>
                              <div className="p-2 sm:p-2.5 bg-white rounded-lg border border-slate-200 shadow-xs">
                                <span className="text-slate-400 block text-[10px] sm:text-xs truncate">Gastos Fijos</span>
                                <span className="font-bold text-xs sm:text-sm text-rose-600 break-all">{formatCurrency(calculo.gastosFijos)}</span>
                              </div>
                              <div className="p-2 sm:p-2.5 bg-white rounded-lg border border-slate-200 shadow-xs">
                                <span className="text-slate-400 block text-[10px] sm:text-xs truncate">Gastos Variables</span>
                                <span className="font-bold text-xs sm:text-sm text-rose-600 break-all">{formatCurrency(calculo.gastosVariables)}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* MODAL DETALLE DE GASTOS TOTALES */}
      <Dialog open={showGastosDetalleModal} onOpenChange={setShowGastosDetalleModal}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-rose-600 flex-shrink-0" />
              Detalle de Gastos Totales
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex justify-between items-center font-bold text-xs sm:text-sm">
              <span>Suma Total Gastos:</span>
              <span className="text-rose-700 text-base sm:text-lg font-extrabold break-all">{formatCurrency(totalGastosAgrupadosGlobal)}</span>
            </div>

            <div className="grid grid-cols-1 gap-2 pt-1">
              <div className="p-2.5 bg-slate-50 border rounded-lg flex justify-between items-center text-xs sm:text-sm">
                <span className="font-semibold text-slate-700">1. Gastos Fijos (GF)</span>
                <span className="font-bold text-slate-900 break-all">{formatCurrency(totalGastosFijosGlobal)}</span>
              </div>
              <div className="p-2.5 bg-slate-50 border rounded-lg flex justify-between items-center text-xs sm:text-sm">
                <span className="font-semibold text-slate-700">2. Gastos Variables (GV)</span>
                <span className="font-bold text-slate-900 break-all">{formatCurrency(totalGastosVariablesGlobal)}</span>
              </div>
              <div className="p-2.5 bg-slate-50 border rounded-lg flex justify-between items-center text-xs sm:text-sm">
                <span className="font-semibold text-slate-700">3. Merma (GM)</span>
                <span className="font-bold text-slate-900 break-all">{formatCurrency(totalGastosMermaGlobal)}</span>
              </div>
              <div className="p-2.5 bg-slate-50 border rounded-lg flex justify-between items-center text-xs sm:text-sm">
                <span className="font-semibold text-slate-700">4. Salarios (S)</span>
                <span className="font-bold text-slate-900 break-all">{formatCurrency(totalSalariosGlobal)}</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL GESTION SALARIOS MES A MES */}
      {showSalarioDialog && (
        <SalariosMensualesVendedorDialog
          isOpen={showSalarioDialog}
          onClose={() => setShowSalarioDialog(false)}
          vendedorId={salarioModalData.vendedorId}
          vendedorNombre={salarioModalData.vendedorNombre}
          onSaveSuccess={() => handleCalcular()}
        />
      )}

      {/* DIÁLOGO GASTOS VENDEDOR */}
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