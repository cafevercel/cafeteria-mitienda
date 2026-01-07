import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
import { Loader2, Plus, Edit2, Trash2, X, Save, DollarSign } from 'lucide-react'
import { Empleado } from '@/types'
import { getEmpleados, getSalarios, crearActualizarSalario, eliminarSalario } from '@/app/services/api'

interface SalariosDialogProps {
  puntoVentaId: string;
  puntoVentaNombre: string;
  onClose: () => void;
}

interface SalarioData {
  id?: string;
  empleado_id: string;
  empleado_nombre: string;
  salario: number;
}

export default function SalariosDialog({ puntoVentaId, puntoVentaNombre, onClose }: SalariosDialogProps) {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [salarios, setSalarios] = useState<SalarioData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingSalario, setEditingSalario] = useState<SalarioData | null>(null)
  const [formData, setFormData] = useState({
    empleado_id: '',
    salario: ''
  })

  useEffect(() => {
    cargarDatos()
  }, [puntoVentaId])

  const cargarDatos = async () => {
    try {
      setIsLoading(true)
      
      // Cargar empleados
      const empleadosData = await getEmpleados(puntoVentaId)
      setEmpleados(empleadosData)
      
      // Cargar salarios
      const salariosData = await getSalarios(puntoVentaId)
      
      // Combinar datos de salarios con nombres de empleados
      const salariosCombinados = salariosData.map((salario: any) => ({
        id: salario.id,
        empleado_id: salario.empleado_id,
        empleado_nombre: salario.empleado_nombre || empleadosData.find(e => e.id === salario.empleado_id)?.nombre || 'Desconocido',
        salario: salario.salario
      }))
      
      setSalarios(salariosCombinados)
    } catch (error) {
      console.error('Error al cargar datos:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleEditInputChange = (field: string, value: any) => {
    if (editingSalario) {
      setEditingSalario(prev => ({ ...prev!, [field]: value }))
    }
  }

  const resetForm = () => {
    setFormData({
      empleado_id: '',
      salario: ''
    })
    setEditingSalario(null)
    setShowForm(false)
  }

  const handleSave = async () => {
    const empleadoId = editingSalario ? editingSalario.empleado_id : formData.empleado_id;
    const salarioValor = editingSalario ? editingSalario.salario : parseFloat(formData.salario);

    if (!empleadoId) {
      toast({
        title: "Error",
        description: "Debe seleccionar un empleado",
        variant: "destructive",
      })
      return
    }

    if (!salarioValor || salarioValor <= 0) {
      toast({
        title: "Error",
        description: "El salario debe ser un valor positivo",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSaving(true)
      
      // Verificar si el empleado ya tiene salario
      const existeSalario = salarios.find(s => s.empleado_id === empleadoId)
      
      if (existeSalario && !editingSalario) {
        toast({
          title: "Confirmar",
          description: `El empleado ya tiene un salario de $${existeSalario.salario}. ¿Deseas actualizarlo?`,
          action: (
            <Button 
              onClick={async () => {
                try {
                  const resultado = await crearActualizarSalario({
                    usuario_id: puntoVentaId,
                    empleado_id: empleadoId,
                    salario: salarioValor
                  })
                  
                  setSalarios(prev => prev.map(s => 
                    s.empleado_id === empleadoId ? { ...s, salario: salarioValor } : s
                  ))
                  
                  toast({
                    title: "Éxito",
                    description: "Salario actualizado correctamente",
                  })
                  
                  resetForm()
                } catch (error) {
                  console.error('Error al actualizar salario:', error)
                  toast({
                    title: "Error",
                    description: "No se pudo actualizar el salario",
                    variant: "destructive",
                  })
                }
              }}
              variant="destructive"
              size="sm"
            >
              Actualizar
            </Button>
          ),
        })
        setIsSaving(false)
        return
      }

      const resultado = await crearActualizarSalario({
        usuario_id: puntoVentaId,
        empleado_id: empleadoId,
        salario: salarioValor
      })

      // Buscar nombre del empleado
      const empleado = empleados.find(e => e.id === empleadoId)
      const nombreEmpleado = empleado?.nombre || 'Desconocido'

      if (editingSalario) {
        // Actualizar salario existente
        setSalarios(prev => prev.map(s => 
          s.id === editingSalario.id ? { ...s, salario: salarioValor } : s
        ))
        toast({
          title: "Éxito",
          description: "Salario actualizado correctamente",
        })
      } else {
        // Agregar nuevo salario
        setSalarios(prev => [...prev, {
          id: resultado.id,
          empleado_id: empleadoId,
          empleado_nombre: nombreEmpleado,
          salario: salarioValor
        }])
        toast({
          title: "Éxito",
          description: "Salario creado correctamente",
        })
      }

      resetForm()
    } catch (error) {
      console.error('Error al guardar salario:', error)
      toast({
        title: "Error",
        description: editingSalario ? "No se pudo actualizar el salario" : "No se pudo crear el salario",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = (salario: SalarioData) => {
    setEditingSalario({ ...salario })
    setFormData({
      empleado_id: salario.empleado_id,
      salario: salario.salario.toString()
    })
    setShowForm(true)
  }

  const handleDelete = async (salario: SalarioData) => {
    if (!confirm(`¿Estás seguro de eliminar el salario de ${salario.empleado_nombre}?`)) {
      return
    }

    try {
      setIsDeleting(true)
      await eliminarSalario(salario.id!)
      setSalarios(prev => prev.filter(s => s.id !== salario.id))
      toast({
        title: "Éxito",
        description: "Salario eliminado correctamente",
      })
    } catch (error) {
      console.error('Error al eliminar salario:', error)
      toast({
        title: "Error",
        description: "No se pudo eliminar el salario",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  // Empleados disponibles (sin salario asignado o el que está siendo editado)
  const empleadosDisponibles = empleados.filter(empleado => {
    if (editingSalario && editingSalario.empleado_id === empleado.id) {
      return true // Permitir el empleado actual en edición
    }
    return !salarios.some(s => s.empleado_id === empleado.id)
  })

  const totalSalarios = salarios.reduce((sum, s) => {
    const salario = typeof s.salario === 'number' ? s.salario : parseFloat(s.salario) || 0
    return sum + salario
  }, 0)

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Salarios - {puntoVentaNombre}
          </DialogTitle>
          <DialogDescription>
            Gestiona los salarios de los empleados de este punto de venta
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Resumen de totales */}
          {salarios.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-800">Total de Salarios:</span>
                <span className="text-lg font-bold text-blue-900">
                  ${totalSalarios.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Botón para agregar salario */}
          {!showForm && empleadosDisponibles.length > 0 && (
            <Button
              onClick={() => {
                setEditingSalario(null)
                setFormData({
                  empleado_id: '',
                  salario: ''
                })
                setShowForm(true)
              }}
              className="mb-4"
              disabled={isLoading}
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar Salario
            </Button>
          )}

          {/* Formulario de salario */}
          {showForm && (
            <div className="border rounded-lg p-4 mb-4 bg-gray-50">
              <h3 className="font-semibold mb-3">
                {editingSalario ? 'Editar Salario' : 'Nuevo Salario'}
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Empleado</label>
                  <select
                    value={editingSalario ? editingSalario.empleado_id : formData.empleado_id}
                    onChange={(e) => handleInputChange('empleado_id', e.target.value)}
                    disabled={isSaving || editingSalario !== null}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="">Seleccionar empleado...</option>
                    {empleadosDisponibles.map(empleado => (
                      <option key={empleado.id} value={empleado.id}>
                        {empleado.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Salario (CUP)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingSalario ? editingSalario.salario : formData.salario}
                      onChange={(e) =>
                        editingSalario
                          ? handleEditInputChange('salario', parseFloat(e.target.value))
                          : handleInputChange('salario', e.target.value)
                      }
                      placeholder="0.00"
                      disabled={isSaving}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {editingSalario ? 'Actualizar' : 'Crear'}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={resetForm}
                    disabled={isSaving}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Mensaje si no hay empleados disponibles */}
          {!showForm && empleadosDisponibles.length === 0 && empleados.length > 0 && (
            <div className="text-center py-4 text-orange-600 bg-orange-50 border border-orange-200 rounded-lg mb-4">
              Todos los empleados ya tienen salario asignado
            </div>
          )}

          {/* Tabla de salarios */}
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : salarios.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No hay salarios registrados para este punto de venta
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empleado</TableHead>
                    <TableHead>Salario</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salarios.map((salario) => (
                    <TableRow key={salario.id}>
                      <TableCell className="font-medium">
                        {salario.empleado_nombre}
                      </TableCell>
                      <TableCell className="font-bold text-green-700">
                        ${typeof salario.salario === 'number' ? salario.salario.toFixed(2) : parseFloat(salario.salario).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(salario)}
                            disabled={isDeleting}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(salario)}
                            disabled={isDeleting}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}