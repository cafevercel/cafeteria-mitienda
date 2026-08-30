'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Plus, Trash2, Calendar, Edit } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { GastoVendedor, VendedorConSalario } from '@/types'
import { getGastosVendedor, crearGastoVendedor, eliminarGastoVendedor, editarGastoVendedor } from '@/app/services/api'


interface GastosVendedorDialogProps {
  isOpen: boolean
  onClose: () => void
  onRefresh: () => void
  vendedor: VendedorConSalario | null
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

export default function GastosVendedorDialog({ isOpen, onClose, onRefresh, vendedor }: GastosVendedorDialogProps) {
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [gastos, setGastos] = useState<GastoVendedor[]>([])
  const [newGasto, setNewGasto] = useState<{ nombre: string; valor: string; tipo: 'fijo' | 'variable' }>({ nombre: '', valor: '', tipo: 'fijo' })

  const handleAddGasto = async () => {
    if (!newGasto.nombre.trim() || !newGasto.valor || parseFloat(newGasto.valor) <= 0) {
      toast({
        title: "Error",
        description: "El nombre y el valor son obligatorios y el valor debe ser mayor a 0",
        variant: "destructive",
      })
      return
    }

    try {
      await crearGastoVendedor({
        vendedorId: vendedor?.id || '',
        nombre: newGasto.nombre.trim(),
        valor: parseFloat(newGasto.valor),
        mes: selectedMonth,
        anio: selectedYear,
        tipo_gasto: newGasto.tipo
      } as any)

      toast({
        title: "Éxito",
        description: "Gasto agregado correctamente",
      })
      setNewGasto({ nombre: '', valor: '', tipo: 'fijo' })
      loadExpenses()
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo agregar el gasto",
        variant: "destructive",
      })
    }
  }
  const [isLoading, setIsLoading] = useState(false)
  const [editingGasto, setEditingGasto] = useState<GastoVendedor | null>(null)
  const [editGasto, setEditGasto] = useState({ nombre: '', valor: '' })

  const handleEditGasto = async () => {
    if (!editingGasto || !editGasto.nombre.trim() || !editGasto.valor || parseFloat(editGasto.valor) <= 0) {
      toast({
        title: "Error",
        description: "El nombre y el valor son obligatorios y el valor debe ser mayor a 0",
        variant: "destructive",
      })
      return
    }

    try {
      await editarGastoVendedor({
        id: editingGasto.id.toString(), // ✅ Convertir a string
        vendedorId: vendedor?.id || '',
        nombre: editGasto.nombre.trim(),
        valor: parseFloat(editGasto.valor),
        mes: selectedMonth,
        anio: selectedYear
      })

      toast({
        title: "Éxito",
        description: "Gasto actualizado correctamente",
      })
      setEditingGasto(null)
      setEditGasto({ nombre: '', valor: '' })
      loadExpenses()
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el gasto",
        variant: "destructive",
      })
    }
  }



  useEffect(() => {
    if (isOpen && vendedor) {
      loadExpenses()
    }
  }, [isOpen, vendedor, selectedMonth, selectedYear])

  const loadExpenses = async () => {
    if (!vendedor) return

    setIsLoading(true)
    try {
      const data = await getGastosVendedor(vendedor.id, selectedMonth, selectedYear)
      // Convertir la estructura de la base de datos al formato que espera el componente
      setGastos(data.map((item: any) => ({
        id: item.id,
        nombre: item.nombre,
        cantidad: parseFloat(item.cantidad),
        fecha: item.fecha,
        tipo_gasto: item.tipo_gasto || 'fijo',
        vendedor_id: item.vendedor_id,
        mes: item.mes || selectedMonth,
        anio: item.anio || selectedYear
      })))
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los gastos",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }



  const handleDeleteGasto = async (gasto: GastoVendedor) => {
    try {
      // Usar el ID del gasto para eliminarlo directamente
      await eliminarGastoVendedor(
        gasto.vendedor_id || '',
        gasto.nombre,
        gasto.mes || selectedMonth,
        gasto.anio || selectedYear
      )

      toast({
        title: "Éxito",
        description: "Gasto eliminado correctamente",
      })
      loadExpenses()
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar el gasto",
        variant: "destructive",
      })
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CU', {
      style: 'currency',
      currency: 'CUP',
      minimumFractionDigits: 2
    }).format(value)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90dvh] overflow-hidden flex flex-col p-3.5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 flex-shrink-0" />
            <span className="truncate">Gestión de Gastos — {vendedor?.nombre}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 sm:space-y-4 pr-0.5">
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div>
              <Label htmlFor="month" className="text-xs font-medium text-slate-700 block mb-1">Mes</Label>
              <Select
                value={selectedMonth.toString()}
                onValueChange={(value) => setSelectedMonth(parseInt(value))}
              >
                <SelectTrigger className="h-9 text-xs bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month) => (
                    <SelectItem key={month.value} value={month.value.toString()} className="text-xs">
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="year" className="text-xs font-medium text-slate-700 block mb-1">Año</Label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger className="h-9 text-xs bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030].map((year) => (
                    <SelectItem key={year} value={year.toString()} className="text-xs">
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="p-3 sm:p-4">
              <CardTitle className="text-xs sm:text-sm font-bold text-slate-800">Agregar Nuevo Gasto</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
              <div className="space-y-2">
                <div>
                  <Input
                    placeholder="Nombre del gasto (ej: renta, servicios)"
                    value={newGasto.nombre}
                    onChange={(e) => setNewGasto({ ...newGasto, nombre: e.target.value })}
                    className="text-xs h-9 bg-slate-50 focus:bg-white"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <div className="grid grid-cols-2 gap-2 sm:col-span-8">
                    <Select
                      value={newGasto.tipo}
                      onValueChange={(val: 'fijo' | 'variable') => setNewGasto({ ...newGasto, tipo: val })}
                    >
                      <SelectTrigger className="h-9 text-xs bg-slate-50 focus:bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fijo" className="text-xs">Fijo</SelectItem>
                        <SelectItem value="variable" className="text-xs">Variable</SelectItem>
                      </SelectContent>
                    </Select>

                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Monto ($)"
                      value={newGasto.valor}
                      onChange={(e) => setNewGasto({ ...newGasto, valor: e.target.value })}
                      className="text-xs h-9 bg-slate-50 focus:bg-white"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <Button onClick={handleAddGasto} disabled={isLoading} className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-xs font-semibold shadow-xs">
                      <Plus className="h-4 w-4 mr-1.5" /> Agregar Gasto
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="p-3 sm:p-4">
              <CardTitle className="text-xs sm:text-sm font-bold text-slate-800 flex items-center justify-between">
                <span>Gastos Registrados</span>
                <span className="text-[11px] font-normal text-slate-500">
                  {MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear} ({gastos.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
              {isLoading ? (
                <div className="text-center py-6 text-xs text-slate-500">Cargando gastos...</div>
              ) : gastos.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  No hay gastos registrados para este mes
                </div>
              ) : (
                <div className="space-y-2">
                  {gastos.map((gasto) => (
                    <div
                      key={`${gasto.id || gasto.nombre}-${gasto.mes}-${gasto.anio}`}
                      className="p-2.5 sm:p-3 border border-slate-200 rounded-lg bg-white shadow-xs"
                    >
                      {editingGasto?.id === gasto.id ? (
                        // Modo edición responsive
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Input
                            placeholder="Nombre del gasto"
                            value={editGasto.nombre}
                            onChange={(e) => setEditGasto({ ...editGasto, nombre: e.target.value })}
                            className="text-xs h-8 flex-1"
                          />
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Valor"
                            value={editGasto.valor}
                            onChange={(e) => setEditGasto({ ...editGasto, valor: e.target.value })}
                            className="text-xs h-8 sm:w-28"
                          />
                          <div className="flex gap-1.5 justify-end">
                            <Button onClick={handleEditGasto} size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700">
                              Guardar
                            </Button>
                            <Button
                              onClick={() => {
                                setEditingGasto(null)
                                setEditGasto({ nombre: '', valor: '' })
                              }}
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs"
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // Modo visualización responsive
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-800 text-xs sm:text-sm truncate">{gasto.nombre}</span>
                              <Badge
                                variant="outline"
                                className={
                                  gasto.tipo_gasto === 'variable'
                                    ? "bg-amber-50 text-amber-800 border-amber-300 text-[10px] px-1.5 py-0"
                                    : "bg-slate-100 text-slate-700 border-slate-300 text-[10px] px-1.5 py-0"
                                }
                              >
                                {gasto.tipo_gasto === 'variable' ? 'Variable' : 'Fijo'}
                              </Badge>
                            </div>
                            <div className="text-xs sm:text-sm font-bold text-slate-700 mt-0.5 break-all">
                              {formatCurrency(gasto.cantidad)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setEditingGasto(gasto)
                                setEditGasto({
                                  nombre: gasto.nombre,
                                  valor: gasto.cantidad.toString()
                                })
                              }}
                            >
                              <Edit className="h-4 w-4 text-blue-500" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="w-[95vw] max-w-md p-4 sm:p-6">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-base sm:text-lg">Confirmar eliminación</AlertDialogTitle>
                                  <AlertDialogDescription className="text-xs sm:text-sm">
                                    ¿Estás seguro de que deseas eliminar el gasto &quot;{gasto.nombre}&quot;?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
                                  <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteGasto(gasto)}
                                    className="bg-red-500 hover:bg-red-600 text-xs"
                                  >
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}
