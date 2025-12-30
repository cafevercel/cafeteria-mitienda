import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const vendedorId = params.id;

    console.log('🔍 Obteniendo productos para vendedor:', vendedorId);

    // Obtener productos del vendedor con una consulta optimizada
    const productosQuery = `
      SELECT 
        p.id, 
        p.nombre, 
        p.precio, 
        p.foto, 
        p.tiene_parametros,
        p.precio_compra,
        p.porcentaje_ganancia as "porcentajeGanancia",
        p.seccion,
        up.cantidad,
        COALESCE(
          json_agg(
            json_build_object(
              'nombre', upp.nombre,
              'cantidad', upp.cantidad
            )
          ) FILTER (WHERE upp.id IS NOT NULL),
          '[]'::json
        ) as parametros
      FROM usuario_productos up
      INNER JOIN productos p ON up.producto_id = p.id
      LEFT JOIN usuario_producto_parametros upp 
        ON upp.usuario_id = up.usuario_id 
        AND upp.producto_id = up.producto_id
      WHERE up.usuario_id = $1
      GROUP BY 
        p.id, 
        p.nombre, 
        p.precio, 
        p.foto, 
        p.tiene_parametros, 
        p.precio_compra,
        p.porcentaje_ganancia,
        p.seccion,
        up.cantidad
      ORDER BY p.nombre ASC
    `;

    const productosResult = await query(productosQuery, [Number(vendedorId)]);

    // Transformar los datos para asegurar la estructura correcta
    const productos = productosResult.rows.map(row => {
      const producto = {
        id: row.id,
        nombre: row.nombre,
        precio: parseFloat(row.precio),
        cantidad: row.cantidad,
        foto: row.foto,
        tiene_parametros: row.tiene_parametros,
        tieneParametros: row.tiene_parametros,
        precio_compra: row.precio_compra ? parseFloat(row.precio_compra) : null,
        porcentajeGanancia: row.porcentajeGanancia,
        seccion: row.seccion,
        parametros: Array.isArray(row.parametros) ? row.parametros : []
      };

      // Log para debugging
      if (producto.tiene_parametros) {
        console.log(`   📦 ${producto.nombre}:`, {
          cantidad_producto: producto.cantidad,
          parametros: producto.parametros,
          total_parametros: producto.parametros.reduce((sum: number, p: any) => sum + p.cantidad, 0)
        });
      }

      return producto;
    });

    console.log(`✅ Total productos obtenidos: ${productos.length}`);
    console.log(`   Con parámetros: ${productos.filter(p => p.tiene_parametros).length}`);

    return NextResponse.json(productos);

  } catch (error) {
    console.error('❌ Error al obtener productos del vendedor:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Error al obtener productos del vendedor', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Error desconocido al obtener productos del vendedor' },
      { status: 500 }
    );
  }
}
