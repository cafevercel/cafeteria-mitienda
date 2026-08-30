import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fecha = searchParams.get('fecha');
  const role = searchParams.get('role');
  const userId = searchParams.get('userId');

  if (!fecha) {
    return NextResponse.json({ error: 'Se requiere la fecha' }, { status: 400 });
  }

  if (!role || (role !== 'Almacen' && role !== 'Vendedor')) {
    return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
  }

  if (role === 'Vendedor' && !userId) {
    return NextResponse.json({ error: 'Se requiere userId para vendedor' }, { status: 400 });
  }

  try {
    let result;
    if (role === 'Almacen') {
      result = await query(
        `SELECT 
           u.id as vendedor_id,
           u.nombre as vendedor_nombre,
           COALESCE(SUM(v.total), 0) as total_ventas,
           COALESCE(SUM(
             CASE
               WHEN v.metodo_pago = 'transferencia' THEN
                 CASE WHEN COALESCE(v.monto_efectivo, 0) > 0 THEN v.monto_efectivo ELSE 0 END
               WHEN v.metodo_pago = 'mixto' THEN
                 CASE WHEN (COALESCE(v.monto_efectivo, 0) + COALESCE(v.monto_transferencia, 0)) > 0 THEN COALESCE(v.monto_efectivo, 0)
                      ELSE v.total END
               ELSE
                 CASE WHEN (COALESCE(v.monto_efectivo, 0) + COALESCE(v.monto_transferencia, 0)) > 0 THEN COALESCE(v.monto_efectivo, 0)
                      ELSE v.total END
             END
           ), 0) as total_efectivo,
           COALESCE(SUM(
             CASE
               WHEN v.metodo_pago = 'transferencia' THEN
                 CASE WHEN COALESCE(v.monto_transferencia, 0) > 0 THEN v.monto_transferencia ELSE v.total END
               WHEN v.metodo_pago = 'mixto' THEN
                 CASE WHEN (COALESCE(v.monto_efectivo, 0) + COALESCE(v.monto_transferencia, 0)) > 0 THEN COALESCE(v.monto_transferencia, 0)
                      ELSE 0 END
               ELSE
                 CASE WHEN (COALESCE(v.monto_efectivo, 0) + COALESCE(v.monto_transferencia, 0)) > 0 THEN COALESCE(v.monto_transferencia, 0)
                      ELSE 0 END
             END
           ), 0) as total_transferencia,
           json_agg(
             json_build_object(
               'id', v.id,
               'producto_id', v.producto,
               'cantidad', v.cantidad,
               'total', v.total,
               'metodo_pago', v.metodo_pago,
               'monto_efectivo', v.monto_efectivo,
               'monto_transferencia', v.monto_transferencia
             )
           ) FILTER (WHERE v.id IS NOT NULL) as detalles_ventas
         FROM usuarios u
         LEFT JOIN ventas v ON u.id = v.vendedor AND v.fecha::date = $1::date
         WHERE u.rol = 'Vendedor'
         GROUP BY u.id, u.nombre
         ORDER BY total_ventas DESC`,
        [fecha]
      );
    } else {
      result = await query(
        `SELECT 
           $1::uuid as vendedor_id,
           'Vendedor' as vendedor_nombre,
           COALESCE(SUM(total), 0) as total_ventas,
           COALESCE(SUM(
             CASE
               WHEN metodo_pago = 'transferencia' THEN
                 CASE WHEN COALESCE(monto_efectivo, 0) > 0 THEN monto_efectivo ELSE 0 END
               WHEN metodo_pago = 'mixto' THEN
                 CASE WHEN (COALESCE(monto_efectivo, 0) + COALESCE(monto_transferencia, 0)) > 0 THEN COALESCE(monto_efectivo, 0)
                      ELSE total END
               ELSE
                 CASE WHEN (COALESCE(monto_efectivo, 0) + COALESCE(monto_transferencia, 0)) > 0 THEN COALESCE(monto_efectivo, 0)
                      ELSE total END
             END
           ), 0) as total_efectivo,
           COALESCE(SUM(
             CASE
               WHEN metodo_pago = 'transferencia' THEN
                 CASE WHEN COALESCE(monto_transferencia, 0) > 0 THEN monto_transferencia ELSE total END
               WHEN metodo_pago = 'mixto' THEN
                 CASE WHEN (COALESCE(monto_efectivo, 0) + COALESCE(monto_transferencia, 0)) > 0 THEN COALESCE(monto_transferencia, 0)
                      ELSE 0 END
               ELSE
                 CASE WHEN (COALESCE(monto_efectivo, 0) + COALESCE(monto_transferencia, 0)) > 0 THEN COALESCE(monto_transferencia, 0)
                      ELSE 0 END
             END
           ), 0) as total_transferencia,
           json_agg(
             json_build_object(
               'id', id,
               'producto_id', producto,
               'cantidad', cantidad,
               'total', total,
               'parametros', parametros,
               'metodo_pago', metodo_pago,
               'monto_efectivo', monto_efectivo,
               'monto_transferencia', monto_transferencia
             )
           ) FILTER (WHERE id IS NOT NULL) as detalles_ventas
         FROM ventas
         WHERE vendedor = $1 AND fecha::date = $2::date`,
        [userId, fecha]
      );
    }

    return NextResponse.json(result.rows);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener ventas diarias' }, { status: 500 });
  }
}
