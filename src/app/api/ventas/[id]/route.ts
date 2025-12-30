//ventas/[id]/route.ts

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
      'SELECT * FROM ventas WHERE id = $1 AND vendedor = $2',
      [ventaId, vendedorId]
    );

    if (ventaResult.rows.length === 0) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });
    }

    const venta = ventaResult.rows[0];
    console.log('Venta encontrada:', venta);

    // Verificar si el producto tiene parámetros
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

    console.log('Parámetros de la venta:', ventaParametrosResult.rows);

    // Restaurar stock según el tipo de producto
    if (tieneParametros && ventaParametrosResult.rows.length > 0) {
      // Para productos CON parámetros: actualizar parámetros
      console.log('Restaurando parámetros al vendedor...');

      for (const param of ventaParametrosResult.rows) {
        console.log(`Restaurando parámetro: ${param.parametro}, cantidad: ${param.cantidad}`);

        await query(
          `INSERT INTO usuario_producto_parametros 
           (usuario_id, producto_id, nombre, cantidad)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (usuario_id, producto_id, nombre)
           DO UPDATE SET cantidad = usuario_producto_parametros.cantidad + $4`,
          [vendedorId, venta.producto, param.parametro, param.cantidad]
        );
      }
    } else {
      // Para productos SIN parámetros: actualizar directamente
      console.log('Restaurando cantidad del producto sin parámetros...');

      await query(
        'UPDATE usuario_productos SET cantidad = cantidad + $1 WHERE usuario_id = $2 AND producto_id = $3',
        [venta.cantidad, vendedorId, venta.producto]
      );
    }

    // Eliminar los registros en venta_parametros
    await query('DELETE FROM venta_parametros WHERE venta_id = $1', [ventaId]);

    // Eliminar la venta
    await query('DELETE FROM ventas WHERE id = $1', [ventaId]);

    await query('COMMIT');
    console.log('Venta eliminada exitosamente');

    // Crear respuesta con encabezados anti-caché
    const response = NextResponse.json({
      message: 'Venta eliminada con éxito',
      cantidadDevuelta: venta.cantidad,
      parametrosDevueltos: ventaParametrosResult.rows
    });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');

    return response;
  } catch (error) {
    console.error('Error al eliminar venta:', error);
    await query('ROLLBACK');
    return NextResponse.json({
      error: 'Error al eliminar venta',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}


export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ventaId = params.id;
  const body = await request.json();
  const { productoId, cantidad, fecha, parametros, vendedorId } = body;

  console.log('📝 Editando venta:', { ventaId, productoId, cantidad, fecha, parametros, vendedorId });

  if (!productoId || !cantidad || !fecha || !vendedorId) {
    return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
  }

  try {
    const fechaVenta = new Date(fecha);
    await query('BEGIN');

    // Obtener la venta original
    const ventaOriginalResult = await query(
      'SELECT * FROM ventas WHERE id = $1 AND vendedor = $2',
      [ventaId, vendedorId]
    );

    if (ventaOriginalResult.rows.length === 0) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });
    }

    const ventaOriginal = ventaOriginalResult.rows[0];
    console.log('📋 Venta original:', ventaOriginal);

    // Obtener parámetros originales de la venta
    const parametrosOriginalesResult = await query(
      'SELECT * FROM venta_parametros WHERE venta_id = $1',
      [ventaId]
    );

    console.log('📊 Parámetros originales:', parametrosOriginalesResult.rows);

    // Verificar información del producto original y nuevo
    const productoOriginalResult = await query(
      'SELECT tiene_parametros FROM productos WHERE id = $1',
      [ventaOriginal.producto]
    );

    const productoNuevoResult = await query(
      `SELECT p.precio, p.tiene_parametros
       FROM productos p 
       WHERE p.id = $1`,
      [productoId]
    );

    if (productoNuevoResult.rows.length === 0) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    const tieneParametrosOriginal = productoOriginalResult.rows[0]?.tiene_parametros;
    const { precio: precioUnitario, tiene_parametros: tieneParametrosNuevo } = productoNuevoResult.rows[0];

    console.log('🔍 Tipos de productos:', {
      tieneParametrosOriginal,
      tieneParametrosNuevo,
      productoOriginalId: ventaOriginal.producto,
      productoNuevoId: productoId
    });

    // PASO 1: Restaurar stock del producto original
    console.log('🔄 Restaurando stock del producto original...');

    if (tieneParametrosOriginal && parametrosOriginalesResult.rows.length > 0) {
      // Restaurar parámetros del producto original
      for (const param of parametrosOriginalesResult.rows) {
        console.log(`📈 Restaurando parámetro: ${param.parametro} +${param.cantidad}`);
        await query(
          `INSERT INTO usuario_producto_parametros 
           (usuario_id, producto_id, nombre, cantidad)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (usuario_id, producto_id, nombre)
           DO UPDATE SET cantidad = usuario_producto_parametros.cantidad + $4`,
          [vendedorId, ventaOriginal.producto, param.parametro, param.cantidad]
        );
      }
    } else {
      // Restaurar cantidad del producto original sin parámetros
      console.log(`📈 Restaurando producto sin parámetros: +${ventaOriginal.cantidad}`);
      await query(
        'UPDATE usuario_productos SET cantidad = cantidad + $1 WHERE usuario_id = $2 AND producto_id = $3',
        [ventaOriginal.cantidad, vendedorId, ventaOriginal.producto]
      );
    }

    // PASO 2: Verificar stock del nuevo producto DESPUÉS de la restauración
    console.log('🔍 Verificando stock del nuevo producto...');

    if (tieneParametrosNuevo && parametros && parametros.length > 0) {
      // Para productos con parámetros
      for (const param of parametros) {
        const stockParamResult = await query(
          `SELECT cantidad FROM usuario_producto_parametros 
           WHERE usuario_id = $1 AND producto_id = $2 AND nombre = $3`,
          [vendedorId, productoId, param.nombre]
        );

        const stockDisponible = stockParamResult.rows[0]?.cantidad || 0;
        console.log(`📊 Stock parámetro ${param.nombre}: ${stockDisponible}, requerido: ${param.cantidad}`);

        if (stockDisponible < param.cantidad) {
          await query('ROLLBACK');
          return NextResponse.json({
            error: `Stock insuficiente para el parámetro ${param.nombre}. Disponible: ${stockDisponible}, Requerido: ${param.cantidad}`
          }, { status: 400 });
        }
      }
    } else {
      // Para productos sin parámetros
      const stockResult = await query(
        'SELECT cantidad FROM usuario_productos WHERE usuario_id = $1 AND producto_id = $2',
        [vendedorId, productoId]
      );

      const stockDisponible = stockResult.rows[0]?.cantidad || 0;
      console.log(`📊 Stock producto: ${stockDisponible}, requerido: ${cantidad}`);

      if (stockDisponible < cantidad) {
        await query('ROLLBACK');
        return NextResponse.json({
          error: `Stock insuficiente. Disponible: ${stockDisponible}, Requerido: ${cantidad}`
        }, { status: 400 });
      }
    }

    // PASO 3: Eliminar parámetros antiguos
    console.log('🗑️ Eliminando parámetros antiguos...');
    await query('DELETE FROM venta_parametros WHERE venta_id = $1', [ventaId]);

    // PASO 4: Actualizar la venta
    console.log('💾 Actualizando venta...');
    const ventaActualizadaResult = await query(
      `UPDATE ventas 
       SET producto = $1, cantidad = $2, precio_unitario = $3, total = $4, fecha = $5
       WHERE id = $6 
       RETURNING *`,
      [
        productoId,
        cantidad,
        precioUnitario,
        precioUnitario * cantidad,
        fechaVenta,
        ventaId
      ]
    );

    // PASO 5: Reducir stock del nuevo producto e insertar nuevos parámetros
    console.log('📉 Reduciendo stock del nuevo producto...');

    if (tieneParametrosNuevo && parametros && parametros.length > 0) {
      for (const param of parametros) {
        // Insertar nuevos parámetros de la venta
        await query(
          `INSERT INTO venta_parametros (venta_id, parametro, cantidad)
           VALUES ($1, $2, $3)`,
          [ventaId, param.nombre, param.cantidad]
        );

        // Actualizar parámetros del inventario
        await query(
          `UPDATE usuario_producto_parametros 
           SET cantidad = cantidad - $1 
           WHERE usuario_id = $2 AND producto_id = $3 AND nombre = $4`,
          [param.cantidad, vendedorId, productoId, param.nombre]
        );

        console.log(`📉 Reducido parámetro ${param.nombre}: -${param.cantidad}`);
      }
    } else {
      // Para productos sin parámetros
      await query(
        'UPDATE usuario_productos SET cantidad = cantidad - $1 WHERE usuario_id = $2 AND producto_id = $3',
        [cantidad, vendedorId, productoId]
      );
      console.log(`📉 Reducido producto: -${cantidad}`);
    }

    await query('COMMIT');
    console.log('✅ Venta editada exitosamente');

    // Crear respuesta con encabezados anti-caché
    const response = NextResponse.json(ventaActualizadaResult.rows[0]);
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');

    return response;
  } catch (error) {
    await query('ROLLBACK');
    console.error('❌ Error al editar venta:', error);
    return NextResponse.json({
      error: 'Error interno del servidor al editar venta',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
