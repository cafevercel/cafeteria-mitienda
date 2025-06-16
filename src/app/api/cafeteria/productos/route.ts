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
        p.precio_compra,
        p.foto, 
        p.tiene_parametros
       FROM productos p`
    );

    // Para cada producto, primero verificar si existe en usuario_productos
    const productosCompletos = await Promise.all(
      productosResult.rows.map(async (producto) => {
        // Buscar la cantidad del producto en usuario_productos (si existe)
        const cantidadResult = await query(
          `SELECT cantidad FROM usuario_productos WHERE producto_id = $1 LIMIT 1`,
          [producto.id]
        );
        
        // Si no existe en usuario_productos, la cantidad es 0
        const cantidad = cantidadResult.rows.length > 0 ? cantidadResult.rows[0].cantidad : 0;
        
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
            cantidad,
            parametros: parametrosResult.rows.length > 0 ? parametrosResult.rows : []
          };
        }
        
        return {
          ...producto,
          cantidad
        };
      })
    );

    // Crear respuesta con encabezados anti-caché
    const response = NextResponse.json(productosCompletos);
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');
    
    return response;
  } catch (error) {
    console.error('Error al obtener productos de cafetería:', error);
    return NextResponse.json({ error: 'Error al obtener productos de cafetería' }, { status: 500 });
  }
} 