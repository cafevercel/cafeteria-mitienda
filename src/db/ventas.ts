  import { query } from '@/lib/db';
  import { IVenta } from '@/models/Venta';

  export async function createVenta(venta: Partial<IVenta>): Promise<IVenta> {
    const { producto, cantidad, precio_unitario, total, vendedor, fecha } = venta;
    const result = await query(
      'INSERT INTO ventas (producto, cantidad, precio_unitario, total, vendedor, fecha) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [producto, cantidad, precio_unitario, total, vendedor, fecha]
    );
    return result.rows[0];
  }

  export async function findVentasByVendedorAndDate(
    vendedorId: string,
    startDate: Date,
    endDate: Date
  ): Promise<IVenta[]> {
    const result = await query(
      `SELECT v.*, p.nombre as producto_nombre, p.foto as producto_foto
      FROM ventas v
      JOIN productos p ON v.producto = p.id
      WHERE v.vendedor = $1 AND v.fecha BETWEEN $2 AND $3`,
      [vendedorId, startDate, endDate]
    );
    return result.rows;
  }

  export async function getIngresosDia(): Promise<any[]> {
    const result = await query(
      `SELECT v.vendedor as vendedor_id, u.nombre as vendedor_nombre, SUM(v.total) as total
      FROM ventas v
      JOIN usuarios u ON v.vendedor = u.id
      WHERE DATE(v.fecha) = CURRENT_DATE
      GROUP BY v.vendedor, u.nombre`
    );
    return result.rows;
  }

  export async function getIngresosMes(): Promise<any[]> {
    const result = await query(
      `SELECT DATE(v.fecha) as fecha, SUM(v.total) as total
      FROM ventas v
      WHERE DATE_TRUNC('month', v.fecha) = DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY DATE(v.fecha)
      ORDER BY fecha`
    );
    return result.rows;
  }