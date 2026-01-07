import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
import { Loader2, Plus, Edit2, Trash2, X, Save } from 'lucide-react'
import { Empleado, NewEmpleado } from '@/types'
import { getEmpleados, createEmpleado, updateEmpleado, deleteEmpleado } from '@/app/services/api'

interface EmpleadosDialogProps {
  puntoVentaId: string;
  puntoVentaNombre: string;
  onClose: () => void;
}

export default function EmpleadosDialog({ puntoVentaId, puntoVentaNombre, onClose }: EmpleadosDialogProps) {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingEmpleado, setEditingEmpleado] = useState<Empleado | null>(null)
  const [formData, setFormData] = useState<NewEmpleado>({
    nombre: '',
    usuario_id: puntoVentaId,
    password: '',
    activo: true
  })

  useEffect(() => {
    cargarEmpleados()
  }, [puntoVentaId])

  const cargarEmpleados = async () => {
    try {
      setIsLoading(true)
      const data = await getEmpleados(puntoVentaId)
      setEmpleados(data)
    } catch (error) {
      console.error('Error al cargar empleados:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los empleados",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: keyof NewEmpleado, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleEditInputChange = (field: keyof Empleado, value: any) => {
    if (editingEmpleado) {
      setEditingEmpleado(prev => ({ ...prev!, [field]: value }))
    }
  }

  const resetForm = () => {
    setFormData({
      nombre: '',
      usuario_id: puntoVentaId,
      password: '',
      activo: true
    })
    setEditingEmpleado(null)
    setShowForm(false)
  }

  const handleSave = async () => {
    // Validar nombre
    const nombreParaValidar = editingEmpleado ? editingEmpleado.nombre : formData.nombre;
    if (!nombreParaValidar.trim()) {
      toast({
        title: "Error",
        description: "El nombre del empleado es requerido",
        variant: "destructive",
      })
      return
    }

    // Validar contraseña para nuevos empleados
    if (!editingEmpleado && !formData.password.trim()) {
      toast({
        title: "Error",
        description: "La contraseña es requerida para crear un empleado",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSaving(true)
      
      if (editingEmpleado) {
        // Actualizar empleado existente
        const updateData: any = {
          nombre: editingEmpleado.nombre,
          activo: editingEmpleado.activo
        }
        
        // Solo incluir password si se ha cambiado
        if (editingEmpleado.password && editingEmpleado.password.trim()) {
          updateData.password = editingEmpleado.password
        }
        
        const updated = await updateEmpleado(editingEmpleado.id, updateData)
        
        setEmpleados(prev => prev.map(e => e.id === updated.id ? updated : e))
        toast({
          title: "Éxito",
          description: "Empleado actualizado correctamente",
        })
      } else {
        // Crear nuevo empleado
        const newEmpleado = await createEmpleado(formData)
        setEmpleados(prev => [...prev, newEmpleado])
        toast({
          title: "Éxito",
          description: "Empleado creado correctamente",
        })
      }
      
      resetForm()
    } catch (error) {
      console.error('Error al guardar empleado:', error)
      toast({
        title: "Error",
        description: editingEmpleado ? "No se pudo actualizar el empleado" : "No se pudo crear el empleado",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = (empleado: Empleado) => {
    setEditingEmpleado({ ...empleado, password: '' }) // Limpiar password por seguridad
    setShowForm(true)
  }

  const handleDelete = async (empleado: Empleado) => {
    if (!confirm(`¿Estás seguro de eliminar a ${empleado.nombre}?`)) {
      return
    }

    try {
      setIsDeleting(true)
      await deleteEmpleado(empleado.id)
      setEmpleados(prev => prev.filter(e => e.id !== empleado.id))
      toast({
        title: "Éxito",
        description: "Empleado eliminado correctamente",
      })
    } catch (error) {
      console.error('Error al eliminar empleado:', error)
      toast({
        title: "Error",
        description: "No se pudo eliminar el empleado",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleToggleActivo = async (empleado: Empleado) => {
    try {
      const updated = await updateEmpleado(empleado.id, { activo: !empleado.activo })
      setEmpleados(prev => prev.map(e => e.id === updated.id ? updated : e))
      toast({
        title: "Éxito",
        description: `Empleado ${updated.activo ? 'activado' : 'desactivado'} correctamente`,
      })
    } catch (error) {
      console.error('Error al actualizar estado del empleado:', error)
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado del empleado",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Empleados - {puntoVentaNombre}
          </DialogTitle>
          <DialogDescription>
            Gestiona los empleados asociados a este punto de venta
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Botón para agregar empleado */}
          {!showForm && (
            <Button
              onClick={() => {
                setEditingEmpleado(null)
                setFormData({
                  nombre: '',
                  usuario_id: puntoVentaId,
                  password: '',
                  activo: true
                })
                setShowForm(true)
              }}
              className="mb-4"
              disabled={isLoading}
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar Empleado
            </Button>
          )}

          {/* Formulario de empleado */}
          {showForm && (
            <div className="border rounded-lg p-4 mb-4 bg-gray-50">
              <h3 className="font-semibold mb-3">
                {editingEmpleado ? 'Editar Empleado' : 'Nuevo Empleado'}
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Nombre</label>
                  <Input
                    value={editingEmpleado ? editingEmpleado.nombre : formData.nombre}
                    onChange={(e) =>
                      editingEmpleado
                        ? handleEditInputChange('nombre', e.target.value)
                        : handleInputChange('nombre', e.target.value)
                    }
                    placeholder="Nombre del empleado"
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Contraseña</label>
                  <Input
                    type="password"
                    value={editingEmpleado ? editingEmpleado.password : formData.password}
                    onChange={(e) =>
                      editingEmpleado
                        ? handleEditInputChange('password', e.target.value)
                        : handleInputChange('password', e.target.value)
                    }
                    placeholder="Contraseña para el login"
                    disabled={isSaving}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="activo"
                    checked={editingEmpleado ? editingEmpleado.activo : formData.activo}
                    onCheckedChange={(checked) => 
                      editingEmpleado 
                        ? handleEditInputChange('activo', checked)
                        : handleInputChange('activo', checked)
                    }
                    disabled={isSaving}
                  />
                  <label htmlFor="activo" className="text-sm font-medium">
                    Empleado activo (tiene acceso al login)
                  </label>
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
                    {editingEmpleado ? 'Actualizar' : 'Crear'}
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

          {/* Tabla de empleados */}
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : empleados.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No hay empleados registrados para este punto de venta
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acceso Login</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empleados.map((empleado) => (
                    <TableRow key={empleado.id}>
                      <TableCell className="font-medium">
                        {empleado.nombre}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          empleado.activo 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {empleado.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={empleado.activo}
                          onCheckedChange={() => handleToggleActivo(empleado)}
                          disabled={isDeleting}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(empleado)}
                            disabled={isDeleting}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(empleado)}
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