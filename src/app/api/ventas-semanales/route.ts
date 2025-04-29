import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');
  const userId = searchParams.get('userId');

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
        `WITH weeks AS (
           SELECT 
             (DATE_TRUNC('week', fecha))::date as week_start,
             (DATE_TRUNC('week', fecha) + INTERVAL '6 days' + INTERVAL '23 hours 59 minutes 59 seconds')::timestamp as week_end
           FROM ventas
           GROUP BY DATE_TRUNC('week', fecha)
         )
         SELECT 
           w.week_start,
           w.week_end::date as week_end,
           u.id as vendedor_id,
           u.nombre as vendedor_nombre,
           COALESCE(SUM(v.total), 0) as total_ventas,
           json_agg(
             json_build_object(
               'id', v.id,
               'producto_id', v.producto,
               'cantidad', v.cantidad,
               'total', v.total,
               'fecha', v.fecha
             )
           ) FILTER (WHERE v.id IS NOT NULL) as detalles_ventas
         FROM weeks w
         CROSS JOIN usuarios u
         LEFT JOIN ventas v ON v.vendedor = u.id 
           AND v.fecha >= w.week_start 
           AND v.fecha <= w.week_end
         WHERE u.rol = 'Vendedor'
         GROUP BY w.week_start, w.week_end, u.id, u.nombre
         ORDER BY w.week_start DESC, total_ventas DESC`
      );
    } else {
      result = await query(
        `WITH weeks AS (
           SELECT 
             (DATE_TRUNC('week', fecha))::date as week_start,
             (DATE_TRUNC('week', fecha) + INTERVAL '6 days' + INTERVAL '23 hours 59 minutes 59 seconds')::timestamp as week_end
           FROM ventas
           WHERE vendedor = $1
           GROUP BY DATE_TRUNC('week', fecha)
         )
         SELECT 
           w.week_start,
           w.week_end::date as week_end,
           $1::uuid as vendedor_id,
           'Vendedor' as vendedor_nombre,
           COALESCE(SUM(v.total), 0) as total_ventas,
           json_agg(
             json_build_object(
               'id', v.id,
               'producto_id', v.producto,
               'cantidad', v.cantidad,
               'total', v.total,
               'fecha', v.fecha
             )
           ) FILTER (WHERE v.id IS NOT NULL) as detalles_ventas
         FROM weeks w
         LEFT JOIN ventas v ON v.vendedor = $1
           AND v.fecha >= w.week_start 
           AND v.fecha <= w.week_end
         GROUP BY w.week_start, w.week_end
         ORDER BY w.week_start DESC`,
        [userId]
      );
    }

    return NextResponse.json(result.rows);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener ventas semanales' }, { status: 500 });
  }
}
