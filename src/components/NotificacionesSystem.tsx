import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { 
  Bell, 
  AlertTriangle, 
  Calendar, 
  Package, 
  Users, 
  TrendingUp, 
  Send, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  Flame, 
  AlertOctagon, 
  RefreshCw,
  Search,
  Loader2,
  Award,
  Zap,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Producto, Vendedor, AlertaVendedorStock } from '@/types';
import { getNotificationKey } from './VencimientoBell';
import { cn } from '@/lib/utils';

interface NotificacionesSystemProps {
  isOpen?: boolean;
  onClose?: () => void;
  vendedores?: Vendedor[];
  isFullPage?: boolean;
  initialTab?: 'vencimientos' | 'almacen' | 'vendedores';
}

export const NotificacionesSystem: React.FC<NotificacionesSystemProps> = ({
  isOpen = true,
  onClose,
  vendedores = [],
  isFullPage = false,
  initialTab = 'vencimientos'
}) => {
  const [activeTab, setActiveTab] = useState<'vencimientos' | 'almacen' | 'vendedores'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [subTabVendedores, setSubTabVendedores] = useState<'cantidades' | 'rendimiento'>('cantidades');
  
  // Data states
  const [vencimientos, setVencimientos] = useState<any[]>([]);
  const [filtroVencimiento, setFiltroVencimiento] = useState<'todos' | 'vencidos' | 'vence_pronto' | 'vigentes' | 'con_stock'>('todos');
  const [paginaVencimientos, setPaginaVencimientos] = useState<number>(1);
  const [alertasAlmacen, setAlertasAlmacen] = useState<any[]>([]);
  const [filtroAlmacen, setFiltroAlmacen] = useState<'todos' | 'agotados' | 'bajo_stock'>('todos');
  
  const [vendedoresAlertas, setVendedoresAlertas] = useState<AlertaVendedorStock[]>([]);
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState<string>('todos');
  const [rotacionProductos, setRotacionProductos] = useState<any[]>([]);
  const [productosEstrella, setProductosEstrella] = useState<any[]>([]);
  const [productosEstancados, setProductosEstancados] = useState<any[]>([]);
  const [rankingVendedores, setRankingVendedores] = useState<any[]>([]);
  
  // Filtros tabla de valoración por rotación
  const [vendedorRotacionFiltro, setVendedorRotacionFiltro] = useState<string>('todos');
  const [searchRotacion, setSearchRotacion] = useState<string>('');
  const [filtroEstadoRotacion, setFiltroEstadoRotacion] = useState<'todos' | 'en_existencia' | 'agotado'>('todos');
  const [paginaRotacion, setPaginaRotacion] = useState<number>(1);

  // Vendedores disponibles en rotación
  const vendedoresConRotacion = useMemo(() => {
    const map = new Map<string, string>();
    if (vendedores && vendedores.length > 0) {
      vendedores.forEach(v => map.set(v.id.toString(), v.nombre));
    }
    rotacionProductos.forEach(item => {
      if (item.vendedor_id) {
        map.set(String(item.vendedor_id), item.vendedor_nombre);
      }
    });
    return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [vendedores, rotacionProductos]);

  // Filtrado y ranking de productos por índice de rotación
  const filteredRotacion = useMemo(() => {
    let list = rotacionProductos.filter((item) => {
      if (vendedorRotacionFiltro !== 'todos' && String(item.vendedor_id) !== vendedorRotacionFiltro) {
        return false;
      }
      if (searchRotacion.trim() !== '') {
        const query = searchRotacion.toLowerCase();
        const matchesNombre = item.producto_nombre?.toLowerCase().includes(query);
        const matchesVendedor = item.vendedor_nombre?.toLowerCase().includes(query);
        const matchesSeccion = item.producto_seccion?.toLowerCase().includes(query);
        if (!matchesNombre && !matchesVendedor && !matchesSeccion) return false;
      }
      if (filtroEstadoRotacion === 'en_existencia' && item.estado_stock !== 'en_existencia') {
        return false;
      }
      if (filtroEstadoRotacion === 'agotado' && item.estado_stock !== 'agotado') {
        return false;
      }
      return true;
    });

    // Ordenar de mayor a menor índice de rotación
    list.sort((a, b) => (Number(b.indice_rotacion_diaria) || 0) - (Number(a.indice_rotacion_diaria) || 0));
    return list;
  }, [rotacionProductos, vendedorRotacionFiltro, searchRotacion, filtroEstadoRotacion]);

  // Reiniciar página al cambiar filtros
  useEffect(() => {
    setPaginaRotacion(1);
  }, [vendedorRotacionFiltro, searchRotacion, filtroEstadoRotacion]);

  const itemsPorPagina = 12;
  const totalPaginasRotacion = Math.max(1, Math.ceil(filteredRotacion.length / itemsPorPagina));
  const rotacionPaginada = useMemo(() => {
    const inicio = (paginaRotacion - 1) * itemsPorPagina;
    return filteredRotacion.slice(inicio, inicio + itemsPorPagina);
  }, [filteredRotacion, paginaRotacion]);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const fetchNotificaciones = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/notificaciones');
      if (res.ok) {
        const data = await res.json();
        setVencimientos(data.vencimientos || []);
        setAlertasAlmacen(data.almacen || []);
        if (data.vendedores) {
          setVendedoresAlertas(data.vendedores.alertas || []);
          setRotacionProductos(data.vendedores.rotacionProductos || []);
          setProductosEstrella(data.vendedores.productosEstrella || []);
          setProductosEstancados(data.vendedores.productosEstancados || []);
          setRankingVendedores(data.vendedores.rankingVendedores || []);
        }
      }
    } catch (err) {
      console.error('Error al cargar panel de notificaciones:', err);
      toast({
        title: "Error de carga",
        description: "No se pudieron obtener las notificaciones actualizadas.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const markTabAsRead = useCallback((tab: 'vencimientos' | 'almacen' | 'vendedores' | 'all') => {
    try {
      let readKeysSet = new Set<string>();
      const stored = localStorage.getItem('read_notif_keys');
      if (stored) {
        readKeysSet = new Set(JSON.parse(stored));
      }

      if (tab === 'vencimientos' || tab === 'all') {
        vencimientos.filter(v => v.estado !== 'vigente').forEach(v => {
          readKeysSet.add(getNotificationKey('vencimiento', v));
        });
      }

      if (tab === 'almacen' || tab === 'all') {
        alertasAlmacen.filter(a => a.estado !== 'normal').forEach(a => {
          readKeysSet.add(getNotificationKey('almacen', a));
        });
      }

      localStorage.setItem('read_notif_keys', JSON.stringify(Array.from(readKeysSet)));
      window.dispatchEvent(new Event('notificaciones_updated'));
    } catch (e) {
      console.error('Error marking notifications as read:', e);
    }
  }, [vencimientos, alertasAlmacen]);

  useEffect(() => {
    if (isOpen) {
      fetchNotificaciones();
    }
  }, [isOpen, fetchNotificaciones]);

  useEffect(() => {
    if (isOpen) {
      markTabAsRead(activeTab);
    }
  }, [isOpen, activeTab, markTabAsRead]);

  // QuickNotify Handler
  const handleQuickNotify = (vendedor: AlertaVendedorStock) => {
    const listaCriticos = vendedor.productos_criticos
      .map(p => `- ${p.nombre} (${p.estado === 'agotado' ? 'AGOTADO' : `Stock: ${p.cantidad} / Mín: ${p.stock_minimo}`})`)
      .join('\n');

    const mensaje = `Hola ${vendedor.vendedor_nombre}, este es un aviso sobre tu inventario crítico en punto de venta:\n\n${listaCriticos}\n\nPor favor gestiona la reposición o actualización.`;

    if (vendedor.vendedor_telefono) {
      const cleanPhone = vendedor.vendedor_telefono.replace(/\D/g, '');
      const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(mensaje)}`;
      window.open(url, '_blank');
    } else {
      navigator.clipboard.writeText(mensaje);
      toast({
        title: "Mensaje copiado al portapapeles 📋",
        description: `Se copió la alerta de stock para ${vendedor.vendedor_nombre}. Puedes enviársela directamente.`,
      });
    }
  };

  useEffect(() => {
    setPaginaVencimientos(1);
  }, [searchTerm, filtroVencimiento]);

  // Filtered Vencimientos (excluyendo productos sin existencia / stock 0)
  const vencimientosFiltrados = useMemo(() => {
    return vencimientos.filter(p => {
      if ((Number(p.cantidad) || 0) <= 0) return false;

      const matchSearch = p.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.seccion && p.seccion.toLowerCase().includes(searchTerm.toLowerCase()));
      if (!matchSearch) return false;

      if (filtroVencimiento === 'vencidos') return p.estado === 'vencido';
      if (filtroVencimiento === 'vence_pronto') return p.estado === 'vence_pronto';
      if (filtroVencimiento === 'vigentes') return p.estado === 'vigente';
      if (filtroVencimiento === 'con_stock') return Number(p.cantidad) > 0;
      return true;
    });
  }, [vencimientos, searchTerm, filtroVencimiento]);

  const vencimientosConExistencia = useMemo(() => {
    return vencimientos.filter(v => (Number(v.cantidad) || 0) > 0);
  }, [vencimientos]);

  const totalVencidos = useMemo(() => vencimientosConExistencia.filter(v => v.estado === 'vencido').length, [vencimientosConExistencia]);
  const totalVencePronto = useMemo(() => vencimientosConExistencia.filter(v => v.estado === 'vence_pronto').length, [vencimientosConExistencia]);
  const totalVigentes = useMemo(() => vencimientosConExistencia.filter(v => v.estado === 'vigente').length, [vencimientosConExistencia]);
  const totalConStock = useMemo(() => vencimientosConExistencia.length, [vencimientosConExistencia]);

  const itemsPorPaginaVenc = 20;
  const totalPaginasVencimientos = Math.max(1, Math.ceil(vencimientosFiltrados.length / itemsPorPaginaVenc));
  const vencimientosPaginados = useMemo(() => {
    const inicio = (paginaVencimientos - 1) * itemsPorPaginaVenc;
    return vencimientosFiltrados.slice(inicio, inicio + itemsPorPaginaVenc);
  }, [vencimientosFiltrados, paginaVencimientos]);

  // Filtered Almacen Alertas
  const almacenFiltrado = alertasAlmacen.filter(item => {
    const matchSearch = item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        item.usuario_nombre.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchSearch) return false;
    if (filtroAlmacen === 'agotados') return item.estado === 'agotado';
    if (filtroAlmacen === 'bajo_stock') return item.estado === 'bajo_stock';
    return true;
  });

  // Filtered Vendedores Alertas
  const vendedoresAlertasFiltradas = vendedoresAlertas.filter(v => {
    if (vendedorSeleccionado !== 'todos' && String(v.vendedor_id) !== String(vendedorSeleccionado)) {
      return false;
    }
    return v.vendedor_nombre.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const mainContent = (
    <div className="w-full space-y-4">
      {/* CABECERA RESPONSIVE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <Bell className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500 shrink-0" />
            Panel de Notificaciones y Alertas
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Monitoreo en tiempo real de caducidades, existencias críticas e índice de rotación.
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchNotificaciones} 
          disabled={isLoading}
          className="flex items-center justify-center gap-1.5 text-slate-600 border-orange-200 hover:bg-orange-50 w-full sm:w-auto h-9 text-xs sm:text-sm"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* BUSCADOR RÁPIDO RESPONSIVE */}
      <div className="relative my-2 sm:my-3">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Buscar por producto o vendedor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 h-9 sm:h-10 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border-slate-200 rounded-lg"
        />
      </div>

      {/* PESTAÑAS PRINCIPALES RESPONSIVE */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="w-full">
        <TabsList className="grid grid-cols-3 w-full bg-slate-100 dark:bg-slate-800 p-1 rounded-xl h-auto">
          <TabsTrigger value="vencimientos" className="flex items-center justify-center gap-1 sm:gap-2 py-2 text-[11px] sm:text-sm font-medium">
            <Calendar className="h-3.5 w-3.5 text-red-500 shrink-0" />
            <span className="truncate">Fechas de Vencimiento</span>
            {vencimientosConExistencia.filter(v => v.estado !== 'vigente').length > 0 && (
              <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">
                {vencimientosConExistencia.filter(v => v.estado !== 'vigente').length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="almacen" className="flex items-center justify-center gap-1 sm:gap-2 py-2 text-[11px] sm:text-sm font-medium">
            <Package className="h-3.5 w-3.5 text-orange-500 shrink-0" />
            <span className="truncate">Almacén</span>
            <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-bold">
              {alertasAlmacen.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="vendedores" className="flex items-center justify-center gap-1 sm:gap-2 py-2 text-[11px] sm:text-sm font-medium">
            <Users className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            <span className="truncate">Vendedores</span>
          </TabsTrigger>
        </TabsList>

        {/* 1. PESTAÑA VENCIMIENTOS */}
        <TabsContent value="vencimientos" className="mt-3 sm:mt-4 space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 bg-orange-50 dark:bg-orange-950/40 p-3 rounded-xl border border-orange-200 dark:border-orange-800">
            <span className="text-xs sm:text-sm font-medium text-orange-800 dark:text-orange-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-orange-600" />
              Seguimiento global de fechas de expiración en inventario.
            </span>
            <div className="flex flex-wrap gap-1.5 sm:gap-2 w-full sm:w-auto">
              <Badge variant="destructive" className="bg-red-600 text-[10px] sm:text-xs">🔴 Vencido</Badge>
              <Badge className="bg-amber-500 text-white text-[10px] sm:text-xs">🟡 Vence pronto (≤ 7 días)</Badge>
              <Badge className="bg-emerald-600 text-white text-[10px] sm:text-xs">🟢 Vigente</Badge>
            </div>
          </div>

          {/* Filtros de Vencimiento */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border">
            <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">
              Filtrar por estado:
            </span>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
              <Button
                size="sm"
                variant={filtroVencimiento === 'todos' ? 'default' : 'outline'}
                onClick={() => setFiltroVencimiento('todos')}
                className="h-8 text-xs flex-1 sm:flex-none"
              >
                Todos ({vencimientosConExistencia.length})
              </Button>
              <Button
                size="sm"
                variant={filtroVencimiento === 'vencidos' ? 'destructive' : 'outline'}
                onClick={() => setFiltroVencimiento('vencidos')}
                className={`h-8 text-xs flex-1 sm:flex-none ${filtroVencimiento === 'vencidos' ? 'bg-red-600' : ''}`}
              >
                🔴 Vencidos ({totalVencidos})
              </Button>
              <Button
                size="sm"
                variant={filtroVencimiento === 'vence_pronto' ? 'default' : 'outline'}
                onClick={() => setFiltroVencimiento('vence_pronto')}
                className={`h-8 text-xs flex-1 sm:flex-none ${filtroVencimiento === 'vence_pronto' ? 'bg-amber-600 text-white' : ''}`}
              >
                🟡 Vence pronto ({totalVencePronto})
              </Button>
              <Button
                size="sm"
                variant={filtroVencimiento === 'vigentes' ? 'default' : 'outline'}
                onClick={() => setFiltroVencimiento('vigentes')}
                className={`h-8 text-xs flex-1 sm:flex-none ${filtroVencimiento === 'vigentes' ? 'bg-emerald-600 text-white' : ''}`}
              >
                🟢 Vigentes ({totalVigentes})
              </Button>
              <Button
                size="sm"
                variant={filtroVencimiento === 'con_stock' ? 'default' : 'outline'}
                onClick={() => setFiltroVencimiento('con_stock')}
                className={`h-8 text-xs flex-1 sm:flex-none ${filtroVencimiento === 'con_stock' ? 'bg-blue-600 text-white' : ''}`}
              >
                📦 Con Stock ({totalConStock})
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12 sm:py-16 border rounded-xl bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 animate-spin text-orange-500 mx-auto" />
              <p className="font-semibold text-xs sm:text-sm text-slate-700 dark:text-slate-300">Cargando notificaciones y vencimientos...</p>
            </div>
          ) : vencimientosFiltrados.length === 0 ? (
            <div className="text-center py-8 sm:py-10 border rounded-xl bg-slate-50 dark:bg-slate-900">
              <CheckCircle2 className="h-10 w-10 sm:h-12 sm:w-12 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-xs sm:text-sm text-slate-700 dark:text-slate-300">No hay productos con alertas de vencimiento</p>
              <p className="text-xs text-slate-500">Prueba cambiando los filtros o el término de búsqueda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {vencimientosPaginados.map((item) => (
                  <Card 
                    key={item.id} 
                    className={`border-l-4 ${
                      item.estado === 'vencido' 
                        ? 'border-l-red-600 bg-red-50/30 dark:bg-red-950/20' 
                        : item.estado === 'vence_pronto' 
                          ? 'border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/20' 
                          : 'border-l-emerald-500'
                    }`}
                  >
                    <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        {item.foto ? (
                          <img 
                            src={item.foto} 
                            alt={item.nombre} 
                            className="h-10 w-10 rounded-lg object-cover border shrink-0 bg-slate-100" 
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border">
                            <Package className="h-5 w-5 text-slate-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100 truncate" title={item.nombre}>{item.nombre}</h4>
                          <p className="text-xs text-slate-500">
                            Sección: {item.seccion || 'General'} | Stock: <span className="font-semibold text-slate-700 dark:text-slate-300">{item.cantidad}</span>
                          </p>
                          <p className="text-xs sm:text-sm font-medium mt-1">
                            Vencimiento: <span className="underline">{item.fecha_vencimiento}</span>
                          </p>
                        </div>
                      </div>
                      <div className="self-start sm:self-auto sm:text-right shrink-0">
                        {item.estado === 'vencido' && (
                          <Badge variant="destructive" className="bg-red-600 text-[10px] sm:text-xs">
                            Venció hace {item.dias_diferencia} día(s)
                          </Badge>
                        )}
                        {item.estado === 'vence_pronto' && (
                          <Badge className="bg-amber-500 text-white text-[10px] sm:text-xs">
                            {item.dias_diferencia === 0 ? 'Vence hoy' : `Faltan ${item.dias_diferencia} día(s)`}
                          </Badge>
                        )}
                        {item.estado === 'vigente' && (
                          <Badge className="bg-emerald-600 text-white text-[10px] sm:text-xs">
                            Vigente ({item.dias_diferencia} días)
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {totalPaginasVencimientos > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between pt-2 px-1 gap-2">
                  <div className="text-xs text-slate-500">
                    Página <span className="font-semibold text-slate-800 dark:text-slate-200">{paginaVencimientos}</span> de <span className="font-semibold text-slate-800 dark:text-slate-200">{totalPaginasVencimientos}</span>
                    <span className="ml-1 text-slate-400">({vencimientosFiltrados.length} productos totales)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={paginaVencimientos <= 1}
                      onClick={() => setPaginaVencimientos(p => Math.max(1, p - 1))}
                      className="h-8 px-2.5 text-xs"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={paginaVencimientos >= totalPaginasVencimientos}
                      onClick={() => setPaginaVencimientos(p => Math.min(totalPaginasVencimientos, p + 1))}
                      className="h-8 px-2.5 text-xs"
                    >
                      Siguiente <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* 2. PESTAÑA ALMACÉN */}
        <TabsContent value="almacen" className="mt-3 sm:mt-4 space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border">
            <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">
              Filtros en Puntos de Venta:
            </span>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
              <Button
                size="sm"
                variant={filtroAlmacen === 'todos' ? 'default' : 'outline'}
                onClick={() => setFiltroAlmacen('todos')}
                className="h-8 text-xs flex-1 sm:flex-none"
              >
                Todos ({alertasAlmacen.length})
              </Button>
              <Button
                size="sm"
                variant={filtroAlmacen === 'agotados' ? 'destructive' : 'outline'}
                onClick={() => setFiltroAlmacen('agotados')}
                className={`h-8 text-xs flex-1 sm:flex-none ${filtroAlmacen === 'agotados' ? 'bg-red-600' : ''}`}
              >
                🔴 Agotados ({alertasAlmacen.filter(a => a.estado === 'agotado').length})
              </Button>
              <Button
                size="sm"
                variant={filtroAlmacen === 'bajo_stock' ? 'default' : 'outline'}
                onClick={() => setFiltroAlmacen('bajo_stock')}
                className={`h-8 text-xs flex-1 sm:flex-none ${filtroAlmacen === 'bajo_stock' ? 'bg-orange-600 text-white' : ''}`}
              >
                🟠 Bajo Stock ({alertasAlmacen.filter(a => a.estado === 'bajo_stock').length})
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12 sm:py-16 border rounded-xl bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 animate-spin text-orange-500 mx-auto" />
              <p className="font-semibold text-xs sm:text-sm text-slate-700 dark:text-slate-300">Cargando alertas de inventario...</p>
            </div>
          ) : almacenFiltrado.length === 0 ? (
            <div className="text-center py-8 sm:py-10 border rounded-xl bg-slate-50 dark:bg-slate-900">
              <CheckCircle2 className="h-10 w-10 sm:h-12 sm:w-12 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-xs sm:text-sm text-slate-700 dark:text-slate-300">Sin alertas de stock en Puntos de Venta</p>
              <p className="text-xs text-slate-500">Todos los puntos de venta cuentan con existencias adecuadas.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {almacenFiltrado.map((item, idx) => (
                <Card key={idx} className="border-l-4 border-l-orange-500">
                  <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <h4 className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100">{item.nombre}</h4>
                      <p className="text-xs text-blue-600 font-semibold">Punto de Venta: {item.usuario_nombre}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Cantidad Actual: <span className="font-bold text-slate-900 dark:text-slate-100">{item.cantidad}</span> | Stock Mínimo: {item.stock_minimo}
                      </p>
                    </div>
                    <div className="self-start sm:self-auto">
                      {item.estado === 'agotado' ? (
                        <Badge variant="destructive" className="bg-red-600 text-[10px] sm:text-xs">🔴 Agotado</Badge>
                      ) : (
                        <Badge className="bg-orange-500 text-white text-[10px] sm:text-xs">🟠 Bajo Stock</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 3. PESTAÑA VENDEDORES */}
        <TabsContent value="vendedores" className="mt-3 sm:mt-4 space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b pb-3 gap-3">
            <div className="grid grid-cols-2 sm:flex gap-1.5 sm:gap-2">
              <Button
                size="sm"
                variant={subTabVendedores === 'cantidades' ? 'default' : 'outline'}
                onClick={() => setSubTabVendedores('cantidades')}
                className="h-8 text-xs justify-center"
              >
                <AlertOctagon className="h-3.5 w-3.5 mr-1 text-red-500 shrink-0" />
                Stock Crítico
              </Button>
              <Button
                size="sm"
                variant={subTabVendedores === 'rendimiento' ? 'default' : 'outline'}
                onClick={() => setSubTabVendedores('rendimiento')}
                className="h-8 text-xs justify-center"
              >
                <TrendingUp className="h-3.5 w-3.5 mr-1 text-emerald-500 shrink-0" />
                Rotación
              </Button>
            </div>

            {subTabVendedores === 'cantidades' && (
              <Select value={vendedorSeleccionado} onValueChange={setVendedorSeleccionado}>
                <SelectTrigger className="w-full sm:w-[220px] h-9 text-xs">
                  <SelectValue placeholder="Filtrar por Vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los Vendedores</SelectItem>
                  {vendedores.map(v => (
                    <SelectItem key={v.id} value={String(v.id)}>{v.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* SUB-TAB A: CANTIDADES / STOCK CRÍTICO */}
          {subTabVendedores === 'cantidades' && (
            <div className="space-y-3 sm:space-y-4">
              {isLoading ? (
                <div className="text-center py-12 sm:py-16 border rounded-xl bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 animate-spin text-blue-500 mx-auto" />
                  <p className="font-semibold text-xs sm:text-sm text-slate-700 dark:text-slate-300">Cargando datos de vendedores...</p>
                </div>
              ) : vendedoresAlertasFiltradas.length === 0 ? (
                <div className="text-center py-8 sm:py-10 border rounded-xl bg-slate-50 dark:bg-slate-900">
                  <CheckCircle2 className="h-10 w-10 sm:h-12 sm:w-12 text-emerald-500 mx-auto mb-2" />
                  <p className="font-semibold text-xs sm:text-sm text-slate-700 dark:text-slate-300">No hay vendedores con productos en nivel crítico</p>
                </div>
              ) : (
                vendedoresAlertasFiltradas.map((vend) => (
                  <Card key={vend.vendedor_id} className="border-l-4 border-l-blue-600 shadow-sm">
                    <CardHeader className="p-3 sm:p-4 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div>
                        <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                          <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 shrink-0" />
                          {vend.vendedor_nombre}
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500 mt-0.5">
                          Agotados: <span className="font-semibold text-red-600">{vend.total_agotados}</span> | Bajo Stock: <span className="font-semibold text-orange-600">{vend.total_bajo_stock}</span>
                        </CardDescription>
                      </div>
                      <Button 
                        size="sm"
                        onClick={() => handleQuickNotify(vend)}
                        className="bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center gap-1.5 shadow h-8 text-xs w-full sm:w-auto"
                        title="Enviar aviso preconfigurado por WhatsApp / Notificación rápida"
                      >
                        <Bell className="h-3.5 w-3.5" />
                        QuickNotify 🔔
                      </Button>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-4 pt-0">
                      <div className="mt-2 space-y-2">
                        {vend.productos_criticos.map((prod) => (
                          <div key={prod.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg text-xs sm:text-sm gap-2">
                            <span className="font-medium text-slate-800 dark:text-slate-200">{prod.nombre}</span>
                            <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                              <span className="text-xs text-slate-500">Stock: <strong className="text-slate-900 dark:text-slate-100">{prod.cantidad}</strong> / Mín: {prod.stock_minimo}</span>
                              {prod.estado === 'agotado' ? (
                                <Badge variant="destructive" className="bg-red-600 text-[10px]">🔴 AGOTADO</Badge>
                              ) : (
                                <Badge className="bg-orange-500 text-white text-[10px]">🟠 BAJO STOCK</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* SUB-TAB B: RENDIMIENTO VENTAS Y ROTACIÓN */}
          {subTabVendedores === 'rendimiento' && (
            <div className="space-y-4 sm:space-y-6">
              {/* ÍNDICE DE ROTACIÓN DE PRODUCTOS */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div>
                    <h4 className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 shrink-0" />
                      Sistema de Valoración por Índice de Rotación
                    </h4>
                    <p className="text-xs text-slate-500">
                      Calificación de productos por vendedor según unidades vendidas ÷ días en existencia (vigencia activa o cerrada al agotarse).
                    </p>
                  </div>
                </div>

                {/* BARRA DE FILTROS Y RESUMEN */}
                <div className="bg-slate-50 dark:bg-slate-900/60 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Filtro Punto de Venta / Vendedor */}
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                        Punto de Venta / Vendedor:
                      </label>
                      <Select value={vendedorRotacionFiltro} onValueChange={setVendedorRotacionFiltro}>
                        <SelectTrigger className="w-full text-xs h-9 bg-white dark:bg-slate-800">
                          <SelectValue placeholder="Todos los vendedores" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos los Puntos de Venta</SelectItem>
                          {vendedoresConRotacion.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Buscador de Producto */}
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                        Buscar producto:
                      </label>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="Nombre o sección..."
                          value={searchRotacion}
                          onChange={(e) => setSearchRotacion(e.target.value)}
                          className="pl-8 text-xs h-9 bg-white dark:bg-slate-800"
                        />
                      </div>
                    </div>

                    {/* Filtro Estado de Vigencia / Stock */}
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                        Estado de Stock / Vigencia:
                      </label>
                      <Select value={filtroEstadoRotacion} onValueChange={(val: any) => setFiltroEstadoRotacion(val)}>
                        <SelectTrigger className="w-full text-xs h-9 bg-white dark:bg-slate-800">
                          <SelectValue placeholder="Estado de stock" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos los estados</SelectItem>
                          <SelectItem value="en_existencia">🟢 En Existencia (Vigencia activa)</SelectItem>
                          <SelectItem value="agotado">🔴 Agotados (Vigencia cerrada)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Resumen rápido de calificaciones */}
                  <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-800 gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {filteredRotacion.length} producto(s) en ranking
                      </span>
                      {vendedorRotacionFiltro !== 'todos' && (
                        <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50/50 text-[11px]">
                          {vendedoresConRotacion.find(v => v.id === vendedorRotacionFiltro)?.nombre || 'Vendedor'}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-[11px]">
                      <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                        🚀 {filteredRotacion.filter(p => p.evaluacion === 'Excelente Rotación').length} Exc.
                      </span>
                      <span className="flex items-center gap-1 text-teal-700 dark:text-teal-400 font-semibold">
                        ⚡ {filteredRotacion.filter(p => p.evaluacion === 'Alta Rotación').length} Altas
                      </span>
                      <span className="flex items-center gap-1 text-blue-700 dark:text-blue-400 font-semibold">
                        🔄 {filteredRotacion.filter(p => p.evaluacion === 'Rotación Media').length} Medias
                      </span>
                      <span className="flex items-center gap-1 text-rose-700 dark:text-rose-400 font-semibold">
                        🐢 {filteredRotacion.filter(p => p.evaluacion === 'Baja Rotación').length} Bajas
                      </span>
                    </div>
                  </div>
                </div>

                {/* TABLA DE VALORACIÓN POR ROTACIÓN */}
                {rotacionProductos.length === 0 ? (
                  <div className="text-center p-8 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed">
                    <Package className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No hay datos de vigencia o rotación</p>
                    <p className="text-xs text-slate-500 mt-1">Los datos se generan conforme los productos se entregan a los vendedores y se registran ventas.</p>
                  </div>
                ) : filteredRotacion.length === 0 ? (
                  <div className="text-center p-8 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed">
                    <Filter className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sin resultados para los filtros seleccionados</p>
                    <p className="text-xs text-slate-500 mt-1">Prueba seleccionando otro vendedor o borrando el texto de búsqueda.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                      <Table>
                        <TableHeader className="bg-slate-50 dark:bg-slate-800/60">
                          <TableRow>
                            <TableHead className="w-16 text-center text-xs font-bold text-slate-700 dark:text-slate-200"># Rank</TableHead>
                            <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-200">Producto</TableHead>
                            <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-200">Punto de Venta</TableHead>
                            <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-200">Días Vigencia</TableHead>
                            <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-200">Ventas / Stock</TableHead>
                            <TableHead className="text-right text-xs font-bold text-slate-700 dark:text-slate-200">Índice Rotación</TableHead>
                            <TableHead className="text-center text-xs font-bold text-slate-700 dark:text-slate-200">Calificación</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rotacionPaginada.map((item, idx) => {
                            const rankGlobal = (paginaRotacion - 1) * itemsPorPagina + idx + 1;
                            return (
                              <TableRow key={`${item.vendedor_id}-${item.producto_id}-${idx}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                                {/* Rank */}
                                <TableCell className="text-center">
                                  {rankGlobal === 1 ? (
                                    <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-amber-100 text-amber-800 font-extrabold text-xs shadow-sm border border-amber-300">🥇</span>
                                  ) : rankGlobal === 2 ? (
                                    <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-slate-200 text-slate-800 font-extrabold text-xs shadow-sm border border-slate-300">🥈</span>
                                  ) : rankGlobal === 3 ? (
                                    <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-orange-100 text-orange-800 font-extrabold text-xs shadow-sm border border-orange-300">🥉</span>
                                  ) : (
                                    <span className="text-xs font-bold text-slate-500">#{rankGlobal}</span>
                                  )}
                                </TableCell>

                                {/* Producto */}
                                <TableCell>
                                  <div className="flex items-center gap-2.5 min-w-[160px]">
                                    {item.producto_foto ? (
                                      <img
                                        src={item.producto_foto}
                                        alt={item.producto_nombre}
                                        className="h-8 w-8 rounded-lg object-cover border shrink-0 bg-slate-100"
                                      />
                                    ) : (
                                      <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border">
                                        <Package className="h-4 w-4 text-slate-400" />
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <div className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate" title={item.producto_nombre}>
                                        {item.producto_nombre}
                                      </div>
                                      {item.producto_seccion && (
                                        <div className="text-[10px] text-slate-400 truncate">
                                          {item.producto_seccion}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>

                                {/* Punto de Venta */}
                                <TableCell>
                                  <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs truncate max-w-[140px]">
                                    👤 {item.vendedor_nombre}
                                  </Badge>
                                </TableCell>

                                {/* Días Vigencia */}
                                <TableCell>
                                  <div className="space-y-0.5">
                                    <div className="font-bold text-xs text-slate-800 dark:text-slate-200">
                                      {item.dias_vigencia} {item.dias_vigencia === 1 ? 'día' : 'días'}
                                    </div>
                                    {item.estado_stock === 'en_existencia' ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                        En existencia
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 dark:text-slate-500">
                                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                                        Agotado (cerrada)
                                      </span>
                                    )}
                                  </div>
                                </TableCell>

                                {/* Ventas / Stock */}
                                <TableCell>
                                  <div className="text-xs space-y-0.5">
                                    <div className="font-bold text-slate-800 dark:text-slate-200">
                                      {item.unidades_vendidas} vendidas
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      Stock: <span className="font-semibold text-slate-700 dark:text-slate-300">{item.stock_actual}</span> (de {item.unidades_entregadas} ent.)
                                    </div>
                                  </div>
                                </TableCell>

                                {/* Índice de Rotación */}
                                <TableCell className="text-right">
                                  <div className="inline-flex items-baseline gap-1">
                                    <span className={`text-sm font-extrabold ${
                                      item.evaluacion === 'Excelente Rotación' 
                                        ? 'text-emerald-600 dark:text-emerald-400' 
                                        : item.evaluacion === 'Alta Rotación'
                                          ? 'text-teal-600 dark:text-teal-400'
                                          : item.evaluacion === 'Rotación Media'
                                            ? 'text-blue-600 dark:text-blue-400'
                                            : 'text-rose-600 dark:text-rose-400'
                                    }`}>
                                      {item.indice_rotacion_diaria}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-normal">u/día</span>
                                  </div>
                                </TableCell>

                                {/* Calificación */}
                                <TableCell className="text-center">
                                  {item.evaluacion === 'Excelente Rotación' ? (
                                    <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] font-bold shadow-sm whitespace-nowrap">
                                      🚀 Excelente
                                    </Badge>
                                  ) : item.evaluacion === 'Alta Rotación' ? (
                                    <Badge className="bg-teal-600 hover:bg-teal-600 text-white text-[10px] font-semibold shadow-sm whitespace-nowrap">
                                      ⚡ Alta
                                    </Badge>
                                  ) : item.evaluacion === 'Rotación Media' ? (
                                    <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-[10px] font-medium shadow-sm whitespace-nowrap">
                                      🔄 Media
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 text-[10px] font-medium whitespace-nowrap">
                                      🐢 Baja
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Controles de paginación */}
                    {totalPaginasRotacion > 1 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between pt-2 px-1 gap-2">
                        <div className="text-xs text-slate-500">
                          Página <span className="font-semibold text-slate-800 dark:text-slate-200">{paginaRotacion}</span> de <span className="font-semibold text-slate-800 dark:text-slate-200">{totalPaginasRotacion}</span>
                          <span className="ml-1 text-slate-400">({filteredRotacion.length} productos totales)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={paginaRotacion <= 1}
                            onClick={() => setPaginaRotacion(p => Math.max(1, p - 1))}
                            className="h-8 px-2.5 text-xs"
                          >
                            <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={paginaRotacion >= totalPaginasRotacion}
                            onClick={() => setPaginaRotacion(p => Math.min(totalPaginasRotacion, p + 1))}
                            className="h-8 px-2.5 text-xs"
                          >
                            Siguiente <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* MEJORES VENDEDORES */}
              <div>
                <h4 className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 shrink-0" />
                  Ranking de Vendedores por Volumen y Ventas
                </h4>
                <div className="space-y-2">
                  {rankingVendedores.map((v) => (
                    <div key={v.vendedor_id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border gap-2">
                      <div className="flex items-center gap-2.5">
                        <Badge className="bg-blue-600 text-white font-bold text-xs">Rank #{v.rank}</Badge>
                        <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100">{v.vendedor_nombre}</span>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-4 text-xs sm:text-sm">
                        <span className="font-semibold text-slate-600 dark:text-slate-400">Unidades: {v.unidades_vendidas}</span>
                        <span className="font-bold text-emerald-600">${Number(v.monto_total).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );

  if (isFullPage) {
    return (
      <Card className="border-orange-200 shadow-md p-3 sm:p-6 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
        {mainContent}
      </Card>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose && onClose()}>
      <DialogContent className="w-[95vw] sm:w-full max-w-4xl max-h-[92vh] sm:max-h-[85vh] overflow-y-auto p-3 sm:p-6 rounded-2xl">
        {mainContent}
      </DialogContent>
    </Dialog>
  );
};

export default NotificacionesSystem;
