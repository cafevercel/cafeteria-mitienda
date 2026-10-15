import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');
  const userId = searchParams.get('userId');
  const startDate = searchParams.get('startDate') || searchParams.get('fechaInicio');
  const endDate = searchParams.get('endDate') || searchParams.get('fechaFin');

  if (!role || (role !== 'Almacen' && role !== 'Vendedor')) {
    return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
  }

  if (role === 'Vendedor' && !userId) {
    return NextResponse.json({ error: 'Se requiere userId para vendedor' }, { status: 400 });
  }

  try {
    let result;
    const endParam = endDate ? (endDate.includes(' ') || endDate.includes('T') ? endDate : `${endDate} 23:59:59`) : null;

    if (role === 'Almacen') {
      result = await query(
        `WITH weeks AS (
           SELECT 
             (DATE_TRUNC('week', fecha))::date as week_start,
             (DATE_TRUNC('week', fecha) + INTERVAL '6 days' + INTERVAL '23 hours 59 minutes 59 seconds')::timestamp as week_end
           FROM ventas
           WHERE ($1::date IS NULL OR fecha >= $1::date)
             AND ($2::timestamp IS NULL OR fecha <= $2::timestamp)
           GROUP BY DATE_TRUNC('week', fecha)
           ORDER BY week_start DESC
           LIMIT 12
         )
         SELECT 
           w.week_start,
           w.week_end::date as week_end,
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
               'fecha', v.fecha,
               'metodo_pago', v.metodo_pago,
               'monto_efectivo', v.monto_efectivo,
               'monto_transferencia', v.monto_transferencia
             )
           ) FILTER (WHERE v.id IS NOT NULL) as detalles_ventas
         FROM weeks w
         CROSS JOIN usuarios u
         LEFT JOIN ventas v ON v.vendedor = u.id 
           AND v.fecha >= w.week_start 
           AND v.fecha <= w.week_end
         WHERE u.rol = 'Vendedor' AND u.activo = true
         GROUP BY w.week_start, w.week_end, u.id, u.nombre
         ORDER BY w.week_start DESC, total_ventas DESC`,
        [startDate || null, endParam]
      );
    } else {
      result = await query(
        `WITH weeks AS (
           SELECT 
             (DATE_TRUNC('week', fecha))::date as week_start,
             (DATE_TRUNC('week', fecha) + INTERVAL '6 days' + INTERVAL '23 hours 59 minutes 59 seconds')::timestamp as week_end
           FROM ventas
           WHERE vendedor = $1
             AND ($2::date IS NULL OR fecha >= $2::date)
             AND ($3::timestamp IS NULL OR fecha <= $3::timestamp)
           GROUP BY DATE_TRUNC('week', fecha)
           ORDER BY week_start DESC
           LIMIT 12
         )
         SELECT 
           w.week_start,
           w.week_end::date as week_end,
           $1::uuid as vendedor_id,
           'Vendedor' as vendedor_nombre,
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
               'fecha', v.fecha,
               'metodo_pago', v.metodo_pago,
               'monto_efectivo', v.monto_efectivo,
               'monto_transferencia', v.monto_transferencia
             )
           ) FILTER (WHERE v.id IS NOT NULL) as detalles_ventas
         FROM weeks w
         LEFT JOIN ventas v ON v.vendedor = $1
           AND v.fecha >= w.week_start 
           AND v.fecha <= w.week_end
         GROUP BY w.week_start, w.week_end
         ORDER BY w.week_start DESC`,
        [userId, startDate || null, endParam]
      );
    }

    return NextResponse.json(result.rows);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener ventas semanales' }, { status: 500 });
  }
}
