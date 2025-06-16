import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const result = await query(`
      SELECT 
        t.id, 
        p.nombre as producto, 
        t.cantidad, 
        t.tipo, 
        t.desde, 
        t.hacia, 
        t.fecha, 
        p.precio,
        p.tiene_parametros,
        COALESCE(
          json_agg(
            json_build_object(
              'nombre', tp.nombre,
              'cantidad', tp.cantidad
            )
          ) FILTER (WHERE tp.id IS NOT NULL),
          '[]'::json
        ) as parametros
      FROM transacciones t 
      JOIN productos p ON t.producto = p.id
      LEFT JOIN transaccion_parametros tp ON t.id = tp.transaccion_id
      GROUP BY t.id, p.nombre, p.precio, p.tiene_parametros
      ORDER BY t.fecha DESC
    `);

    // Crear respuesta con encabezados anti-caché
    const response = NextResponse.json(result.rows);
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');
    
    return response;
  } catch (error) {
    console.error('Error al obtener transacciones compartidas:', error);
    return NextResponse.json({ error: 'Error al obtener transacciones' }, { status: 500 });
  }
}