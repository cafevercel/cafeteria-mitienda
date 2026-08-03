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
  Search
} from 'lucide-react';
import { Producto, Vendedor, AlertaVendedorStock } from '@/types';

interface NotificacionesSystemProps {
  isOpen: boolean;
  onClose: () => void;
  vendedores?: Vendedor[];
}

export const NotificacionesSystem: React.FC<NotificacionesSystemProps> = ({
  isOpen,
  onClose,
  vendedores = []
}) => {
  const [activeTab, setActiveTab] = useState<'vencimientos' | 'almacen' | 'vendedores'>('vencimientos');
  const [subTabVendedores, setSubTabVendedores] = useState<'cantidades' | 'rendimiento'>('cantidades');
  
  // Data states
  const [vencimientos, setVencimientos] = useState<any[]>([]);
  const [alertasAlmacen, setAlertasAlmacen] = useState<any[]>([]);
  const [filtroAlmacen, setFiltroAlmacen] = useState<'todos' | 'agotados' | 'bajo_stock'>('todos');
  
  const [vendedoresAlertas, setVendedoresAlertas] = useState<AlertaVendedorStock[]>([]);
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState<string>('todos');
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

  useEffect(() => {
    if (isOpen) {
      fetchNotificaciones();
    }
  }, [isOpen, fetchNotificaciones]);

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b">
          <div>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <Bell className="h-6 w-6 text-amber-500" />
              Panel de Notificaciones y Alertas del Sistema
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Monitoreo en tiempo real de caducidades, existencias críticas en puntos de venta e inteligencia de rotación.
            </DialogDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchNotificaciones} 
            disabled={isLoading}
            className="flex items-center gap-1 text-slate-600"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </DialogHeader>

        {/* BUSCADOR RÁPIDO */}
        <div className="relative my-3">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por producto o vendedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200"
          />
        </div>

        {/* PESTAÑAS PRINCIPALES */}
        <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="w-full">
          <TabsList className="grid grid-cols-3 w-full bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <TabsTrigger value="vencimientos" className="flex items-center gap-2 py-2">
              <Calendar className="h-4 w-4 text-red-500" />
              Vencimientos ({vencimientos.filter(v => v.estado !== 'vigente').length})
            </TabsTrigger>
            <TabsTrigger value="almacen" className="flex items-center gap-2 py-2">
              <Package className="h-4 w-4 text-orange-500" />
              Almacén ({alertasAlmacen.length})
            </TabsTrigger>
            <TabsTrigger value="vendedores" className="flex items-center gap-2 py-2">
              <Users className="h-4 w-4 text-blue-500" />
              Vendedores
            </TabsTrigger>
          </TabsList>

          {/* ============================================================== */}
          {/* 1. PESTAÑA VENCIMIENTOS */}
          {/* ============================================================== */}
          <TabsContent value="vencimientos" className="mt-4 space-y-4">
            <div className="flex items-center justify-between bg-orange-50 dark:bg-orange-950/40 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
              <span className="text-sm font-medium text-orange-800 dark:text-orange-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Seguimiento global de fechas de expiración en inventario.
              </span>
              <div className="flex gap-2">
                <Badge variant="destructive" className="bg-red-600">🔴 Vencido</Badge>
                <Badge className="bg-amber-500 text-white">🟡 Vence pronto (≤ 7 días)</Badge>
                <Badge className="bg-emerald-600 text-white">🟢 Vigente</Badge>
              </div>
            </div>

            {vencimientosFiltrados.length === 0 ? (
              <div className="text-center py-10 border rounded-lg bg-slate-50 dark:bg-slate-900">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-2" />
                <p className="font-semibold text-slate-700 dark:text-slate-300">No hay productos con alertas de vencimiento</p>
                <p className="text-sm text-slate-500">Todos los artículos marcados están al día.</p>
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
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-100">{item.nombre}</h4>
                        <p className="text-xs text-slate-500">Sección: {item.seccion || 'General'} | Stock Global: {item.cantidad}</p>
                        <p className="text-sm font-medium mt-1">
                          Vencimiento: <span className="underline">{item.fecha_vencimiento}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        {item.estado === 'vencido' && (
                          <Badge variant="destructive" className="bg-red-600">
                            Hace {item.dias_diferencia} día(s)
                          </Badge>
                        )}
                        {item.estado === 'vence_pronto' && (
                          <Badge className="bg-amber-500 text-white">
                            Faltan {item.dias_diferencia} día(s)
                          </Badge>
                        )}
                        {item.estado === 'vigente' && (
                          <Badge className="bg-emerald-600 text-white">
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

          {/* ============================================================== */}
          {/* 2. PESTAÑA ALMACÉN */}
          {/* ============================================================== */}
          <TabsContent value="almacen" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Filtros de estado en Puntos de Venta:
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={filtroAlmacen === 'todos' ? 'default' : 'outline'}
                  onClick={() => setFiltroAlmacen('todos')}
                >
                  Todos ({alertasAlmacen.length})
                </Button>
                <Button
                  size="sm"
                  variant={filtroAlmacen === 'agotados' ? 'destructive' : 'outline'}
                  onClick={() => setFiltroAlmacen('agotados')}
                  className={filtroAlmacen === 'agotados' ? 'bg-red-600' : ''}
                >
                  🔴 Agotados ({alertasAlmacen.filter(a => a.estado === 'agotado').length})
                </Button>
                <Button
                  size="sm"
                  variant={filtroAlmacen === 'bajo_stock' ? 'default' : 'outline'}
                  onClick={() => setFiltroAlmacen('bajo_stock')}
                  className={filtroAlmacen === 'bajo_stock' ? 'bg-orange-600 text-white' : ''}
                >
                  🟠 Bajo Stock ({alertasAlmacen.filter(a => a.estado === 'bajo_stock').length})
                </Button>
              </div>
            </div>

            {almacenFiltrado.length === 0 ? (
              <div className="text-center py-10 border rounded-lg bg-slate-50 dark:bg-slate-900">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-2" />
                <p className="font-semibold text-slate-700 dark:text-slate-300">Sin alertas de stock en Puntos de Venta</p>
                <p className="text-sm text-slate-500">Todos los puntos de venta cuentan con existencias adecuadas.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {almacenFiltrado.map((item, idx) => (
                  <Card key={idx} className="border-l-4 border-l-orange-500">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-100">{item.nombre}</h4>
                        <p className="text-xs text-blue-600 font-semibold">Punto de Venta: {item.usuario_nombre}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Cantidad Actual: <span className="font-bold text-slate-900 dark:text-slate-100">{item.cantidad}</span> | Stock Mínimo: {item.stock_minimo}
                        </p>
                      </div>
                      <div>
                        {item.estado === 'agotado' ? (
                          <Badge variant="destructive" className="bg-red-600">🔴 Agotado</Badge>
                        ) : (
                          <Badge className="bg-orange-500 text-white">🟠 Bajo Stock</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ============================================================== */}
          {/* 3. PESTAÑA VENDEDORES */}
          {/* ============================================================== */}
          <TabsContent value="vendedores" className="mt-4 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={subTabVendedores === 'cantidades' ? 'default' : 'ghost'}
                  onClick={() => setSubTabVendedores('cantidades')}
                >
                  <AlertOctagon className="h-4 w-4 mr-1 text-red-500" />
                  A) Stock Crítico Vendedores
                </Button>
                <Button
                  size="sm"
                  variant={subTabVendedores === 'rendimiento' ? 'default' : 'ghost'}
                  onClick={() => setSubTabVendedores('rendimiento')}
                >
                  <TrendingUp className="h-4 w-4 mr-1 text-emerald-500" />
                  B) Rendimiento y Rotación
                </Button>
              </div>

              {subTabVendedores === 'cantidades' && (
                <Select value={vendedorSeleccionado} onValueChange={setVendedorSeleccionado}>
                  <SelectTrigger className="w-[200px]">
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
              <div className="space-y-4">
                {vendedoresAlertasFiltradas.length === 0 ? (
                  <div className="text-center py-10 border rounded-lg bg-slate-50 dark:bg-slate-900">
                    <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">No hay vendedores con productos en nivel crítico</p>
                  </div>
                ) : (
                  vendedoresAlertasFiltradas.map((vend) => (
                    <Card key={vend.vendedor_id} className="border-l-4 border-l-blue-600 shadow-sm">
                      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                        <div>
                          <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <Users className="h-5 w-5 text-blue-600" />
                            {vend.vendedor_nombre}
                          </CardTitle>
                          <CardDescription className="text-xs text-slate-500">
                            Agotados: <span className="font-semibold text-red-600">{vend.total_agotados}</span> | Bajo Stock: <span className="font-semibold text-orange-600">{vend.total_bajo_stock}</span>
                          </CardDescription>
                        </div>
                        <Button 
                          size="sm"
                          onClick={() => handleQuickNotify(vend)}
                          className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1 shadow"
                          title="Enviar aviso preconfigurado por WhatsApp / Notificación rápida"
                        >
                          <Bell className="h-4 w-4" />
                          QuickNotify 🔔
                        </Button>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="mt-2 space-y-2">
                          {vend.productos_criticos.map((prod) => (
                            <div key={prod.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900 rounded text-sm">
                              <span className="font-medium text-slate-800 dark:text-slate-200">{prod.nombre}</span>
                              <div className="flex items-center gap-3">
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
              <div className="space-y-6">
                {/* PRODUCTOS ESTRELLA (TOP #1) */}
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-3">
                    <Sparkles className="h-5 w-5 text-amber-500" />
                    Productos Estrella (Top Ventas)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {productosEstrella.map((prod) => (
                      <Card key={prod.id} className={`p-3 flex items-center justify-between ${prod.top_rank === 1 ? 'bg-amber-50 border-amber-300 dark:bg-amber-950/30' : ''}`}>
                        <div className="flex items-center gap-3">
                          {prod.top_rank === 1 ? (
                            <Badge className="bg-amber-500 text-white font-extrabold text-xs px-2 py-1 flex items-center gap-1">
                              <Flame className="h-3 w-3" /> TOP #1
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-600">#{prod.top_rank}</Badge>
                          )}
                          <div>
                            <h5 className="font-bold text-sm text-slate-800 dark:text-slate-100">{prod.nombre}</h5>
                            <p className="text-xs text-slate-500">Unidades vendidas: <strong className="text-slate-900 dark:text-slate-100">{prod.total_vendido}</strong></p>
                          </div>
                        </div>
                        <span className="font-bold text-sm text-emerald-600">${Number(prod.monto_total).toFixed(2)}</span>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* POCA ROTACIÓN / ESTANCADOS */}
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-3">
                    <Clock className="h-5 w-5 text-red-500" />
                    Poca Rotación / Productos Estancados (&lt; 5 Ventas)
                  </h4>
                  {productosEstancados.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">No hay productos marcados de poca rotación.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {productosEstancados.map((prod) => (
                        <Card key={prod.id} className="p-3 border-l-4 border-l-red-500 bg-red-50/20 dark:bg-red-950/20">
                          <div className="flex items-center justify-between">
                            <h5 className="font-semibold text-sm">{prod.nombre}</h5>
                            <Badge variant="destructive" className="bg-red-600 text-[10px]">
                              🔴 Poca Rotación
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-2">Ventas último mes: <strong>{prod.total_vendido}</strong></p>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                {/* MEJORES VENDEDORES */}
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-3">
                    <Users className="h-5 w-5 text-blue-600" />
                    Ranking de Vendedores por Volumen y Ventas
                  </h4>
                  <div className="space-y-2">
                    {rankingVendedores.map((v) => (
                      <div key={v.vendedor_id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <Badge className="bg-blue-600 text-white font-bold">Rank #{v.rank}</Badge>
                          <span className="font-bold text-slate-800 dark:text-slate-100">{v.vendedor_nombre}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 mr-4">Unidades: {v.unidades_vendidas}</span>
                          <span className="text-sm font-bold text-emerald-600">${Number(v.monto_total).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default NotificacionesSystem;
