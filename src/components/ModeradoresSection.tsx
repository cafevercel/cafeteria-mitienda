import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Shield, Plus, Edit, Trash2, Calendar, ClipboardList, Loader2, UserCheck, UserX, Phone } from 'lucide-react';
import { toast } from "@/hooks/use-toast";
import {
  getModeradores,
  crearModerador,
  editarModerador,
  eliminarModerador,
  getBitacoraModerador
} from '../app/services/api';

interface Moderador {
  id: string;
  nombre: string;
  telefono: string;
  rol: string;
  activo: boolean;
}

interface LogEntry {
  id: string;
  moderador_id: number;
  accion: string;
  detalles: string;
  fecha: string;
}

export default function ModeradoresSection() {
  const [moderadores, setModeradores] = useState<Moderador[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Dialogs
  const [showAddEditDialog, setShowAddEditDialog] = useState(false);
  const [showOptionsDialog, setShowOptionsDialog] = useState(false);
  const [showBitacoraDialog, setShowBitacoraDialog] = useState(false);
  
  // Selected state
  const [selectedModerador, setSelectedModerador] = useState<Moderador | null>(null);
  
  // Form fields
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    password: '',
    activo: true
  });

  // Bitacora logs
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchModeradores = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getModeradores();
      setModeradores(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los moderadores",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModeradores();
  }, [fetchModeradores]);

  const handleOpenAdd = () => {
    setIsEditMode(false);
    setFormData({
      nombre: '',
      telefono: '',
      password: '',
      activo: true
    });
    setShowAddEditDialog(true);
  };

  const handleOpenEdit = (mod: Moderador) => {
    setIsEditMode(true);
    setSelectedModerador(mod);
    setFormData({
      nombre: mod.nombre,
      telefono: mod.telefono || '',
      password: '', // Leave blank unless changing
      activo: mod.activo
    });
    setShowOptionsDialog(false);
    setShowAddEditDialog(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      toast({ title: "Advertencia", description: "El nombre es obligatorio", variant: "default" });
      return;
    }
    if (!isEditMode && !formData.password) {
      toast({ title: "Advertencia", description: "La contraseña es obligatoria para cuentas nuevas", variant: "default" });
      return;
    }

    try {
      if (isEditMode && selectedModerador) {
        const payload: any = {
          nombre: formData.nombre,
          telefono: formData.telefono,
          activo: formData.activo
        };
        if (formData.password.trim()) {
          payload.password = formData.password;
        }
        await editarModerador(selectedModerador.id, payload);
        toast({ title: "Éxito", description: "Moderador actualizado correctamente" });
      } else {
        await crearModerador({
          nombre: formData.nombre,
          telefono: formData.telefono,
          password: formData.password,
          activo: formData.activo
        });
        toast({ title: "Éxito", description: "Moderador creado con éxito" });
      }
      setShowAddEditDialog(false);
      fetchModeradores();
    } catch (error: any) {
      toast({
        title: "Error al guardar",
        description: error.message || "Ocurrió un error inesperado",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (mod: Moderador) => {
    if (!confirm(`¿Estás completamente seguro de que deseas eliminar al moderador "${mod.nombre}"? Se borrará todo su historial de bitácora.`)) {
      return;
    }

    try {
      await eliminarModerador(mod.id);
      toast({ title: "Éxito", description: "Moderador eliminado" });
      setShowOptionsDialog(false);
      fetchModeradores();
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar el moderador", variant: "destructive" });
    }
  };

  const handleOpenBitacora = async (mod: Moderador) => {
    setSelectedModerador(mod);
    setShowOptionsDialog(false);
    setShowBitacoraDialog(true);
    try {
      setLoadingLogs(true);
      const data = await getBitacoraModerador(mod.id);
      setLogs(data);
    } catch (error) {
      toast({ title: "Error", description: "No se pudo cargar la bitácora", variant: "destructive" });
    } finally {
      setLoadingLogs(false);
    }
  };

  // Group logs by local date
  const groupLogsByDate = (logsList: LogEntry[]) => {
    const groups: { [key: string]: LogEntry[] } = {};
    logsList.forEach(log => {
      const dateStr = new Date(log.fecha).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(log);
    });
    return groups;
  };

  const groupedLogs = groupLogsByDate(logs);

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'crear_producto': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'entregar_producto': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'mover_vendedores': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'ver_transacciones': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-lg shadow-sm border border-orange-100">
        <div>
          <h2 className="text-2xl font-bold text-orange-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-orange-600" />
            Moderadores de Almacén
          </h2>
          <p className="text-sm text-orange-600 mt-1">
            Gestiona los accesos y audita la bitácora diaria de acciones de tus moderadores
          </p>
        </div>
        <Button onClick={handleOpenAdd} className="bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nuevo Moderador
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {moderadores.map(mod => (
            <Card
              key={mod.id}
              onClick={() => {
                setSelectedModerador(mod);
                setShowOptionsDialog(true);
              }}
              className="hover:shadow-md cursor-pointer transition-all duration-200 border-orange-100 hover:border-orange-300 relative overflow-hidden group"
            >
              <div className={`absolute top-0 left-0 w-1.5 h-full ${mod.activo ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-orange-50 rounded-full text-orange-600 group-hover:bg-orange-100 transition-colors">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold text-gray-800">{mod.nombre}</CardTitle>
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mt-1 border ${
                        mod.activo 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}>
                        {mod.activo ? (
                          <>
                            <UserCheck className="w-3 h-3" /> Activo
                          </>
                        ) : (
                          <>
                            <UserX className="w-3 h-3" /> Inactivo
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2 text-sm text-gray-600">
                {mod.telefono && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{mod.telefono}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 mt-4 text-orange-700 font-medium group-hover:translate-x-1 transition-transform">
                  <span>Tocar para gestionar</span>
                  <span>→</span>
                </div>
              </CardContent>
            </Card>
          ))}

          {moderadores.length === 0 && (
            <div className="col-span-full text-center py-12 bg-white rounded-lg border border-dashed border-orange-200">
              <Shield className="w-12 h-12 text-orange-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No hay cuentas de moderadores registradas</p>
              <p className="text-xs text-gray-400 mt-1">Crea una cuenta para delegar la gestión del stock</p>
              <Button onClick={handleOpenAdd} variant="outline" className="mt-4 border-orange-200 text-orange-700 hover:bg-orange-50">
                Añadir Primero
              </Button>
            </div>
          )}
        </div>
      )}

      {/* OPTIONS DIALOG */}
      <Dialog open={showOptionsDialog} onOpenChange={setShowOptionsDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-800">
              Gestionar: {selectedModerador?.nombre}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 py-4">
            <Button
              onClick={() => selectedModerador && handleOpenBitacora(selectedModerador)}
              className="bg-orange-50 border border-orange-200 text-orange-950 hover:bg-orange-100 flex items-center justify-start gap-3 h-12 text-left"
            >
              <ClipboardList className="w-5 h-5 text-orange-600" />
              <div>
                <div className="font-bold text-sm">Ver Bitácora</div>
                <div className="text-xs text-orange-600 font-normal">Acciones registradas por día</div>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={() => selectedModerador && handleOpenEdit(selectedModerador)}
              className="flex items-center justify-start gap-3 h-12 text-left hover:bg-gray-50"
            >
              <Edit className="w-5 h-5 text-blue-600" />
              <div>
                <div className="font-bold text-sm">Editar Cuenta</div>
                <div className="text-xs text-gray-500 font-normal">Cambiar nombre, teléfono o clave</div>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={() => selectedModerador && handleDelete(selectedModerador)}
              className="flex items-center justify-start gap-3 h-12 text-left hover:bg-red-50 hover:text-red-900 border-red-100"
            >
              <Trash2 className="w-5 h-5 text-red-600" />
              <div>
                <div className="font-bold text-sm text-red-700">Eliminar Cuenta</div>
                <div className="text-xs text-red-500 font-normal">Borrar moderador permanentemente</div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ADD / EDIT DIALOG */}
      <Dialog open={showAddEditDialog} onOpenChange={setShowAddEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-orange-900">
              {isEditMode ? 'Editar Cuenta de Moderador' : 'Registrar Nuevo Moderador'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre de Usuario</Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Ej. Gilberto Moderador"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="telefono">Teléfono (Opcional)</Label>
              <Input
                id="telefono"
                value={formData.telefono}
                onChange={e => setFormData({ ...formData, telefono: e.target.value })}
                placeholder="Ej. +1 809-555-0199"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">
                {isEditMode ? 'Nueva Contraseña (Dejar en blanco para conservar)' : 'Contraseña de Acceso'}
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                placeholder={isEditMode ? '••••••••' : 'Ingresa la clave de inicio'}
                required={!isEditMode}
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="activo"
                checked={formData.activo}
                onCheckedChange={checked => setFormData({ ...formData, activo: checked as boolean })}
              />
              <Label htmlFor="activo" className="font-semibold text-gray-700 cursor-pointer">
                Cuenta Activa (Habilita el inicio de sesión)
              </Label>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setShowAddEditDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white">
                {isEditMode ? 'Guardar Cambios' : 'Crear Moderador'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* BITACORA DIALOG */}
      <Dialog open={showBitacoraDialog} onOpenChange={setShowBitacoraDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-orange-950 flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-orange-600" />
              Bitácora de Actividad: {selectedModerador?.nombre}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2 py-4 space-y-6">
            {loadingLogs ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
              </div>
            ) : Object.keys(groupedLogs).length > 0 ? (
              Object.keys(groupedLogs).map(dateStr => (
                <div key={dateStr} className="space-y-3">
                  <h4 className="font-bold text-orange-800 text-sm flex items-center gap-1.5 bg-orange-50/70 p-2 rounded border border-orange-100">
                    <Calendar className="w-4 h-4" />
                    {dateStr}
                  </h4>
                  <div className="relative pl-6 ml-3 border-l-2 border-orange-100 space-y-4">
                    {groupedLogs[dateStr].map(log => {
                      const logTime = new Date(log.fecha).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                      return (
                        <div key={log.id} className="relative">
                          {/* Dot on the timeline */}
                          <div className="absolute -left-[31px] top-1 w-2.5 h-2.5 rounded-full bg-orange-400 border border-white"></div>
                          
                          <div className="bg-white p-3.5 rounded-md border border-gray-150 shadow-sm space-y-2">
                            <div className="flex justify-between items-center">
                              <span className={`inline-block border text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${getActionBadgeColor(log.accion)}`}>
                                {log.accion.replace('_', ' ')}
                              </span>
                              <span className="text-xs text-gray-400 font-medium">{logTime}</span>
                            </div>
                            <p className="text-sm text-gray-700 leading-relaxed font-normal">
                              {log.detalles}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="font-medium text-sm">No hay acciones registradas en la bitácora</p>
                <p className="text-xs text-gray-400 mt-1">Las operaciones que realice el moderador se verán reflejadas aquí por día</p>
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            <Button onClick={() => setShowBitacoraDialog(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
