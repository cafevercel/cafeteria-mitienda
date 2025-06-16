import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const result = await query(`
      SELECT 
        p.id,
        p.nombre,
        p.precio,
        p.cantidad,
        p.foto,
        p.tiene_parametros,
        p.precio_compra,
        p.porcentaje_ganancia as "porcentajeGanancia",
        COALESCE(
          json_agg(
            json_build_object(
              'nombre', pp.nombre,
              'cantidad', pp.cantidad
            )
          ) FILTER (WHERE pp.id IS NOT NULL),
          '[]'::json
        ) as parametros
      FROM productos p
      LEFT JOIN producto_parametros pp ON p.id = pp.producto_id
      GROUP BY p.id
    `);

    // Crear respuesta con encabezados anti-caché
    const response = NextResponse.json(result.rows);
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');
    
    return response;
  } catch (error) {
    console.error('Error al obtener productos compartidos:', error);
    return NextResponse.json({ error: 'Error al obtener productos compartidos' }, { status: 500 });
  }
}