'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Plus, Trash2, Calendar } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { GastoVendedor, VendedorConSalario } from '@/types'
import { getGastosVendedor, crearGastoVendedor, eliminarGastoVendedor } from '@/app/services/api'

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
  const [newGasto, setNewGasto] = useState({ nombre: '', valor: '' })
  const [isLoading, setIsLoading] = useState(false)

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
        cantidad: parseFloat(item.cantidad), // Cambiado de 'valor' a 'cantidad'
        fecha: item.fecha,
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
        anio: selectedYear
      })

      toast({
        title: "Éxito",
        description: "Gasto agregado correctamente",
      })
      setNewGasto({ nombre: '', valor: '' })
      loadExpenses()
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo agregar el gasto",
        variant: "destructive",
      })
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Gestión de Gastos - {vendedor?.nombre}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <Label htmlFor="month">Mes</Label>
              <Select
                value={selectedMonth.toString()}
                onValueChange={(value) => setSelectedMonth(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month) => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label htmlFor="year">Año</Label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2020, 2021, 2022, 2023, 2024, 2025].map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-lg">Agregar Nuevo Gasto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Nombre del gasto (ej: renta, servicios, etc.)"
                    value={newGasto.nombre}
                    onChange={(e) => setNewGasto({ ...newGasto, nombre: e.target.value })}
                  />
                </div>
                <div className="w-32">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Valor"
                    value={newGasto.valor}
                    onChange={(e) => setNewGasto({ ...newGasto, valor: e.target.value })}
                  />
                </div>
                <Button onClick={handleAddGasto} disabled={isLoading}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Gastos de {MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-4">Cargando...</div>
              ) : gastos.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  No hay gastos registrados para este mes
                </div>
              ) : (
                <div className="space-y-2">
                  {gastos.map((gasto) => (
                    <div
                      key={`${gasto.nombre}-${gasto.mes}-${gasto.anio}`}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{gasto.nombre}</div>
                        <div className="text-sm text-gray-500">
                          {formatCurrency(gasto.cantidad)} {/* Cambiado de 'valor' a 'cantidad' */}
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(gasto.fecha).toLocaleDateString('es-ES')}
                        </div>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar eliminación</AlertDialogTitle>
                            <AlertDialogDescription>
                              ¿Estás seguro de que deseas eliminar el gasto &quot;{gasto.nombre}&quot;?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteGasto(gasto)}
                              className="bg-red-500 hover:bg-red-600"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
