'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ArrowLeftRight, TrendingUp, TrendingDown, DollarSign, Calendar, User, Users, Check, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from '@/hooks/use-toast'
import { getContabilidadVendedores } from '@/app/services/api'
import { CalculoContabilidadVendedor, Vendedor } from '@/types'
import { cn } from "@/lib/utils"

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

interface ComparativaPageProps {
  vendedores?: Vendedor[]
}

export default function ComparativaPage({ vendedores = [] }: ComparativaPageProps) {
  const [mesA, setMesA] = useState<number>(new Date().getMonth()) // mes anterior por defecto
  const [anioA, setAnioA] = useState<number>(new Date().getFullYear())
  const [mesB, setMesB] = useState<number>(new Date().getMonth() + 1)
  const [anioB, setAnioB] = useState<number>(new Date().getFullYear())

  const [isLoading, setIsLoading] = useState(false)
  const [dataA, setDataA] = useState<CalculoContabilidadVendedor[]>([])
  const [dataB, setDataB] = useState<CalculoContabilidadVendedor[]>([])
  const [hasCompared, setHasCompared] = useState(false)
  const [selectedVendedores, setSelectedVendedores] = useState<string[]>([])

  // Lista unificada de todos los vendedores disponibles
  const listaVendedores = useMemo(() => {
    const map = new Map<string, string>()
    if (vendedores && vendedores.length > 0) {
      vendedores.forEach(v => map.set(v.id.toString(), v.nombre))
    }
    dataA.forEach(d => map.set(d.vendedorId.toString(), d.vendedorNombre))
    dataB.forEach(d => map.set(d.vendedorId.toString(), d.vendedorNombre))
    return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }))
  }, [vendedores, dataA, dataB])

  // Inicializar o auto-seleccionar todos los vendedores al inicio si está vacío
  useEffect(() => {
    if (listaVendedores.length > 0 && selectedVendedores.length === 0 && !hasCompared) {
      setSelectedVendedores(listaVendedores.map(v => v.id))
    }
  }, [listaVendedores, hasCompared, selectedVendedores.length])

  const toggleVendedor = (id: string) => {
    setSelectedVendedores(prev => 
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    )
  }

  const selectAllVendedores = () => {
    setSelectedVendedores(listaVendedores.map(v => v.id))
  }

  const deselectAllVendedores = () => {
    setSelectedVendedores([])
  }

  const handleComparar = async () => {
    setIsLoading(true)
    try {
      // Formatear fechas para mes A
      const startA = new Date(anioA, mesA - 1, 1)
      const endA = new Date(anioA, mesA, 0)
      const fechaStartAStr = format(startA, 'yyyy-MM-dd')
      const fechaEndAStr = format(endA, 'yyyy-MM-dd')

      // Formatear fechas para mes B
      const startB = new Date(anioB, mesB - 1, 1)
      const endB = new Date(anioB, mesB, 0)
      const fechaStartBStr = format(startB, 'yyyy-MM-dd')
      const fechaEndBStr = format(endB, 'yyyy-MM-dd')

      const [resA, resB] = await Promise.all([
        getContabilidadVendedores(fechaStartAStr, fechaEndAStr),
        getContabilidadVendedores(fechaStartBStr, fechaEndBStr)
      ])

      setDataA(resA)
      setDataB(resB)
      setHasCompared(true)

      // Si no había selección previa, seleccionar todos los vendedores encontrados
      if (selectedVendedores.length === 0) {
        const uniqueIds = Array.from(new Set([
          ...resA.map(r => r.vendedorId.toString()),
          ...resB.map(r => r.vendedorId.toString())
        ]))
        setSelectedVendedores(uniqueIds)
      }

      toast({ title: 'Éxito', description: 'Comparativa generada correctamente' })
    } catch (error) {
      console.error('Error al comparar períodos:', error)
      toast({ title: 'Error', description: 'No se pudieron comparar los períodos', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-CU', { style: 'currency', currency: 'CUP', minimumFractionDigits: 2 }).format(val)
  }

  const calcSum = (arr: CalculoContabilidadVendedor[], key: keyof CalculoContabilidadVendedor) => {
    return arr.reduce((sum, item) => sum + (typeof item[key] === 'number' ? (item[key] as number) : 0), 0)
  }

  // Filtrar los datos exclusivamente por los vendedores seleccionados
  const filteredDataA = useMemo(() => {
    return dataA.filter(d => selectedVendedores.includes(d.vendedorId.toString()))
  }, [dataA, selectedVendedores])

  const filteredDataB = useMemo(() => {
    return dataB.filter(d => selectedVendedores.includes(d.vendedorId.toString()))
  }, [dataB, selectedVendedores])

  const totalVentaA = calcSum(filteredDataA, 'ventaTotal')
  const totalVentaB = calcSum(filteredDataB, 'ventaTotal')

  const totalEfectivoA = calcSum(filteredDataA, 'ventaEfectivo')
  const totalEfectivoB = calcSum(filteredDataB, 'ventaEfectivo')

  const totalTransferenciaA = calcSum(filteredDataA, 'ventaTransferencia')
  const totalTransferenciaB = calcSum(filteredDataB, 'ventaTransferencia')

  const gananciaBrutaA = calcSum(filteredDataA, 'gananciaBruta')
  const gananciaBrutaB = calcSum(filteredDataB, 'gananciaBruta')

  const gastosFijosA = calcSum(filteredDataA, 'gastosFijos')
  const gastosFijosB = calcSum(filteredDataB, 'gastosFijos')

  const gastosVariablesA = calcSum(filteredDataA, 'gastosVariables')
  const gastosVariablesB = calcSum(filteredDataB, 'gastosVariables')

  // Merma general: solo se incluye en el cálculo global consolidado si todos los vendedores están seleccionados
  const allSelected = listaVendedores.length > 0 && selectedVendedores.length === listaVendedores.length
  const gastosMermaA = (allSelected && dataA.length > 0) ? dataA[0].gastosMerma : 0
  const gastosMermaB = (allSelected && dataB.length > 0) ? dataB[0].gastosMerma : 0

  const salariosA = calcSum(filteredDataA, 'salario')
  const salariosB = calcSum(filteredDataB, 'salario')

  const gastosTotalesA = calcSum(filteredDataA, 'gastos') + gastosMermaA + salariosA
  const gastosTotalesB = calcSum(filteredDataB, 'gastos') + gastosMermaB + salariosB

  const utilidadA = gananciaBrutaA - gastosTotalesA
  const utilidadB = gananciaBrutaB - gastosTotalesB

  const getDiffPct = (valA: number, valB: number) => {
    if (valA === 0) return valB > 0 ? '+100%' : '0%'
    const diff = ((valB - valA) / Math.abs(valA)) * 100
    return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`
  }

  // Comparativa individual por cada vendedor seleccionado
  const desgloseIndividual = useMemo(() => {
    return selectedVendedores.map(id => {
      const itemA = filteredDataA.find(d => d.vendedorId.toString() === id.toString())
      const itemB = filteredDataB.find(d => d.vendedorId.toString() === id.toString())
      const nombre = itemA?.vendedorNombre || itemB?.vendedorNombre || listaVendedores.find(v => v.id.toString() === id.toString())?.nombre || `Vendedor ${id}`

      const ventaA = itemA?.ventaTotal || 0
      const ventaB = itemB?.ventaTotal || 0

      const gananciaA = itemA?.gananciaBruta || 0
      const gananciaB = itemB?.gananciaBruta || 0

      const gastosA = (itemA?.gastos || 0) + (itemA?.salario || 0)
      const gastosB = (itemB?.gastos || 0) + (itemB?.salario || 0)

      const utilidadVendA = gananciaA - gastosA
      const utilidadVendB = gananciaB - gastosB

      return {
        id,
        nombre,
        ventaA,
        ventaB,
        gananciaA,
        gananciaB,
        gastosA,
        gastosB,
        utilidadVendA,
        utilidadVendB
      }
    })
  }, [selectedVendedores, filteredDataA, filteredDataB, listaVendedores])

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="p-3.5 sm:p-5">
          <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-indigo-600 flex-shrink-0" />
            <span>Comparativa General de Rendimiento Financiero</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3.5 sm:p-5 pt-0 sm:pt-0 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {/* Período A */}
            <div className="p-3.5 sm:p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-2.5">
              <h3 className="font-semibold text-xs sm:text-sm text-slate-800 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-blue-500 flex-shrink-0" /> Período A (Base)
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] sm:text-xs text-slate-500 font-medium block mb-1">Mes</label>
                  <Select value={mesA.toString()} onValueChange={v => setMesA(parseInt(v))}>
                    <SelectTrigger className="h-9 text-xs bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map(m => (
                        <SelectItem key={m.value} value={m.value.toString()} className="text-xs">{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[11px] sm:text-xs text-slate-500 font-medium block mb-1">Año</label>
                  <Select value={anioA.toString()} onValueChange={v => setAnioA(parseInt(v))}>
                    <SelectTrigger className="h-9 text-xs bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                        <SelectItem key={y} value={y.toString()} className="text-xs">{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Período B */}
            <div className="p-3.5 sm:p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-2.5">
              <h3 className="font-semibold text-xs sm:text-sm text-slate-800 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-emerald-500 flex-shrink-0" /> Período B (Comparar)
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] sm:text-xs text-slate-500 font-medium block mb-1">Mes</label>
                  <Select value={mesB.toString()} onValueChange={v => setMesB(parseInt(v))}>
                    <SelectTrigger className="h-9 text-xs bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map(m => (
                        <SelectItem key={m.value} value={m.value.toString()} className="text-xs">{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[11px] sm:text-xs text-slate-500 font-medium block mb-1">Año</label>
                  <Select value={anioB.toString()} onValueChange={v => setAnioB(parseInt(v))}>
                    <SelectTrigger className="h-9 text-xs bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                        <SelectItem key={y} value={y.toString()} className="text-xs">{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* FILTRO DE VENDEDORES / PUNTOS DE VENTA A COMPARAR */}
          {listaVendedores.length > 0 && (
            <div className="p-3.5 sm:p-4 border border-indigo-200 rounded-xl bg-indigo-50/40 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-600" />
                  <span className="font-bold text-xs sm:text-sm text-slate-800">
                    Filtro de Puntos de Venta a Comparar:
                  </span>
                  <Badge variant="secondary" className="text-xs bg-indigo-100 text-indigo-700 font-bold">
                    {selectedVendedores.length} de {listaVendedores.length} seleccionados
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={selectAllVendedores}
                    className="h-7 text-[11px] px-2.5 bg-white hover:bg-slate-50"
                  >
                    Seleccionar Todos
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={deselectAllVendedores}
                    className="h-7 text-[11px] px-2.5 bg-white text-slate-600 hover:bg-slate-50"
                  >
                    Deseleccionar Todos
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {listaVendedores.map((v) => {
                  const isSelected = selectedVendedores.includes(v.id)
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => toggleVendedor(v.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer shadow-xs",
                        isSelected
                          ? "bg-indigo-600 border-indigo-600 text-white font-semibold shadow-indigo-100"
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                      )}
                    >
                      <span className={cn(
                        "w-2 h-2 rounded-full",
                        isSelected ? "bg-white" : "bg-slate-300"
                      )} />
                      {v.nombre}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <Button
            onClick={handleComparar}
            disabled={isLoading || selectedVendedores.length === 0}
            className="w-full h-10 sm:h-11 font-semibold text-xs sm:text-sm bg-indigo-600 hover:bg-indigo-700 shadow-xs"
          >
            {isLoading ? 'Generando Comparativa...' : 'Generar Comparativa'}
          </Button>

          {selectedVendedores.length === 0 && (
            <p className="text-xs text-amber-600 font-medium text-center">
              ⚠️ Selecciona al menos un punto de venta en el filtro superior para generar la comparativa.
            </p>
          )}
        </CardContent>
      </Card>

      {hasCompared && (
        <div className="space-y-4 sm:space-y-6">
          {/* TABLA CONSOLIDADA GENERAL DE LOS SELECCIONADOS */}
          <Card className="border-slate-200 shadow-xs overflow-hidden">
            <CardHeader className="p-3.5 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold">Resultados Consolidados de la Comparativa</CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Datos calculados para los {selectedVendedores.length} puntos de venta seleccionados
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-xs font-semibold text-indigo-700 border-indigo-200 bg-indigo-50">
                    {MONTHS.find(m => m.value === mesA)?.label} {anioA} vs {MONTHS.find(m => m.value === mesB)?.label} {anioB}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-5 pt-0 sm:pt-0">
              <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
                <div className="min-w-[480px] space-y-1.5">
                  <div className="grid grid-cols-4 gap-2 font-bold text-xs sm:text-sm bg-slate-100 p-2.5 sm:p-3 rounded-lg text-slate-700">
                    <div>Métrica</div>
                    <div className="text-right">{MONTHS.find(m => m.value === mesA)?.label} {anioA}</div>
                    <div className="text-right">{MONTHS.find(m => m.value === mesB)?.label} {anioB}</div>
                    <div className="text-center">Variación</div>
                  </div>

                  {[
                    { label: 'Venta Total', valA: totalVentaA, valB: totalVentaB, highlight: true },
                    { label: '  • Venta Efectivo', valA: totalEfectivoA, valB: totalEfectivoB },
                    { label: '  • Venta Transferencia', valA: totalTransferenciaA, valB: totalTransferenciaB },
                    { label: 'Ganancia Bruta', valA: gananciaBrutaA, valB: gananciaBrutaB, highlight: true },
                    { label: 'Gastos Fijos', valA: gastosFijosA, valB: gastosFijosB },
                    { label: 'Gastos Variables', valA: gastosVariablesA, valB: gastosVariablesB },
                    { label: 'Gastos Merma (General)', valA: gastosMermaA, valB: gastosMermaB },
                    { label: 'Salarios', valA: salariosA, valB: salariosB },
                    { label: 'Gastos Totales', valA: gastosTotalesA, valB: gastosTotalesB, highlight: true },
                    { label: 'Utilidad Final', valA: utilidadA, valB: utilidadB, isProfit: true }
                  ].map((row, idx) => {
                    const diffPct = getDiffPct(row.valA, row.valB)
                    const isPositive = row.valB >= row.valA
                    return (
                      <div key={idx} className={`grid grid-cols-4 gap-2 items-center p-2 sm:p-2.5 rounded-lg ${row.isProfit ? 'bg-emerald-50 font-bold border border-emerald-200' : row.highlight ? 'bg-slate-50 font-semibold' : 'hover:bg-slate-50/80'}`}>
                        <div className="text-xs sm:text-sm text-slate-800 truncate">{row.label}</div>
                        <div className="text-right text-xs sm:text-sm break-all">{formatCurrency(row.valA)}</div>
                        <div className="text-right text-xs sm:text-sm break-all">{formatCurrency(row.valB)}</div>
                        <div className="text-center text-[10px] sm:text-xs font-semibold">
                          <span className={`inline-block px-1.5 sm:px-2 py-0.5 rounded-full ${isPositive ? (row.label.includes('Gastos') ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700') : (row.label.includes('Gastos') ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}`}>
                            {diffPct}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* TABLA COMPARATIVA INDIVIDUAL POR CADA PUNTO DE VENTA SELECCIONADO */}
          {desgloseIndividual.length > 0 && (
            <Card className="border-slate-200 shadow-xs overflow-hidden">
              <CardHeader className="p-3.5 sm:p-5">
                <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <User className="h-4 w-4 text-indigo-600" />
                  <span>Comparativa Individual por Punto de Venta Seleccionado ({desgloseIndividual.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-5 pt-0 sm:pt-0">
                <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
                  <div className="min-w-[640px] space-y-2">
                    <div className="grid grid-cols-5 gap-2 font-bold text-xs bg-slate-100 p-2.5 rounded-lg text-slate-700">
                      <div>Punto de Venta</div>
                      <div className="text-right">Venta (A vs B)</div>
                      <div className="text-right">Ganancia Bruta</div>
                      <div className="text-right">Gastos + Salarios</div>
                      <div className="text-right">Utilidad Final</div>
                    </div>

                    {desgloseIndividual.map((vend) => {
                      const diffVenta = getDiffPct(vend.ventaA, vend.ventaB)
                      const isVentaPos = vend.ventaB >= vend.ventaA

                      const diffUtilidad = getDiffPct(vend.utilidadVendA, vend.utilidadVendB)
                      const isUtilidadPos = vend.utilidadVendB >= vend.utilidadVendA

                      return (
                        <div key={vend.id} className="grid grid-cols-5 gap-2 items-center p-2.5 rounded-lg border border-slate-100 bg-white hover:bg-slate-50 text-xs">
                          <div className="font-bold text-slate-800 truncate flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                            {vend.nombre}
                          </div>

                          <div className="text-right">
                            <div className="font-semibold text-slate-800">{formatCurrency(vend.ventaB)}</div>
                            <div className="text-[10px] text-slate-400">Base: {formatCurrency(vend.ventaA)}</div>
                            <span className={`inline-block text-[10px] font-bold ${isVentaPos ? 'text-emerald-600' : 'text-red-600'}`}>
                              {diffVenta}
                            </span>
                          </div>

                          <div className="text-right">
                            <div className="font-semibold text-slate-800">{formatCurrency(vend.gananciaB)}</div>
                            <div className="text-[10px] text-slate-400">Base: {formatCurrency(vend.gananciaA)}</div>
                          </div>

                          <div className="text-right">
                            <div className="font-semibold text-rose-600">{formatCurrency(vend.gastosB)}</div>
                            <div className="text-[10px] text-slate-400">Base: {formatCurrency(vend.gastosA)}</div>
                          </div>

                          <div className="text-right">
                            <div className={cn("font-bold", vend.utilidadVendB >= 0 ? "text-emerald-700" : "text-rose-700")}>
                              {formatCurrency(vend.utilidadVendB)}
                            </div>
                            <div className="text-[10px] text-slate-400">Base: {formatCurrency(vend.utilidadVendA)}</div>
                            <span className={`inline-block text-[10px] font-bold ${isUtilidadPos ? 'text-emerald-600' : 'text-red-600'}`}>
                              {diffUtilidad}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
