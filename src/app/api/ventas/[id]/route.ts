import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ventaId = params.id;
  const vendedorId = request.nextUrl.searchParams.get('vendedorId');

  if (!vendedorId) {
    return NextResponse.json({ error: 'Se requiere el ID del vendedor' }, { status: 400 });
  }

  try {
    await query('BEGIN');

    // Obtener la venta
    const ventaResult = await query(
      'SELECT * FROM ventas WHERE id = $1',
      [ventaId]
    );

    if (ventaResult.rows.length === 0) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });
    }

    const venta = ventaResult.rows[0];

    // ✅ SOLUCIÓN: Verificar si el producto tiene parámetros
    const productoResult = await query(
      'SELECT tiene_parametros FROM productos WHERE id = $1',
      [venta.producto]
    );

    const tieneParametros = productoResult.rows[0]?.tiene_parametros;

    // Obtener los parámetros de la venta antes de eliminarlos
    const ventaParametrosResult = await query(
      'SELECT * FROM venta_parametros WHERE venta_id = $1',
      [ventaId]
    );

    // ✅ SOLUCIÓN: Restaurar stock según el tipo de producto
    if (tieneParametros && ventaParametrosResult.rows.length > 0) {
      // ✅ Para productos CON parámetros: solo actualizar parámetros
      for (const param of ventaParametrosResult.rows) {
        await query(
          `INSERT INTO usuario_producto_parametros 
           (producto_id, nombre, cantidad)
           VALUES ($1, $2, $3)
           ON CONFLICT (producto_id, nombre)
           DO UPDATE SET cantidad = usuario_producto_parametros.cantidad + $3`,
          [venta.producto, param.parametro, param.cantidad]
        );
        // ✅ El trigger automáticamente actualizará usuario_productos.cantidad
      }

      // ✅ NO actualizar usuario_productos directamente
      // El trigger ya lo hizo cuando actualizamos usuario_producto_parametros

    } else {
      // ✅ Para productos SIN parámetros: SÍ actualizar directamente
      await query(
        'UPDATE usuario_productos SET cantidad = cantidad + $1 WHERE producto_id = $2',
        [venta.cantidad, venta.producto]
      );
    }

    // Eliminar los registros en venta_parametros
    await query('DELETE FROM venta_parametros WHERE venta_id = $1', [ventaId]);

    // Eliminar la venta
    await query('DELETE FROM ventas WHERE id = $1', [ventaId]);

    await query('COMMIT');

    // Crear respuesta con encabezados anti-caché
    const response = NextResponse.json({ message: 'Venta eliminada con éxito' });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');

    return response;
  } catch (error) {
    console.error('Error al eliminar venta:', error);
    await query('ROLLBACK');
    return NextResponse.json({ error: 'Error al eliminar venta' }, { status: 500 });
  }
}
