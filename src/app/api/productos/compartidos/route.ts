import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    // Obtener todos los productos con su información básica
    const productosResult = await query(
      `SELECT 
        p.id, 
        p.nombre, 
        p.precio, 
        p.foto, 
        p.tiene_parametros,
        p.porcentaje_ganancia,
        up.cantidad
       FROM productos p
       JOIN usuario_productos up ON p.id = up.producto_id`
    );

    // Para cada producto, obtener sus parámetros si los tiene
    const productosConParametros = await Promise.all(
      productosResult.rows.map(async (producto) => {
        if (producto.tiene_parametros) {
          // Obtener los parámetros
          const parametrosResult = await query(
            `SELECT 
              nombre,
              cantidad
             FROM usuario_producto_parametros
             WHERE producto_id = $1`,
            [producto.id]
          );

          return {
            ...producto,
            parametros: parametrosResult.rows
          };
        }
        return producto;
      })
    );

    // Transformar el campo porcentaje_ganancia a porcentajeGanancia para mantener consistencia en el frontend
    const productosFormateados = productosConParametros.map(producto => {
      // Si existe porcentaje_ganancia, lo copiamos a porcentajeGanancia
      if (producto.porcentaje_ganancia !== undefined) {
        return {
          ...producto,
          porcentajeGanancia: producto.porcentaje_ganancia
        };
      }
      return producto;
    });

    return NextResponse.json(productosFormateados);
  } catch (error) {
    console.error('Error al obtener productos compartidos:', error);
    return NextResponse.json({ error: 'Error al obtener productos compartidos' }, { status: 500 });
  }
} 