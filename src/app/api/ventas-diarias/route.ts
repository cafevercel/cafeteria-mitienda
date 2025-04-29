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
           json_agg(
             json_build_object(
               'id', v.id,
               'producto_id', v.producto,
               'cantidad', v.cantidad,
               'total', v.total
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
           json_agg(
             json_build_object(
               'id', id,
               'producto_id', producto,
               'cantidad', cantidad,
               'total', total,
               'parametros', parametros
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
