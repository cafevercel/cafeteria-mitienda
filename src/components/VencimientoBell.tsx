import React, { useState, useEffect, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VencimientoBellProps {
  vencidosCount?: number;
  venceProntoCount?: number;
  unreadCountOverride?: number;
  onClick?: () => void;
}

export const getNotificationKey = (type: 'vencimiento' | 'almacen', item: any): string => {
  if (type === 'vencimiento') {
    return `v_${item.id}_${item.estado}_${item.fecha_vencimiento || ''}`;
  }
  return `s_${item.usuario_id}_${item.producto_id}_${item.estado}_${item.cantidad}`;
};

export const VencimientoBell: React.FC<VencimientoBellProps> = ({
  vencidosCount,
  venceProntoCount,
  unreadCountOverride,
  onClick
}) => {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [hasUrgent, setHasUrgent] = useState<boolean>(false);

  const calculateUnread = useCallback(async () => {
    try {
      const res = await fetch('/api/notificaciones');
      if (!res.ok) return;
      const data = await res.json();

      const vencimientos = (data.vencimientos || []).filter((v: any) => v.estado !== 'vigente');
      const almacen = (data.almacen || []).filter((a: any) => a.estado !== 'normal');

      let readKeysSet = new Set<string>();
      try {
        const stored = localStorage.getItem('read_notif_keys');
        if (stored) {
          readKeysSet = new Set(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Error reading read_notif_keys from localStorage:', e);
      }

      let count = 0;
      let urgent = false;

      vencimientos.forEach((v: any) => {
        const key = getNotificationKey('vencimiento', v);
        if (!readKeysSet.has(key)) {
          count++;
          if (v.estado === 'vencido') urgent = true;
        }
      });

      almacen.forEach((a: any) => {
        const key = getNotificationKey('almacen', a);
        if (!readKeysSet.has(key)) {
          count++;
          if (a.estado === 'agotado') urgent = true;
        }
      });

      setUnreadCount(count);
      setHasUrgent(urgent);
    } catch (err) {
      console.error('Error fetching notification count for bell:', err);
    }
  }, []);

  useEffect(() => {
    calculateUnread();

    const handleUpdate = () => calculateUnread();
    window.addEventListener('notificaciones_updated', handleUpdate);
    window.addEventListener('focus', handleUpdate);

    // Refresh count every 60 seconds
    const interval = setInterval(calculateUnread, 60000);

    return () => {
      window.removeEventListener('notificaciones_updated', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
      clearInterval(interval);
    };
  }, [calculateUnread]);

  // Determine final count to show
  const displayCount = unreadCountOverride !== undefined 
    ? unreadCountOverride 
    : (vencidosCount !== undefined && venceProntoCount !== undefined 
        ? (vencidosCount + venceProntoCount) 
        : unreadCount);

  return (
    <div className="relative inline-block">
      <Button
        variant="outline"
        size="icon"
        onClick={onClick}
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
  );
};

export default VencimientoBell;
