import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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
  Loader2
} from 'lucide-react';
import { Producto, Vendedor, AlertaVendedorStock } from '@/types';
import { getNotificationKey } from './VencimientoBell';

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
  const [alertasAlmacen, setAlertasAlmacen] = useState<any[]>([]);
  const [filtroAlmacen, setFiltroAlmacen] = useState<'todos' | 'agotados' | 'bajo_stock'>('todos');
  
  const [vendedoresAlertas, setVendedoresAlertas] = useState<AlertaVendedorStock[]>([]);
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState<string>('todos');
  const [rotacionProductos, setRotacionProductos] = useState<any[]>([]);
  const [productosEstrella, setProductosEstrella] = useState<any[]>([]);
  const [productosEstancados, setProductosEstancados] = useState<any[]>([]);
  const [rankingVendedores, setRankingVendedores] = useState<any[]>([]);
  
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

  // Filtered Vencimientos
  const vencimientosFiltrados = vencimientos.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <span className="truncate">Vencidos</span>
            <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">
              {vencimientos.filter(v => v.estado !== 'vigente').length}
            </span>
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

          {isLoading ? (
            <div className="text-center py-12 sm:py-16 border rounded-xl bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 animate-spin text-orange-500 mx-auto" />
              <p className="font-semibold text-xs sm:text-sm text-slate-700 dark:text-slate-300">Cargando notificaciones y vencimientos...</p>
            </div>
          ) : vencimientosFiltrados.length === 0 ? (
            <div className="text-center py-8 sm:py-10 border rounded-xl bg-slate-50 dark:bg-slate-900">
              <CheckCircle2 className="h-10 w-10 sm:h-12 sm:w-12 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-xs sm:text-sm text-slate-700 dark:text-slate-300">No hay productos con alertas de vencimiento</p>
              <p className="text-xs text-slate-500">Todos los artículos marcados están al día.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {vencimientosFiltrados.map((item) => (
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
                    <div>
                      <h4 className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100">{item.nombre}</h4>
                      <p className="text-xs text-slate-500">Sección: {item.seccion || 'General'} | Stock: {item.cantidad}</p>
                      <p className="text-xs sm:text-sm font-medium mt-1">
                        Vencimiento: <span className="underline">{item.fecha_vencimiento}</span>
                      </p>
                    </div>
                    <div className="self-start sm:self-auto sm:text-right">
                      {item.estado === 'vencido' && (
                        <Badge variant="destructive" className="bg-red-600 text-[10px] sm:text-xs">
                          Hace {item.dias_diferencia} día(s)
                        </Badge>
                      )}
                      {item.estado === 'vence_pronto' && (
                        <Badge className="bg-amber-500 text-white text-[10px] sm:text-xs">
                          Faltan {item.dias_diferencia} día(s)
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
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
                  <div>
                    <h4 className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 shrink-0" />
                      Sistema de Valoración por Índice de Rotación
                    </h4>
                    <p className="text-xs text-slate-500">
                      Promedio de ventas ÷ Días de vigencia (cerrada al agotar o activa en curso). Exclusivo Puntos de Venta.
                    </p>
                  </div>
                </div>

                {rotacionProductos.length === 0 ? (
                  <p className="text-xs sm:text-sm text-slate-500 italic p-4 bg-slate-50 rounded-xl text-center">
                    No hay suficientes datos de rotación o entregas registradas aún.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {rotacionProductos.map((item, idx) => (
                      <Card 
                        key={idx} 
                        className={`p-3 border-l-4 ${
                          item.evaluacion === 'Alta Rotación' 
                            ? 'border-l-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20' 
                            : item.evaluacion === 'Rotación Media' 
                              ? 'border-l-blue-500 bg-blue-50/20 dark:bg-blue-950/20' 
                              : 'border-l-red-500 bg-red-50/20 dark:bg-red-950/20'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h5 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate">{item.producto_nombre}</h5>
                            <p className="text-[11px] font-semibold text-blue-600 truncate">Punto de Venta: {item.vendedor_nombre}</p>
                          </div>
                          {item.evaluacion === 'Alta Rotación' ? (
                            <Badge className="bg-emerald-600 text-white text-[9px] sm:text-[10px] shrink-0">🚀 Alta Rotación</Badge>
                          ) : item.evaluacion === 'Rotación Media' ? (
                            <Badge className="bg-blue-600 text-white text-[9px] sm:text-[10px] shrink-0">⚡ Rotación Media</Badge>
                          ) : (
                            <Badge variant="destructive" className="bg-red-600 text-[9px] sm:text-[10px] shrink-0">🐢 Mala Rotación</Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 mt-3 pt-2 border-t text-center">
                          <div>
                            <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-semibold">Vendido/Entregado</p>
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                              {item.unidades_vendidas}/{item.unidades_entregadas}u
                            </p>
                          </div>
                          <div>
                            <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-semibold">Vigencia</p>
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-0.5">
                              {item.dias_vigencia}d
                              {item.estado_vigencia === 'activa' ? (
                                <span title="Vigencia activa (en curso)">&nbsp;🟢</span>
                              ) : (
                                <span title="Vigencia cerrada (agotado)">&nbsp;🔴</span>
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-semibold">Rotación/día</p>
                            <p className={`text-xs font-extrabold ${
                              item.evaluacion === 'Alta Rotación' ? 'text-emerald-600' : item.evaluacion === 'Rotación Media' ? 'text-blue-600' : 'text-red-600'
                            }`}>
                              {item.indice_rotacion_diaria} u/d
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))}
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
