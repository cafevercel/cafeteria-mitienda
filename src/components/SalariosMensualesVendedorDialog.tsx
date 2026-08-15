'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Save, DollarSign, Check, Copy } from 'lucide-react'
import { toast } from "@/hooks/use-toast"

interface SalariosMensualesVendedorDialogProps {
  isOpen: boolean
  onClose: () => void
  vendedorId: string
  vendedorNombre: string
  onSaveSuccess: () => void
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

export default function SalariosMensualesVendedorDialog({
  isOpen,
  onClose,
  vendedorId,
  vendedorNombre,
  onSaveSuccess
}: SalariosMensualesVendedorDialogProps) {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [salariosByMonth, setSalariosByMonth] = useState<{ [mes: number]: string }>({})
  const [baseSalario, setBaseSalario] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isSaving, setIsSaving] = useState<boolean>(false)

  useEffect(() => {
    if (isOpen && vendedorId) {
      cargarSalariosAno(selectedYear)
    }
  }, [isOpen, vendedorId, selectedYear])

  const cargarSalariosAno = async (anio: number) => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/salarios-mensuales?vendedorId=${vendedorId}&anio=${anio}`)
      if (!res.ok) throw new Error('Error al cargar salarios')
      const data = await res.json()

      const initialSalaries: { [mes: number]: string } = {}
      for (let m = 1; m <= 12; m++) {
        initialSalaries[m] = ''
      }

      if (Array.isArray(data)) {
        data.forEach((item: any) => {
          if (item.mes >= 1 && item.mes <= 12) {
            initialSalaries[item.mes] = item.salario ? item.salario.toString() : ''
          }
        })
      }

      setSalariosByMonth(initialSalaries)
    } catch (err) {
      console.error('Error al cargar salarios:', err)
      toast({ title: 'Error', description: 'No se pudieron cargar los salarios', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleApplyBaseToAll = () => {
    if (!baseSalario || parseFloat(baseSalario) < 0) {
      toast({ title: 'Monto no válido', description: 'Ingrese un monto salario base válido', variant: 'destructive' })
      return
    }
    const updated: { [mes: number]: string } = {}
    for (let m = 1; m <= 12; m++) {
      updated[m] = baseSalario
    }
    setSalariosByMonth(updated)
    toast({ title: 'Aplicado', description: `Se asignó $${baseSalario} a todos los meses. Recuerda guardar.` })
  }

  const handleSalarioChange = (mes: number, val: string) => {
    setSalariosByMonth(prev => ({ ...prev, [mes]: val }))
  }

  const handleSaveAll = async () => {
    setIsSaving(true)
    try {
      const savePromises = MONTHS.map(async (m) => {
        const valStr = salariosByMonth[m.value]
        if (valStr !== undefined && valStr !== '') {
          const valNum = parseFloat(valStr) || 0
          return fetch('/api/salarios-mensuales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              usuario_id: vendedorId,
              mes: m.value,
              anio: selectedYear,
              salario: valNum
            })
          })
        }
      })

      await Promise.all(savePromises)
      toast({ title: 'Éxito', description: `Salarios guardados correctamente para ${selectedYear}` })
      onSaveSuccess()
      onClose()
    } catch (err) {
      console.error('Error al guardar salarios:', err)
      toast({ title: 'Error', description: 'No se pudieron guardar algunos salarios', variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-3xl max-h-[90dvh] flex flex-col overflow-hidden p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-xl font-bold flex items-center gap-2">
            <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 flex-shrink-0" />
            <span className="truncate">Salarios Mensuales — {vendedorNombre}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 sm:space-y-4 pr-1">
          {/* Header Controls: Year & Quick Fill */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 p-3 bg-slate-50 border rounded-xl items-end">
            <div className="sm:col-span-4">
              <Label className="text-xs font-semibold text-slate-700">Año de Gestión</Label>
              <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
                <SelectTrigger className="mt-1 bg-white h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                    <SelectItem key={y} value={y.toString()} className="text-xs">{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-4">
              <Label className="text-xs font-semibold text-slate-700">Salario Base Rápido ($)</Label>
              <Input
                type="number"
                placeholder="ej: 15000"
                value={baseSalario}
                onChange={(e) => setBaseSalario(e.target.value)}
                className="mt-1 bg-white text-xs h-8"
              />
            </div>

            <div className="sm:col-span-4">
              <Button type="button" variant="secondary" onClick={handleApplyBaseToAll} className="w-full text-xs h-8">
                <Copy className="h-3.5 w-3.5 mr-1" />
                Aplicar a 12 Meses
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-10 text-slate-500 font-medium">Cargando salarios del año {selectedYear}...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {MONTHS.map((m) => {
                const currentVal = salariosByMonth[m.value] || ''
                return (
                  <div key={m.value} className="p-3 border rounded-xl bg-white hover:border-blue-300 transition-all space-y-1.5 shadow-sm">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-blue-500" />
                        {m.label}
                      </span>
                      {currentVal !== '' && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold">
                          Asignado
                        </span>
                      )}
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Salario ($)"
                      value={currentVal}
                      onChange={(e) => handleSalarioChange(m.value, e.target.value)}
                      className="text-xs bg-slate-50 border-slate-200"
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSaveAll} disabled={isSaving || isLoading} className="bg-emerald-600 hover:bg-emerald-700">
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Guardando Salarios...' : `Guardar Salarios del Año ${selectedYear}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
