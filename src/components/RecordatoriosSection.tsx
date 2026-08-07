'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { toast } from "@/hooks/use-toast"
import { Plus, Edit, Trash2, Clock, CheckCircle2, AlertCircle, Calendar, Search, Loader2, RefreshCw } from "lucide-react"

export interface Recordatorio {
  id: number;
  texto: string;
  fecha: string; // YYYY-MM-DD
  completado: boolean;
  fecha_creacion?: string;
}

export default function RecordatoriosSection() {
  const [recordatorios, setRecordatorios] = useState<Recordatorio[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Estados para modal Crear / Editar
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [editingRecordatorio, setEditingRecordatorio] = useState<Recordatorio | null>(null);
  const [formTexto, setFormTexto] = useState<string>('');
  const [formFecha, setFormFecha] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Estado para eliminar
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const fetchRecordatorios = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/recordatorios');
      if (!res.ok) throw new Error('Error al cargar recordatorios');
      const data = await res.json();
      setRecordatorios(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching recordatorios:', error);
      toast({
        title: "Error",
        description: "No se pudieron obtener los recordatorios. Asegúrate de haber creado la tabla en la base de datos.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecordatorios();
  }, [fetchRecordatorios]);

  const handleOpenAddModal = () => {
    setEditingRecordatorio(null);
    setFormTexto('');
    // Fecha por defecto: Hoy YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];
    setFormFecha(today);
    setIsDialogOpen(true);
  };

  const handleOpenEditModal = (rec: Recordatorio) => {
    setEditingRecordatorio(rec);
    setFormTexto(rec.texto);
    setFormFecha(rec.fecha);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formTexto.trim()) {
      toast({
        title: "Campo requerido",
        description: "Por favor ingresa un texto para el recordatorio.",
        variant: "destructive"
      });
      return;
    }
    if (!formFecha) {
      toast({
        title: "Campo requerido",
        description: "Por favor selecciona una fecha para el recordatorio.",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      if (editingRecordatorio) {
        // Actualizar
        const res = await fetch('/api/recordatorios', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingRecordatorio.id,
            texto: formTexto,
            fecha: formFecha
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Error al actualizar recordatorio');
        }

        toast({
          title: "Éxito",
          description: "Recordatorio actualizado correctamente.",
        });
      } else {
        // Crear
        const res = await fetch('/api/recordatorios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            texto: formTexto,
            fecha: formFecha
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Error al crear recordatorio');
        }

        toast({
          title: "Éxito",
          description: "Recordatorio agregado correctamente.",
        });
      }

      setIsDialogOpen(false);
      fetchRecordatorios();
      window.dispatchEvent(new Event('notificaciones_updated'));
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error al guardar.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleCompletado = async (rec: Recordatorio) => {
    try {
      const nuevoEstado = !rec.completado;
      const res = await fetch('/api/recordatorios', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rec.id,
          completado: nuevoEstado
        })
      });

      if (!res.ok) throw new Error('No se pudo cambiar el estado');

      setRecordatorios(prev =>
        prev.map(item => item.id === rec.id ? { ...item, completado: nuevoEstado } : item)
      );

      toast({
        title: nuevoEstado ? "Recordatorio Completado" : "Recordatorio Pendiente",
        description: nuevoEstado ? "El recordatorio ya no aparecerá en las notificaciones." : "El recordatorio volverá a notificarse si su fecha ya llegó.",
      });

      window.dispatchEvent(new Event('notificaciones_updated'));
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo cambiar el estado del recordatorio.",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/recordatorios?id=${deletingId}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Error al eliminar');

      toast({
        title: "Eliminado",
        description: "Recordatorio eliminado con éxito."
      });

      setRecordatorios(prev => prev.filter(r => r.id !== deletingId));
      setDeletingId(null);
      window.dispatchEvent(new Event('notificaciones_updated'));
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar el recordatorio.",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredRecordatorios = recordatorios.filter(rec =>
    rec.texto.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rec.fecha.includes(searchTerm)
  );

  const getStatusBadge = (rec: Recordatorio) => {
    if (rec.completado) {
      return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300">Completado</Badge>;
    }
    if (rec.fecha < todayStr) {
      return <Badge className="bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 animate-pulse">Vencido / Pendiente</Badge>;
    }
    if (rec.fecha === todayStr) {
      return <Badge className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300">Para Hoy</Badge>;
    }
    return <Badge className="bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300">Programado</Badge>;
  };

  const totalActivos = recordatorios.filter(r => !r.completado && r.fecha <= todayStr).length;

  return (
    <div className="space-y-6">
      {/* Tarjeta Encabezado */}
      <Card className="border-orange-200 dark:border-orange-900 bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-slate-900 dark:to-slate-800">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="h-6 w-6 text-orange-600" />
              <CardTitle className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">
                Recordatorios de Almacén
              </CardTitle>
            </div>
            <CardDescription className="text-slate-600 dark:text-slate-400 mt-1">
              Programa avisos y tareas. Cuando llegue la fecha, la notificación se mostrará en la campanita.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchRecordatorios}
              disabled={loading}
              className="border-orange-200 hover:bg-orange-100 text-orange-700 dark:border-orange-800 dark:text-orange-300"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
            <Button
              onClick={handleOpenAddModal}
              className="bg-orange-600 hover:bg-orange-700 text-white font-medium shadow-md flex-1 sm:flex-initial"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Agregar Recordatorio
            </Button>
          </div>
        </CardHeader>

        {totalActivos > 0 && (
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 p-3 bg-amber-100/80 dark:bg-amber-950/60 rounded-lg text-amber-900 dark:text-amber-200 text-sm font-medium border border-amber-200 dark:border-amber-800">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
              <span>Tienes <strong>{totalActivos}</strong> recordatorio(s) pendiente(s) notificándose hoy en la campanita.</span>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Buscador y Contenido principal */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por texto o fecha..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 border-slate-200 dark:border-slate-700"
              />
            </div>

            <div className="text-xs text-slate-500 flex gap-4">
              <span>Total: <strong>{recordatorios.length}</strong></span>
              <span>Pendientes: <strong>{recordatorios.filter(r => !r.completado).length}</strong></span>
              <span>Completados: <strong>{recordatorios.filter(r => r.completado).length}</strong></span>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
              <span>Cargando recordatorios...</span>
            </div>
          ) : filteredRecordatorios.length === 0 ? (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              <Calendar className="h-10 w-10 text-slate-400" />
              <p className="font-semibold text-slate-700 dark:text-slate-300">No hay recordatorios encontrados</p>
              <p className="text-xs text-slate-500">Haz clic en el botón de arriba para registrar uno nuevo.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">Estado</th>
                    <th className="py-3 px-4">Texto / Detalle</th>
                    <th className="py-3 px-4 w-36">Fecha Programada</th>
                    <th className="py-3 px-4 w-40 text-center">Estado</th>
                    <th className="py-3 px-4 w-32 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRecordatorios.map((rec) => (
                    <tr
                      key={rec.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                        rec.completado ? 'opacity-60 bg-slate-50/40 dark:bg-slate-900/20' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleCompletado(rec)}
                          className="h-8 w-8 text-slate-400 hover:text-emerald-600"
                          title={rec.completado ? "Marcar como pendiente" : "Marcar como completado"}
                        >
                          <CheckCircle2 className={`h-5 w-5 ${rec.completado ? 'text-emerald-600 fill-emerald-100' : 'text-slate-300'}`} />
                        </Button>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200 break-words">
                        <span className={rec.completado ? 'line-through text-slate-400' : ''}>
                          {rec.texto}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4 text-slate-400" />
                          <span>{rec.fecha}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {getStatusBadge(rec)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEditModal(rec)}
                            className="h-8 w-8 text-slate-600 hover:text-orange-600 hover:bg-orange-50"
                            title="Editar recordatorio"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingId(rec.id)}
                            className="h-8 w-8 text-slate-600 hover:text-red-600 hover:bg-red-50"
                            title="Eliminar recordatorio"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Agregar / Editar Recordatorio */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <Clock className="h-5 w-5 text-orange-600" />
              {editingRecordatorio ? 'Editar Recordatorio' : 'Nuevo Recordatorio'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                Fecha del Recordatorio *
              </label>
              <Input
                type="date"
                value={formFecha}
                onChange={(e) => setFormFecha(e.target.value)}
                className="border-slate-300 dark:border-slate-700"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Al llegar esta fecha, la alerta aparecerá en la campanita de notificaciones.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                Texto del Recordatorio *
              </label>
              <textarea
                placeholder="Escribe aquí la indicación o detalle a recordar..."
                value={formTexto}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormTexto(e.target.value)}
                rows={4}
                className="flex min-h-[80px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 resize-none"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {editingRecordatorio ? 'Guardar Cambios' : 'Crear Recordatorio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación Eliminar */}
      <AlertDialog open={deletingId !== null} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar Recordatorio?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará el aviso y dejará de notificarse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
