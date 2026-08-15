'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeftRight, TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from '@/hooks/use-toast'
import { getContabilidadVendedores } from '@/app/services/api'
import { CalculoContabilidadVendedor } from '@/types'

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

export default function ComparativaPage() {
  const [mesA, setMesA] = useState<number>(new Date().getMonth()) // mes anterior por defecto
  const [anioA, setAnioA] = useState<number>(new Date().getFullYear())
  const [mesB, setMesB] = useState<number>(new Date().getMonth() + 1)
  const [anioB, setAnioB] = useState<number>(new Date().getFullYear())

  const [isLoading, setIsLoading] = useState(false)
  const [dataA, setDataA] = useState<CalculoContabilidadVendedor[]>([])
  const [dataB, setDataB] = useState<CalculoContabilidadVendedor[]>([])
  const [hasCompared, setHasCompared] = useState(false)

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

  const totalVentaA = calcSum(dataA, 'ventaTotal')
  const totalVentaB = calcSum(dataB, 'ventaTotal')

  const totalEfectivoA = calcSum(dataA, 'ventaEfectivo')
  const totalEfectivoB = calcSum(dataB, 'ventaEfectivo')

  const totalTransferenciaA = calcSum(dataA, 'ventaTransferencia')
  const totalTransferenciaB = calcSum(dataB, 'ventaTransferencia')

  const gananciaBrutaA = calcSum(dataA, 'gananciaBruta')
  const gananciaBrutaB = calcSum(dataB, 'gananciaBruta')

  const gastosFijosA = calcSum(dataA, 'gastosFijos')
  const gastosFijosB = calcSum(dataB, 'gastosFijos')

  const gastosVariablesA = calcSum(dataA, 'gastosVariables')
  const gastosVariablesB = calcSum(dataB, 'gastosVariables')

  const gastosMermaA = dataA.length > 0 ? dataA[0].gastosMerma : 0
  const gastosMermaB = dataB.length > 0 ? dataB[0].gastosMerma : 0

  const salariosA = calcSum(dataA, 'salario')
  const salariosB = calcSum(dataB, 'salario')

  const gastosTotalesA = calcSum(dataA, 'gastos') + gastosMermaA + salariosA
  const gastosTotalesB = calcSum(dataB, 'gastos') + gastosMermaB + salariosB

  const utilidadA = gananciaBrutaA - gastosTotalesA
  const utilidadB = gananciaBrutaB - gastosTotalesB

  const getDiffPct = (valA: number, valB: number) => {
    if (valA === 0) return valB > 0 ? '+100%' : '0%'
    const diff = ((valB - valA) / Math.abs(valA)) * 100
    return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-indigo-600" />
            Comparativa de Rendimiento Financiero
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Período A */}
            <div className="p-4 border rounded-xl bg-slate-50 space-y-3">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" /> Período A (Base)
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 font-medium">Mes</label>
                  <Select value={mesA.toString()} onValueChange={v => setMesA(parseInt(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map(m => (
                        <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium">Año</label>
                  <Select value={anioA.toString()} onValueChange={v => setAnioA(parseInt(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Período B */}
            <div className="p-4 border rounded-xl bg-slate-50 space-y-3">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-500" /> Período B (Comparar)
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 font-medium">Mes</label>
                  <Select value={mesB.toString()} onValueChange={v => setMesB(parseInt(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map(m => (
                        <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium">Año</label>
                  <Select value={anioB.toString()} onValueChange={v => setAnioB(parseInt(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <Button onClick={handleComparar} disabled={isLoading} className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700">
            {isLoading ? 'Generando Comparativa...' : 'Generar Comparativa'}
          </Button>
        </CardContent>
      </Card>

      {hasCompared && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Resultados de la Comparativa</span>
              <span className="text-sm font-normal text-slate-500">
                {MONTHS.find(m => m.value === mesA)?.label} {anioA} vs {MONTHS.find(m => m.value === mesB)?.label} {anioB}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-2 px-2">
              <div className="min-w-[550px] space-y-2">
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
                  { label: 'Gastos Merma', valA: gastosMermaA, valB: gastosMermaB },
                  { label: 'Salarios', valA: salariosA, valB: salariosB },
                  { label: 'Gastos Totales', valA: gastosTotalesA, valB: gastosTotalesB, highlight: true },
                  { label: 'Utilidad Final', valA: utilidadA, valB: utilidadB, isProfit: true }
                ].map((row, idx) => {
                  const diffPct = getDiffPct(row.valA, row.valB)
                  const isPositive = row.valB >= row.valA
                  return (
                    <div key={idx} className={`grid grid-cols-4 gap-2 items-center p-2 rounded-md ${row.isProfit ? 'bg-emerald-50 font-bold border border-emerald-200' : row.highlight ? 'bg-slate-50 font-semibold' : 'hover:bg-slate-50'}`}>
                      <div className="text-xs sm:text-sm text-slate-800 truncate">{row.label}</div>
                      <div className="text-right text-xs sm:text-sm">{formatCurrency(row.valA)}</div>
                      <div className="text-right text-xs sm:text-sm">{formatCurrency(row.valB)}</div>
                      <div className="text-center text-[10px] sm:text-xs font-semibold">
                        <span className={`px-2 py-0.5 sm:py-1 rounded-full ${isPositive ? (row.label.includes('Gastos') ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700') : (row.label.includes('Gastos') ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}`}>
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
      )}
    </div>
  )
}
