import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {

  try {

    

    const vendedorId = params.id;
    
    // Obtener productos con su información básica
    const productosResult = await query(
      `SELECT 
        p.id, 
        p.nombre, 
        p.precio, 
        p.foto, 
        p.tiene_parametros,
        up.cantidad
       FROM productos p
       JOIN usuario_productos up ON p.id = up.producto_id
       WHERE up.usuario_id = $1`,
      [vendedorId]
    );

    // Para cada producto, obtener sus parámetros si los tiene
    const productosConParametros = await Promise.all(
      productosResult.rows.map(async (producto) => {
        if (producto.tiene_parametros) {
          // Obtener los parámetros asignados al vendedor
          const parametrosResult = await query(
            `SELECT 
              nombre,
              cantidad
             FROM usuario_producto_parametros
             WHERE usuario_id = $1 AND producto_id = $2`,
            [vendedorId, producto.id]
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
    console.error('Error al obtener productos del vendedor:', error);
    return NextResponse.json({ error: 'Error al obtener productos del vendedor' }, { status: 500 });
  }
}