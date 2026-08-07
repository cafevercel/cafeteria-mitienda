import React, { useState, useEffect, useCallback } from 'react';
import { Bell, AlertTriangle, AlertCircle, ArrowRight, ExternalLink, CheckCheck, Loader2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

interface VencimientoBellProps {
  vencidosCount?: number;
  venceProntoCount?: number;
  unreadCountOverride?: number;
  onNavigateToNotificaciones?: (tab?: 'vencimientos' | 'almacen' | 'vendedores' | 'recordatorios') => void;
}

export const getNotificationKey = (type: 'vencimiento' | 'almacen' | 'recordatorio', item: any): string => {
  if (type === 'vencimiento') {
    return `v_${item.id}_${item.estado}_${item.fecha_vencimiento || ''}`;
  }
  if (type === 'recordatorio') {
    return `rec_${item.id}_${item.fecha}`;
  }
  return `s_${item.usuario_id}_${item.producto_id}_${item.estado}_${item.cantidad}`;
};

export interface NotificationItemText {
  id: string;
  type: 'vencimiento' | 'almacen' | 'recordatorio';
  text: string;
  subtext?: string;
  estado: string;
  read: boolean;
  dateStr?: string;
  tabTarget: 'vencimientos' | 'almacen' | 'vendedores' | 'recordatorios';
}

export const VencimientoBell: React.FC<VencimientoBellProps> = ({
  vencidosCount,
  venceProntoCount,
  unreadCountOverride,
  onNavigateToNotificaciones
}) => {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [hasUrgent, setHasUrgent] = useState<boolean>(false);
  const [notificationsList, setNotificationsList] = useState<NotificationItemText[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchAndCalculate = useCallback(async () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    setIsLoading(true);

    try {
      const res = await fetch('/api/notificaciones');
      if (!res.ok) return;
      const data = await res.json();

      const vencimientos = data.vencimientos || [];
      const almacen = data.almacen || [];
      const recordatorios = data.recordatorios || [];

      let readKeysSet = new Set<string>();
      try {
        const stored = localStorage.getItem('read_notif_keys');
        if (stored) {
          readKeysSet = new Set(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Error reading read_notif_keys from localStorage:', e);
      }

      const list: NotificationItemText[] = [];
      let count = 0;
      let urgent = false;

      // 1. Notificaciones de Vencimientos
      vencimientos.forEach((v: any) => {
        if (v.estado === 'vigente') return;
        const key = getNotificationKey('vencimiento', v);
        const isRead = readKeysSet.has(key);
        if (!isRead) {
          count++;
          if (v.estado === 'vencido') urgent = true;
        }

        let text = '';
        if (v.estado === 'vencido') {
          text = `"${v.nombre}" se venció en Almacén (${v.fecha_vencimiento})`;
        } else if (v.estado === 'vence_pronto') {
          text = `"${v.nombre}" vence pronto en Almacén (${v.fecha_vencimiento})`;
        }

        list.push({
          id: key,
          type: 'vencimiento',
          text,
          subtext: `Stock global: ${v.cantidad} | Días: ${v.dias_diferencia}`,
          estado: v.estado,
          read: isRead,
          dateStr: v.fecha_vencimiento,
          tabTarget: 'vencimientos'
        });
      });

      // 2. Notificaciones de Almacén / Puntos de venta
      almacen.forEach((a: any) => {
        if (a.estado === 'normal') return;
        const key = getNotificationKey('almacen', a);
        const isRead = readKeysSet.has(key);
        if (!isRead) {
          count++;
          if (a.estado === 'agotado') urgent = true;
        }

        let text = '';
        if (a.estado === 'agotado') {
          text = `"${a.nombre}" se agotó en ${a.usuario_nombre}`;
        } else if (a.estado === 'bajo_stock') {
          text = `"${a.nombre}" bajó del stock límite en ${a.usuario_nombre}`;
        }

        list.push({
          id: key,
          type: 'almacen',
          text,
          subtext: `Cantidad actual: ${a.cantidad} | Mín: ${a.stock_minimo}`,
          estado: a.estado,
          read: isRead,
          tabTarget: 'almacen'
        });
      });

      // 3. Recordatorios
      recordatorios.forEach((r: any) => {
        const key = getNotificationKey('recordatorio', r);
        const isRead = readKeysSet.has(key);
        if (!isRead) {
          count++;
        }

        list.push({
          id: key,
          type: 'recordatorio',
          text: `Recordatorio: ${r.texto}`,
          subtext: `Fecha programada: ${r.fecha}`,
          estado: 'recordatorio',
          read: isRead,
          dateStr: r.fecha,
          tabTarget: 'recordatorios'
        });
      });

      setUnreadCount(count);
      setHasUrgent(urgent);
      setNotificationsList(list);
    } catch (err) {
      console.error('Error fetching notifications for bell:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAndCalculate();

    const handleUpdate = () => fetchAndCalculate();
    window.addEventListener('notificaciones_updated', handleUpdate);
    window.addEventListener('focus', handleUpdate);

    const interval = setInterval(fetchAndCalculate, 300000);

    return () => {
      window.removeEventListener('notificaciones_updated', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
      clearInterval(interval);
    };
  }, [fetchAndCalculate]);

  const markAllAsRead = () => {
    try {
      let readKeysSet = new Set<string>();
      notificationsList.forEach((n) => readKeysSet.add(n.id));
      localStorage.setItem('read_notif_keys', JSON.stringify(Array.from(readKeysSet)));
      window.dispatchEvent(new Event('notificaciones_updated'));
      setUnreadCount(0);
      setNotificationsList(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e) {
      console.error('Error marking all as read:', e);
    }
  };

  const handleNotificationClick = (item: NotificationItemText) => {
    try {
      const stored = localStorage.getItem('read_notif_keys');
      let readKeysSet = new Set<string>(stored ? JSON.parse(stored) : []);
      readKeysSet.add(item.id);
      localStorage.setItem('read_notif_keys', JSON.stringify(Array.from(readKeysSet)));
      window.dispatchEvent(new Event('notificaciones_updated'));
    } catch (e) {
      console.error('Error marking notification as read:', e);
    }

    setIsOpen(false);
    if (onNavigateToNotificaciones) {
      onNavigateToNotificaciones(item.tabTarget);
    }
  };

  const displayCount = unreadCountOverride !== undefined ? unreadCountOverride : unreadCount;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="relative inline-block">
          <Button
            variant="outline"
            size="icon"
            className="relative border-orange-200 hover:bg-orange-50 text-orange-700 dark:border-orange-800 dark:hover:bg-orange-950"
            title={displayCount > 0 ? `${displayCount} notificaciones sin leer` : 'Notificaciones y Alertas'}
          >
            <Bell className="h-5 w-5" />
            {displayCount > 0 && (
              <span className={`absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm ${
                hasUrgent ? 'bg-red-600 animate-pulse' : 'bg-amber-500'
              }`}>
                {displayCount > 99 ? '99+' : displayCount}
              </span>
            )}
          </Button>
        </div>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[calc(100vw-1.5rem)] max-w-sm sm:w-96 p-0 shadow-xl border-orange-200 bg-white dark:bg-slate-900 rounded-xl">
        <div className="p-3 border-b flex items-center justify-between bg-orange-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-orange-600" />
            <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100">Notificaciones Recientes</h4>
            {displayCount > 0 && (
              <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-[10px]">
                {displayCount} nuevas
              </Badge>
            )}
          </div>
          {notificationsList.some(n => !n.read) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-[11px] h-7 px-2 text-slate-500 hover:text-slate-800 flex items-center gap-1"
            >
              <CheckCheck className="h-3 w-3" />
              Marcar leídas
            </Button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
              <span>Cargando notificaciones...</span>
            </div>
          ) : notificationsList.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-xs">
              No hay notificaciones registradas.
            </div>
          ) : (
            notificationsList.map((item) => (
              <div
                key={item.id}
                onClick={() => handleNotificationClick(item)}
                className={`p-3 cursor-pointer transition-colors hover:bg-orange-50/60 dark:hover:bg-slate-800/80 flex items-start gap-2.5 ${
                  !item.read ? 'bg-amber-50/30 dark:bg-amber-950/20 font-medium' : 'opacity-80'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {item.type === 'recordatorio' ? (
                    <Clock className="h-4 w-4 text-blue-500" />
                  ) : item.estado === 'agotado' || item.estado === 'vencido' ? (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-800 dark:text-slate-200 leading-snug break-words">
                    {item.text}
                  </p>
                  {item.subtext && (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {item.subtext}
                    </p>
                  )}
                </div>
                {!item.read && (
                  <span className="h-2 w-2 rounded-full bg-orange-500 shrink-0 mt-1" />
                )}
              </div>
            ))
          )}
        </div>

        <div className="p-2 border-t bg-slate-50 dark:bg-slate-900 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsOpen(false);
              if (onNavigateToNotificaciones) {
                onNavigateToNotificaciones();
              }
            }}
            className="w-full text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-100/50 flex items-center justify-center gap-1 font-semibold"
          >
            Ver todas las notificaciones en página completa
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default VencimientoBell;

