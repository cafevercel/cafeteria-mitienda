import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  // Desactivar caché para asegurar datos frescos
  const headers = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  };

  try {
    const baseQuery = `
      SELECT 
        t.id, 
        p.nombre as producto, 
        t.cantidad, 
        t.tipo, 
        t.desde, 
        t.hacia, 
        t.fecha, 
        p.precio,
        p.tiene_parametros
      FROM transacciones t 
      JOIN productos p ON t.producto = p.id 
      ORDER BY t.fecha DESC
    `;

    const transacciones = await query(baseQuery);

    // Obtener los parámetros para cada transacción
    const transaccionesConParametros = await Promise.all(
      transacciones.rows.map(async (transaccion) => {
        if (transaccion.tiene_parametros) {
          const parametrosResult = await query(
            `SELECT nombre, cantidad 
             FROM transaccion_parametros 
             WHERE transaccion_id = $1`,
            [transaccion.id]
          );
          return {
            ...transaccion,
            parametros: parametrosResult.rows
          };
        }
        return transaccion;
      })
    );

    return NextResponse.json(transaccionesConParametros, { headers });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Error al obtener transacciones', details: error.message }, 
        { status: 500, headers }
      );
    } else {
      return NextResponse.json(
        { error: 'Error desconocido al obtener transacciones' }, 
        { status: 500, headers }
      );
    }
  }
} 