import React from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VencimientoBellProps {
  vencidosCount: number;
  venceProntoCount: number;
  onClick?: () => void;
}

export const VencimientoBell: React.FC<VencimientoBellProps> = ({
  vencidosCount,
  venceProntoCount,
  onClick
}) => {
  const totalCriticos = vencidosCount + venceProntoCount;

  return (
    <div className="relative inline-block">
      <Button
        variant="outline"
        size="icon"
        onClick={onClick}
        className="relative border-orange-200 hover:bg-orange-50 text-orange-700 dark:border-orange-800 dark:hover:bg-orange-950"
        title={`Vencimientos: ${vencidosCount} vencidos, ${venceProntoCount} por vencer`}
      >
        <Bell className="h-5 w-5" />
        {totalCriticos > 0 && (
          <span className={`absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm ${
            vencidosCount > 0 ? 'bg-red-600 animate-pulse' : 'bg-amber-500'
          }`}>
            {totalCriticos > 99 ? '99+' : totalCriticos}
          </span>
        )}
      </Button>
    </div>
  );
};

export default VencimientoBell;
