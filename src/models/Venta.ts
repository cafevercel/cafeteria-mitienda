export interface IVenta {
  id: string;
  producto: string;
  cantidad: number;
  precio_unitario: number;
  total: number;
  vendedor: string;
  fecha: Date;
  metodo_pago?: 'efectivo' | 'transferencia' | 'mixto';
  monto_efectivo?: number;
  monto_transferencia?: number;
}