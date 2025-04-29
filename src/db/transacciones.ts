import { query } from '@/lib/db';
import { ITransaccion } from '@/models/Transaccion';

export async function createTransaccion(transaccion: Partial<ITransaccion>): Promise<ITransaccion> {
  const { producto, cantidad, precio, desde, hacia, fecha } = transaccion;
  const result = await query(
    'INSERT INTO transacciones (producto, cantidad, precio, desde, hacia, fecha) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [producto, cantidad, precio, desde, hacia, fecha]
  );
  return result.rows[0];
}

export async function findTransaccionesByVendedor(vendedorId: string): Promise<ITransaccion[]> {
  const result = await query(
    'SELECT t.*, p.nombre as producto_nombre FROM transacciones t JOIN productos p ON t.producto = p.id WHERE t.hacia = $1 ORDER BY t.fecha DESC',
    [vendedorId]
  );
  return result.rows;
}