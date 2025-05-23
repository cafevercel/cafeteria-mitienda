import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const vendedorId = params.id;
    
    // Obtener todos los productos con su información básica
    // Ya no filtramos por usuario_id porque ahora el inventario es compartido
    const productosResult = await query(
      `SELECT 
        p.id, 
        p.nombre, 
        p.precio, 
        p.foto, 
        p.tiene_parametros,
        up.cantidad
       FROM productos p
       JOIN usuario_productos up ON p.id = up.producto_id`
    );

    // Para cada producto, obtener sus parámetros si los tiene
    const productosConParametros = await Promise.all(
      productosResult.rows.map(async (producto) => {
        if (producto.tiene_parametros) {
          // Obtener todos los parámetros del producto (ya no específicos del vendedor)
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
    
    return NextResponse.json(productosConParametros);
  } catch (error) {
    console.error('Error al obtener productos compartidos:', error);
    return NextResponse.json({ error: 'Error al obtener productos compartidos' }, { status: 500 });
  }
}