import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Shield, Plus, Edit, Trash2, Calendar, ClipboardList, Loader2, UserCheck, UserX, Phone, 
  ClipboardCheck, FileSpreadsheet, Download, AlertTriangle, Eye, CheckCircle2, XCircle,
  PackageCheck, ArrowRightLeft, Layers
} from 'lucide-react';
import { toast } from "@/hooks/use-toast";
import {
  getModeradores,
  crearModerador,
  editarModerador,
  eliminarModerador,
  getBitacoraModerador,
  getInventariosModerador,
  getInventarioDetalle,
  eliminarInventario
} from '../app/services/api';

interface Moderador {
  id: string;
  nombre: string;
  telefono: string;
  rol: string;
  activo: boolean;
}

interface ResumenEntregaItem {
  nombre: string;
  cantidad: number;
  precio_compra: number;
  subtotal: number;
}

interface ResumenEntrega {
  total_unidades: number;
  total_monto: number;
  items: ResumenEntregaItem[];
}

interface LogEntry {
  id: string;
  moderador_id: number;
  accion: string;
  detalles: string;
  fecha: string;
  resumen_entrega?: ResumenEntrega;
}

type BitacoraFilter = 'todos' | 'inventarios' | 'creacion_edicion' | 'entregas' | 'bajas' | 'traslados';

export default function ModeradoresSection() {
  const [moderadores, setModeradores] = useState<Moderador[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Dialogs
  const [showAddEditDialog, setShowAddEditDialog] = useState(false);
  const [showOptionsDialog, setShowOptionsDialog] = useState(false);
  const [showBitacoraDialog, setShowBitacoraDialog] = useState(false);
  const [showInventariosDialog, setShowInventariosDialog] = useState(false);
  const [showInventarioDetalleDialog, setShowInventarioDetalleDialog] = useState(false);
  
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
  const [bitacoraFilter, setBitacoraFilter] = useState<BitacoraFilter>('todos');

  // Inventarios
  const [inventariosList, setInventariosList] = useState<any[]>([]);
  const [loadingInventarios, setLoadingInventarios] = useState(false);
  const [selectedInventarioDetalle, setSelectedInventarioDetalle] = useState<any | null>(null);
  const [loadingInventarioDetalle, setLoadingInventarioDetalle] = useState(false);

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

  const handleOpenInventarios = async (mod: Moderador) => {
    setSelectedModerador(mod);
    setShowOptionsDialog(false);
    setShowInventariosDialog(true);
    try {
      setLoadingInventarios(true);
      const data = await getInventariosModerador(mod.id);
      setInventariosList(data);
    } catch (error) {
      toast({ title: "Error", description: "No se pudieron cargar los inventarios", variant: "destructive" });
    } finally {
      setLoadingInventarios(false);
    }
  };

  const handleVerDetalleInventario = async (invId: number) => {
    try {
      setLoadingInventarioDetalle(true);
      setShowInventarioDetalleDialog(true);
      const data = await getInventarioDetalle(invId);
      setSelectedInventarioDetalle(data);
    } catch (error) {
      toast({ title: "Error", description: "No se pudo cargar el detalle del inventario", variant: "destructive" });
    } finally {
      setLoadingInventarioDetalle(false);
    }
  };

  const handleExportarExcel = (inv: any) => {
    if (!inv || !inv.detalles || inv.detalles.length === 0) {
      toast({ title: "Atención", description: "No hay detalles para exportar", variant: "default" });
      return;
    }

    try {
      const dataExport = inv.detalles.map((d: any, index: number) => ({
        'N°': index + 1,
        'Código de Barras': d.codigo_barras || 'N/A',
        'Producto': d.nombre_producto,
        'Variante / Parámetro': d.parametro_nombre || '-',
        'Cantidad en Sistema': Number(d.cantidad_sistema),
        'Cantidad Física Real': Number(d.cantidad_fisica),
        'Diferencia': Number(d.diferencia),
        'Estado': Number(d.diferencia) === 0 ? 'Exacto' : (Number(d.diferencia) > 0 ? 'Sobrante (+)' : 'Faltante (-)'),
        'Precio Compra': Number(d.precio_compra || 0),
        'Precio Venta': Number(d.precio_venta || 0),
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dataExport);

      ws['!cols'] = [
        { wch: 6 },
        { wch: 20 },
        { wch: 35 },
        { wch: 20 },
        { wch: 18 },
        { wch: 18 },
        { wch: 14 },
        { wch: 16 },
        { wch: 14 },
        { wch: 14 }
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Auditoria");

      const fechaStr = new Date(inv.fecha).toISOString().split('T')[0];
      const safePunto = (inv.punto_venta_nombre || 'Punto').replace(/[^a-zA-Z0-9_-]/g, '_');
      XLSX.writeFile(wb, `Inventario_${safePunto}_${fechaStr}.xlsx`);

      toast({ title: "Éxito", description: "Informe exportado a Excel correctamente" });
    } catch (error) {
      console.error("Error al exportar inventario a Excel:", error);
      toast({ title: "Error", description: "No se pudo generar el archivo Excel", variant: "destructive" });
    }
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
    setBitacoraFilter('todos');
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

  const matchesFilter = (log: LogEntry, filter: BitacoraFilter) => {
    if (filter === 'todos') return true;
    const accion = (log.accion || '').toLowerCase();
    const detalles = (log.detalles || '').toLowerCase();

    switch (filter) {
      case 'inventarios':
        return accion.includes('inventario') || detalles.includes('inventario') || detalles.includes('auditoría');
      case 'creacion_edicion':
        return accion.startsWith('crear') || accion.startsWith('editar') || detalles.startsWith('creó') || detalles.startsWith('editó');
      case 'entregas':
        return accion.includes('entreg') || detalles.startsWith('entregó');
      case 'bajas':
        return accion.includes('baja') || accion.includes('eliminar') || detalles.includes('baja') || detalles.includes('eliminó');
      case 'traslados':
        return accion.includes('mover') || accion.includes('traslado') || accion.includes('transfer') || detalles.startsWith('transfirió');
      default:
        return true;
    }
  };

  const getEntregaInfo = (log: LogEntry): ResumenEntrega => {
    if (log.resumen_entrega && (log.resumen_entrega.items?.length > 0 || log.resumen_entrega.total_unidades > 0)) {
      return log.resumen_entrega;
    }

    const text = log.detalles || '';
    const multiMatch = text.match(/^(?:Entregó\s+)?(\d+)\s+unidades\s+totales\s*\((.+?)\)(?:\s+al\s+punto\s+de\s+venta|\s*$)/i);
    const singleMatch = text.match(/^(?:Entregó\s+)?(\d+)\s+unidades\s+de\s+["']([^"']+)["']/i);
    const fallbackMatch = text.match(/^(?:Entregó\s+)?(\d+)\s+unidades\s+totales/i);

    let items: ResumenEntregaItem[] = [];
    let totalUnidades = 0;

    if (multiMatch) {
      totalUnidades = parseInt(multiMatch[1], 10) || 0;
      const inner = multiMatch[2];
      const itemRegex = /["']([^"']+)["']\s*:\s*(\d+)/g;
      let m;
      while ((m = itemRegex.exec(inner)) !== null) {
        items.push({
          nombre: m[1].trim(),
          cantidad: parseInt(m[2], 10) || 0,
          precio_compra: 0,
          subtotal: 0
        });
      }
      if (items.length > 0) {
        totalUnidades = items.reduce((sum, it) => sum + it.cantidad, 0);
      }
    } else if (singleMatch) {
      const qty = parseInt(singleMatch[1], 10) || 0;
      totalUnidades = qty;
      items.push({
        nombre: singleMatch[2].trim(),
        cantidad: qty,
        precio_compra: 0,
        subtotal: 0
      });
    } else if (fallbackMatch) {
      totalUnidades = parseInt(fallbackMatch[1], 10) || 0;
    }

    return {
      total_unidades: totalUnidades,
      total_monto: 0,
      items
    };
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

  const filteredLogs = logs.filter(log => matchesFilter(log, bitacoraFilter));
  const groupedLogs = groupLogsByDate(filteredLogs);

  const filterCounts: Record<BitacoraFilter, number> = {
    todos: logs.length,
    inventarios: logs.filter(l => matchesFilter(l, 'inventarios')).length,
    creacion_edicion: logs.filter(l => matchesFilter(l, 'creacion_edicion')).length,
    entregas: logs.filter(l => matchesFilter(l, 'entregas')).length,
    bajas: logs.filter(l => matchesFilter(l, 'bajas')).length,
    traslados: logs.filter(l => matchesFilter(l, 'traslados')).length,
  };

  const entregasFiltradas = filteredLogs.filter(l => matchesFilter(l, 'entregas'));
  const totalEntregasUnidades = entregasFiltradas.reduce((sum, l) => sum + (getEntregaInfo(l).total_unidades || 0), 0);
  const totalEntregasMonto = entregasFiltradas.reduce((sum, l) => sum + (getEntregaInfo(l).total_monto || 0), 0);

  const getActionBadge = (accion: string) => {
    switch (accion) {
      case 'inventario_fisico':
        return {
          label: 'Inventario Realizado',
          classes: 'bg-emerald-100 text-emerald-800 border-emerald-200'
        };
      case 'crear_producto':
        return {
          label: 'Creación',
          classes: 'bg-emerald-100 text-emerald-800 border-emerald-200'
        };
      case 'editar_producto':
        return {
          label: 'Edición',
          classes: 'bg-cyan-100 text-cyan-800 border-cyan-200'
        };
      case 'entregar_producto':
        return {
          label: 'Entrega',
          classes: 'bg-blue-100 text-blue-800 border-blue-200'
        };
      case 'mover_vendedores':
        return {
          label: 'Traslado',
          classes: 'bg-amber-100 text-amber-800 border-amber-200'
        };
      case 'eliminar_producto':
        return {
          label: 'Baja',
          classes: 'bg-red-100 text-red-800 border-red-200'
        };
      case 'ver_transacciones':
        return {
          label: 'Consulta Historial',
          classes: 'bg-purple-100 text-purple-800 border-purple-200'
        };
      default:
        return {
          label: accion.replace(/_/g, ' '),
          classes: 'bg-gray-100 text-gray-800 border-gray-200'
        };
    }
  };

  const filterOptions: {
    id: BitacoraFilter;
    label: string;
    icon: React.ReactNode;
    activeClasses: string;
  }[] = [
    {
      id: 'todos',
      label: 'Todos',
      icon: <Layers className="w-3.5 h-3.5" />,
      activeClasses: 'bg-orange-600 text-white border-orange-600 shadow-sm'
    },
    {
      id: 'inventarios',
      label: 'Inventarios Realizados',
      icon: <ClipboardCheck className="w-3.5 h-3.5" />,
      activeClasses: 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
    },
    {
      id: 'creacion_edicion',
      label: 'Creación/Edición',
      icon: <Edit className="w-3.5 h-3.5" />,
      activeClasses: 'bg-cyan-700 text-white border-cyan-700 shadow-sm'
    },
    {
      id: 'entregas',
      label: 'Entregas',
      icon: <PackageCheck className="w-3.5 h-3.5" />,
      activeClasses: 'bg-blue-600 text-white border-blue-600 shadow-sm'
    },
    {
      id: 'bajas',
      label: 'Bajas',
      icon: <Trash2 className="w-3.5 h-3.5" />,
      activeClasses: 'bg-red-600 text-white border-red-600 shadow-sm'
    },
    {
      id: 'traslados',
      label: 'Traslados',
      icon: <ArrowRightLeft className="w-3.5 h-3.5" />,
      activeClasses: 'bg-amber-600 text-white border-amber-600 shadow-sm'
    },
  ];

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
              onClick={() => selectedModerador && handleOpenInventarios(selectedModerador)}
              className="bg-emerald-50 border border-emerald-200 text-emerald-950 hover:bg-emerald-100 flex items-center justify-start gap-3 h-12 text-left"
            >
              <ClipboardCheck className="w-5 h-5 text-emerald-600" />
              <div>
                <div className="font-bold text-sm">Inventarios Realizados</div>
                <div className="text-xs text-emerald-600 font-normal">Auditorías físicas vs virtual</div>
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
        <DialogContent className="w-[96vw] sm:max-w-2xl max-h-[92vh] sm:max-h-[88vh] flex flex-col p-3.5 sm:p-6 overflow-hidden gap-0">
          <DialogHeader className="shrink-0 pb-2 pr-7 sm:pr-0 border-b border-gray-100">
            <DialogTitle className="text-lg sm:text-xl font-bold text-orange-950 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600 shrink-0" />
              <span className="truncate">Bitácora: {selectedModerador?.nombre}</span>
            </DialogTitle>
          </DialogHeader>

          {/* SECCIÓN FIJA DE FILTROS Y RESÚMENES (SIEMPRE VISIBLE Y RESPONSIVE) */}
          <div className="shrink-0 space-y-2 py-2.5 border-b border-gray-150 bg-white z-10">
            {/* BARRA DE FILTROS RESPONSIVE */}
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar scroll-smooth">
              {filterOptions.map(opt => {
                const isSelected = bitacoraFilter === opt.id;
                const count = filterCounts[opt.id];
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setBitacoraFilter(opt.id)}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 border cursor-pointer shrink-0 ${
                      isSelected
                        ? opt.activeClasses
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900 active:bg-gray-100'
                    }`}
                  >
                    {opt.icon}
                    <span>{opt.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none ${
                        isSelected ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* BANNER ESPECÍFICO CUANDO SE SELECCIONA EL FILTRO ENTREGAS */}
            {bitacoraFilter === 'entregas' && entregasFiltradas.length > 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-2.5 sm:p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shadow-xs">
                <div>
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-blue-900 block">
                    Resumen de Entregas Filtradas
                  </span>
                  <span className="text-xs text-blue-700 font-medium">
                    {entregasFiltradas.length} {entregasFiltradas.length === 1 ? 'despacho registrado' : 'despachos registrados'}
                  </span>
                </div>
                <div className="sm:text-right">
                  <span className="text-sm sm:text-base font-extrabold text-blue-950 block">
                    {totalEntregasUnidades.toLocaleString('en-US')} unidades entregadas
                  </span>
                  <span className="text-xs font-bold text-blue-800">
                    Monto total: {totalEntregasMonto.toLocaleString('en-US')} cup
                  </span>
                </div>
              </div>
            )}

            {/* BANNER ESPECÍFICO CUANDO SE SELECCIONA EL FILTRO INVENTARIOS */}
            {bitacoraFilter === 'inventarios' && filterCounts.inventarios > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 sm:p-2.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="text-xs text-emerald-800">
                  Auditorías físicas realizadas por este moderador
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowBitacoraDialog(false);
                    if (selectedModerador) handleOpenInventarios(selectedModerador);
                  }}
                  className="border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs h-7"
                >
                  Ver auditorías con Excel →
                </Button>
              </div>
            )}
          </div>

          {/* LISTA SCROLLABLE DE LOGS (CON MIN-H-0 PARA QUE EL SCROLL NO EMPUJE O TAPE LOS FILTROS) */}
          <div className="flex-1 overflow-y-auto min-h-0 pr-1 sm:pr-2 py-3 sm:py-4 space-y-4 sm:space-y-6">
            {loadingLogs ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
              </div>
            ) : Object.keys(groupedLogs).length > 0 ? (
              Object.keys(groupedLogs).map(dateStr => (
                <div key={dateStr} className="space-y-3">
                  <h4 className="font-bold text-orange-800 text-xs sm:text-sm flex items-center gap-1.5 bg-orange-50/70 p-2 rounded border border-orange-100">
                    <Calendar className="w-4 h-4 shrink-0" />
                    <span>{dateStr}</span>
                  </h4>
                  <div className="relative pl-5 sm:pl-6 ml-2 sm:ml-3 border-l-2 border-orange-100 space-y-3 sm:space-y-4">
                    {groupedLogs[dateStr].map(log => {
                      const logTime = new Date(log.fecha).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                      const badge = getActionBadge(log.accion);

                      return (
                        <div key={log.id} className="relative">
                          {/* Dot on the timeline */}
                          <div className="absolute -left-[27px] sm:-left-[31px] top-1.5 w-2.5 h-2.5 rounded-full bg-orange-400 border border-white"></div>
                          
                          <div className="bg-white p-3 sm:p-3.5 rounded-md border border-gray-150 shadow-xs space-y-2">
                            <div className="flex justify-between items-center gap-2">
                              <span className={`inline-block border text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${badge.classes}`}>
                                {badge.label}
                              </span>
                              <span className="text-[11px] sm:text-xs text-gray-400 font-medium shrink-0">{logTime}</span>
                            </div>
                            <div className="text-sm text-gray-700 leading-relaxed font-normal">
                              {(() => {
                                const isEntrega = log.accion === 'entregar_producto' || (log.detalles && log.detalles.toLowerCase().startsWith('entregó'));

                                if (isEntrega) {
                                  const entrega = getEntregaInfo(log);
                                  const posMatch = log.detalles.match(/al punto de venta\s+["']([^"']+)["']/i);
                                  const posName = posMatch ? posMatch[1] : null;

                                  return (
                                    <div className="space-y-2">
                                      <div className="font-semibold text-gray-800 text-sm">
                                        {posName ? (
                                          <>
                                            Entrega al punto de venta: <span className="font-bold text-orange-950">&quot;{posName}&quot;</span>
                                          </>
                                        ) : (
                                          <>Entrega realizada:</>
                                        )}
                                      </div>

                                      {entrega.items && entrega.items.length > 0 ? (
                                        <ul className="list-disc pl-5 mt-1 space-y-1 text-gray-700">
                                          {entrega.items.map((it, idx) => (
                                            <li key={idx} className="text-sm text-gray-700">
                                              <span className="font-medium text-gray-900">{it.nombre}</span>: {it.cantidad} {it.cantidad === 1 ? 'unidad' : 'unidades'}
                                              {it.precio_compra > 0 ? (
                                                <span className="text-xs text-gray-500 ml-1.5 font-normal">
                                                  (${it.precio_compra.toLocaleString('en-US')} cup c/u)
                                                </span>
                                              ) : null}
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <p className="text-sm text-gray-600">{log.detalles}</p>
                                      )}

                                      {/* Resumen en negritas al final de la lista de entrega */}
                                      <div className="mt-2.5 pt-2 border-t border-gray-150 bg-gray-50/80 -mx-3 sm:-mx-3.5 -mb-3 sm:-mb-3.5 p-2.5 sm:p-3 rounded-b-md">
                                        <p className="text-xs sm:text-sm font-bold text-gray-900 break-words">
                                          {entrega.total_unidades.toLocaleString('en-US')} unidades entregadas por un monto de {entrega.total_monto.toLocaleString('en-US')} cup
                                        </p>
                                      </div>
                                    </div>
                                  );
                                }

                                if (log.accion === 'inventario_fisico') {
                                  return (
                                    <div className="space-y-2">
                                      <div className="text-sm text-gray-800 leading-relaxed font-normal">
                                        {log.detalles}
                                      </div>
                                      <div className="pt-1">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            setShowBitacoraDialog(false);
                                            if (selectedModerador) handleOpenInventarios(selectedModerador);
                                          }}
                                          className="border-emerald-200 text-emerald-800 hover:bg-emerald-50 text-xs h-7 flex items-center gap-1.5"
                                        >
                                          <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600" />
                                          Ver auditorías de inventario
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                }

                                const detalles = log.detalles;

                                // Check for pipe-separated details (crear_producto / editar_producto)
                                if (detalles.includes(' | ')) {
                                  const parts = detalles.split(' | ');
                                  return (
                                    <div className="space-y-1 text-gray-700">
                                      {parts.map((part, idx) => {
                                        if (part.includes('Parámetros: ')) {
                                          const paramMatch = part.match(/^(Parámetros:\s*)(.+)$/);
                                          if (paramMatch) {
                                            const [_, paramPrefix, paramsList] = paramMatch;
                                            const params = paramsList.split(/,\s*/);
                                            return (
                                              <div key={idx} className="mt-1">
                                                <span className="font-semibold text-gray-800">{paramPrefix}</span>
                                                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                                                  {params.map((p, pIdx) => (
                                                    <li key={pIdx} className="text-sm font-normal text-gray-600">{p}</li>
                                                  ))}
                                                </ul>
                                              </div>
                                            );
                                          }
                                        }
                                        return (
                                          <div key={idx} className="text-sm text-gray-600">
                                            • {part}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                }

                                if (detalles.includes('Parámetros: ')) {
                                  const paramMatch = detalles.match(/^(.*Parámetros:\s*)(.+)$/);
                                  if (paramMatch) {
                                    const [_, prefix, paramsList] = paramMatch;
                                    const params = paramsList.split(/,\s*/);
                                    return (
                                      <div className="space-y-1 text-gray-700">
                                        <span className="font-medium">{prefix}</span>
                                        <ul className="list-disc pl-5 mt-1 space-y-1 text-gray-600">
                                          {params.map((p, idx) => (
                                            <li key={idx} className="text-sm font-normal">{p}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    );
                                  }
                                }

                                return <p className="text-sm text-gray-700 leading-relaxed font-normal">{detalles}</p>;
                              })()}
                            </div>
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
                <p className="font-medium text-sm text-gray-700">
                  {bitacoraFilter === 'todos'
                    ? 'No hay acciones registradas en la bitácora'
                    : `No hay registros en la categoría "${filterOptions.find(o => o.id === bitacoraFilter)?.label || bitacoraFilter}"`}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {bitacoraFilter === 'todos'
                    ? 'Las operaciones que realice el moderador se verán reflejadas aquí por día'
                    : 'Prueba seleccionando otro filtro para ver más actividad'}
                </p>
                {bitacoraFilter !== 'todos' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBitacoraFilter('todos')}
                    className="mt-3 text-xs border-orange-200 text-orange-700 hover:bg-orange-50"
                  >
                    Ver todas las acciones ({logs.length})
                  </Button>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 border-t border-gray-150 pt-3 sm:pt-4 bg-white">
            <Button onClick={() => setShowBitacoraDialog(false)} className="w-full sm:w-auto">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* INVENTARIOS LIST DIALOG */}
      <Dialog open={showInventariosDialog} onOpenChange={setShowInventariosDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-emerald-950 flex items-center gap-2">
              <ClipboardCheck className="w-6 h-6 text-emerald-600" />
              Inventarios Físicos: {selectedModerador?.nombre}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2 py-4 space-y-4">
            {loadingInventarios ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              </div>
            ) : inventariosList.length > 0 ? (
              <div className="grid grid-cols-1 gap-3">
                {inventariosList.map(inv => {
                  const fecha = new Date(inv.fecha).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  const hasDiscrepancies = Number(inv.total_discrepancias) > 0;

                  return (
                    <div
                      key={inv.id}
                      className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:border-emerald-300 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800 text-base">
                            📍 {inv.punto_venta_nombre}
                          </span>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full font-medium">
                            {fecha}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-600 mt-1">
                          <span>📦 Total auditados: <strong className="text-gray-800">{inv.total_items_auditados}</strong></span>
                          <span className="text-gray-300">|</span>
                          <span className={`inline-flex items-center gap-1 font-semibold ${hasDiscrepancies ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {hasDiscrepancies ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            {inv.total_discrepancias} {inv.total_discrepancias === 1 ? 'diferencia' : 'diferencias'}
                          </span>
                        </div>
                        {inv.observaciones ? (
                          <p className="text-xs text-gray-500 italic mt-1 bg-gray-50 p-1.5 rounded">
                            &quot;{inv.observaciones}&quot;
                          </p>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-auto">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleVerDetalleInventario(inv.id)}
                          className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 flex items-center gap-1.5"
                        >
                          <Eye className="w-4 h-4" /> Ver Detalle
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <ClipboardCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="font-medium text-sm">No hay inventarios registrados por este moderador</p>
                <p className="text-xs text-gray-400 mt-1">Las auditorías de inventario físico vs virtual se listarán aquí</p>
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            <Button onClick={() => setShowInventariosDialog(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* INVENTARIO DETALLE DIALOG (RESPONSIVE MOBILE FIRST) */}
      <Dialog open={showInventarioDetalleDialog} onOpenChange={setShowInventarioDetalleDialog}>
        <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden">
          <DialogHeader className="space-y-2 pb-2 border-b">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pr-6 sm:pr-0">
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 shrink-0" />
                  <span>Auditoría: {selectedInventarioDetalle?.punto_venta_nombre}</span>
                </DialogTitle>
                <p className="text-xs text-gray-500 mt-1">
                  📅 {selectedInventarioDetalle && new Date(selectedInventarioDetalle.fecha).toLocaleString('es-ES')} 
                  <span className="hidden sm:inline"> | 👤 Moderador: {selectedInventarioDetalle?.moderador_nombre || selectedModerador?.nombre}</span>
                </p>
              </div>
              {selectedInventarioDetalle && (
                <Button
                  onClick={() => handleExportarExcel(selectedInventarioDetalle)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 w-full sm:w-auto justify-center text-xs sm:text-sm py-2 h-auto"
                  size="sm"
                >
                  <Download className="w-4 h-4" /> Descargar Excel
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 py-3 space-y-4">
            {loadingInventarioDetalle ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              </div>
            ) : selectedInventarioDetalle ? (
              <div className="space-y-4">
                {/* Resumen Cards (Mobile first grid) */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="bg-gray-50 p-2.5 sm:p-3 rounded-lg border border-gray-200 text-center">
                    <span className="text-[10px] sm:text-xs text-gray-500 block font-medium">Auditados</span>
                    <span className="text-base sm:text-xl font-extrabold text-gray-800">{selectedInventarioDetalle.total_items_auditados}</span>
                  </div>
                  <div className="bg-emerald-50 p-2.5 sm:p-3 rounded-lg border border-emerald-200 text-center">
                    <span className="text-[10px] sm:text-xs text-emerald-700 block font-medium">Exactos</span>
                    <span className="text-base sm:text-xl font-extrabold text-emerald-800">
                      {selectedInventarioDetalle.detalles?.filter((d: any) => Number(d.diferencia) === 0).length || 0}
                    </span>
                  </div>
                  <div className="bg-amber-50 p-2.5 sm:p-3 rounded-lg border border-amber-200 text-center">
                    <span className="text-[10px] sm:text-xs text-amber-700 block font-medium">Discrepancias</span>
                    <span className="text-base sm:text-xl font-extrabold text-amber-800">{selectedInventarioDetalle.total_discrepancias}</span>
                  </div>
                </div>

                {selectedInventarioDetalle.observaciones ? (
                  <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-2.5 sm:p-3 text-xs text-amber-900">
                    <strong className="block mb-0.5 text-amber-950 font-semibold">Notas / Observaciones:</strong>
                    &quot;{selectedInventarioDetalle.observaciones}&quot;
                  </div>
                ) : null}

                {/* Vista Móvil: Tarjetas compactas (visible solo en pantallas pequeñas < md) */}
                <div className="space-y-2.5 md:hidden">
                  {selectedInventarioDetalle.detalles?.map((d: any) => {
                    const diff = Number(d.diferencia);
                    const isExact = diff === 0;
                    const isSurplus = diff > 0;

                    return (
                      <div 
                        key={d.id} 
                        className={`p-3 rounded-lg border ${
                          !isExact 
                            ? 'bg-amber-50/30 border-amber-300' 
                            : 'bg-white border-gray-200'
                        } space-y-2`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="font-bold text-gray-900 text-sm block">
                              {d.nombre_producto}
                            </span>
                            {d.parametro_nombre ? (
                              <span className="text-xs text-orange-600 font-medium">
                                Variante: {d.parametro_nombre}
                              </span>
                            ) : null}
                            <span className="text-[11px] text-gray-400 font-mono block">
                              Cód: {d.codigo_barras || 'N/A'}
                            </span>
                          </div>
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                            isExact 
                              ? 'bg-gray-50 text-gray-600 border-gray-200' 
                              : (isSurplus ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200')
                          }`}>
                            {isExact ? 'Exacto' : (isSurplus ? `Sobrante (+${diff})` : `Faltante (${diff})`)}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 bg-gray-50/80 p-2 rounded border border-gray-150 text-center text-xs">
                          <div>
                            <span className="text-[10px] text-gray-400 block">Sistema</span>
                            <span className="font-semibold text-gray-700">{d.cantidad_sistema}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-400 block">Físico</span>
                            <span className="font-bold text-gray-900">{d.cantidad_fisica}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-400 block">Diferencia</span>
                            <span className={`font-extrabold ${isExact ? 'text-gray-400' : isSurplus ? 'text-emerald-600' : 'text-red-600'}`}>
                              {isSurplus ? `+${diff}` : diff}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Vista Escritorio / Tablet: Tabla completa (oculta en mobile, visible en >= md) */}
                <div className="hidden md:block border rounded-lg overflow-hidden bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-100 text-gray-700 font-semibold border-b text-xs uppercase">
                        <tr>
                          <th className="p-3">Producto / Variante</th>
                          <th className="p-3">Código</th>
                          <th className="p-3 text-center">Sistema</th>
                          <th className="p-3 text-center">Físico</th>
                          <th className="p-3 text-center">Diferencia</th>
                          <th className="p-3 text-right">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedInventarioDetalle.detalles?.map((d: any) => {
                          const diff = Number(d.diferencia);
                          const isExact = diff === 0;
                          const isSurplus = diff > 0;

                          return (
                            <tr key={d.id} className={!isExact ? 'bg-amber-50/40' : 'hover:bg-gray-50'}>
                              <td className="p-3 font-medium text-gray-800">
                                <div>{d.nombre_producto}</div>
                                {d.parametro_nombre ? (
                                  <div className="text-xs text-orange-600 font-normal">Variante: {d.parametro_nombre}</div>
                                ) : null}
                              </td>
                              <td className="p-3 text-xs text-gray-500 font-mono">
                                {d.codigo_barras || 'N/A'}
                              </td>
                              <td className="p-3 text-center text-gray-600 font-semibold">
                                {d.cantidad_sistema}
                              </td>
                              <td className="p-3 text-center text-gray-900 font-bold">
                                {d.cantidad_fisica}
                              </td>
                              <td className="p-3 text-center font-extrabold">
                                <span className={isExact ? 'text-gray-400' : (isSurplus ? 'text-emerald-600' : 'text-red-600')}>
                                  {isSurplus ? `+${diff}` : diff}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                                  isExact 
                                    ? 'bg-gray-50 text-gray-600 border-gray-200' 
                                    : (isSurplus ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200')
                                }`}>
                                  {isExact ? 'Exacto' : (isSurplus ? 'Sobrante (+)' : 'Faltante (-)')}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter className="border-t pt-3 sm:pt-4">
            <Button className="w-full sm:w-auto" onClick={() => setShowInventarioDetalleDialog(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
