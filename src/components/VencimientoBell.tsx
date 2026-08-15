'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Bell, AlertTriangle, AlertCircle, ExternalLink, CheckCheck, Check, Loader2, Clock, Calendar } from 'lucide-react';
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
  dateLabel?: string;
  tabTarget: 'vencimientos' | 'almacen' | 'vendedores' | 'recordatorios';
}

const formatFecha = (dateStr?: string): string => {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('es-ES');
    }
    return dateStr;
  } catch {
    return dateStr;
  }
};

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

      const hoyStr = new Date().toISOString().split('T')[0];

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
          text = `"${v.nombre}" se venció en Almacén`;
        } else if (v.estado === 'vence_pronto') {
          text = `"${v.nombre}" vence pronto en Almacén`;
        }

        list.push({
          id: key,
          type: 'vencimiento',
          text,
          subtext: `Stock: ${v.cantidad} | ${v.dias_diferencia === 0 ? 'Vence hoy' : `${v.dias_diferencia} días de diferencia`}`,
          estado: v.estado,
          read: isRead,
          dateStr: v.fecha_vencimiento,
          dateLabel: `Vence: ${formatFecha(v.fecha_vencimiento)}`,
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
          subtext: `Stock actual: ${a.cantidad} | Mín: ${a.stock_minimo}`,
          estado: a.estado,
          read: isRead,
          dateStr: hoyStr,
          dateLabel: `Fecha: ${formatFecha(hoyStr)}`,
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
          subtext: `Programado para hoy`,
          estado: 'recordatorio',
          read: isRead,
          dateStr: r.fecha,
          dateLabel: `Fecha: ${formatFecha(r.fecha)}`,
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
      try {
        const stored = localStorage.getItem('read_notif_keys');
        if (stored) {
          readKeysSet = new Set(JSON.parse(stored));
        }
      } catch {}

      notificationsList.forEach((n) => readKeysSet.add(n.id));
      localStorage.setItem('read_notif_keys', JSON.stringify(Array.from(readKeysSet)));
      window.dispatchEvent(new Event('notificaciones_updated'));
      setUnreadCount(0);
      setNotificationsList([]);
    } catch (e) {
      console.error('Error marking all as read:', e);
    }
  };

  const markSingleAsRead = (e: React.MouseEvent, item: NotificationItemText) => {
    e.stopPropagation();
    try {
      const stored = localStorage.getItem('read_notif_keys');
      let readKeysSet = new Set<string>(stored ? JSON.parse(stored) : []);
      readKeysSet.add(item.id);
      localStorage.setItem('read_notif_keys', JSON.stringify(Array.from(readKeysSet)));
      window.dispatchEvent(new Event('notificaciones_updated'));
      setNotificationsList(prev => prev.filter(n => n.id !== item.id));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking single notification as read:', err);
    }
  };

  const handleNotificationClick = (item: NotificationItemText) => {
    try {
      const stored = localStorage.getItem('read_notif_keys');
      let readKeysSet = new Set<string>(stored ? JSON.parse(stored) : []);
      readKeysSet.add(item.id);
      localStorage.setItem('read_notif_keys', JSON.stringify(Array.from(readKeysSet)));
      window.dispatchEvent(new Event('notificaciones_updated'));
      setNotificationsList(prev => prev.filter(n => n.id !== item.id));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {
      console.error('Error marking notification as read:', e);
    }

    setIsOpen(false);
    if (onNavigateToNotificaciones) {
      onNavigateToNotificaciones(item.tabTarget);
    }
  };

  // Solo mostramos las notificaciones no leídas en la lista de la campanita
  const visibleNotifications = notificationsList.filter(n => !n.read);
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
            <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100">Notificaciones</h4>
            {visibleNotifications.length > 0 && (
              <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-[10px]">
                {visibleNotifications.length} nuevas
              </Badge>
            )}
          </div>
          {visibleNotifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-[11px] h-7 px-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 hover:bg-orange-100/50"
              title="Marcar todas como leídas y quitarlas de la lista"
            >
              <CheckCheck className="h-3.5 w-3.5 text-orange-600" />
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
          ) : visibleNotifications.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-1.5">
              <span className="text-xl">✨</span>
              <p className="font-medium text-slate-700 dark:text-slate-300">No tienes notificaciones pendientes</p>
              <p className="text-[11px] text-slate-400">Todo tu inventario y alertas están al día</p>
            </div>
          ) : (
            visibleNotifications.map((item) => (
              <div
                key={item.id}
                onClick={() => handleNotificationClick(item)}
                className="group relative p-3 cursor-pointer transition-colors bg-amber-50/20 hover:bg-orange-50/70 dark:hover:bg-slate-800/80 flex items-start gap-2.5"
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
                <div className="flex-1 min-w-0 pr-6">
                  <p className="text-xs text-slate-800 dark:text-slate-200 font-semibold leading-snug break-words">
                    {item.text}
                  </p>
                  {item.subtext && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {item.subtext}
                    </p>
                  )}
                  {item.dateLabel && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-orange-700/80 dark:text-orange-400/80 font-medium">
                      <Calendar className="h-3 w-3 inline shrink-0" />
                      <span>{item.dateLabel}</span>
                    </div>
                  )}
                </div>
                
                {/* Botón individual para marcar como leída y borrar de la lista */}
                <button
                  type="button"
                  onClick={(e) => markSingleAsRead(e, item)}
                  title="Marcar como leída y quitar"
                  className="absolute right-2.5 top-3 p-1 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
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

