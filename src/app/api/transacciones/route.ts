import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productoId, vendedorId, cantidad, tipo, parametros } = body;

    console.log('Request body:', body);

    if (!productoId || !vendedorId || cantidad === undefined || cantidad === null || !tipo) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    await query('BEGIN');

    try {
      const productoResult = await query(
        'SELECT tiene_parametros, cantidad as stock_actual FROM productos WHERE id = $1',
        [productoId]
      );

      if (productoResult.rows.length === 0) {
        throw new Error('Producto no encontrado');
      }

      const { tiene_parametros, stock_actual } = productoResult.rows[0];

      // Validación de parámetros
      if (tiene_parametros) {
        if (!parametros || !Array.isArray(parametros) || parametros.length === 0) {
          throw new Error('Este producto requiere parámetros. Por favor, especifique los parámetros.');
        }

        console.log('Parámetros recibidos:', parametros);

        // Calcular la cantidad total a descontar del stock principal
        const cantidadTotalParametros = parametros.reduce((sum, param) => sum + param.cantidad, 0);

        // Validar stock principal
        if (stock_actual < cantidadTotalParametros) {
          throw new Error('Stock total insuficiente');
        }

        // Actualizar stock principal
        await query(
          'UPDATE productos SET cantidad = cantidad - $1 WHERE id = $2',
          [cantidadTotalParametros, productoId]
        );
      } else {
        if (stock_actual < cantidad) {
          throw new Error('Stock insuficiente');
        }

        await query(
          'UPDATE productos SET cantidad = cantidad - $1 WHERE id = $2',
          [cantidad, productoId]
        );
      }

      // Registrar la transacción
      const transactionResult = await query(
        'INSERT INTO transacciones (producto, cantidad, tipo, desde, hacia, fecha) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [productoId, cantidad, tipo, null, vendedorId, new Date()]
      );

      const transaccionId = transactionResult.rows[0].id;

      // Registrar los parámetros de la transacción
      if (tiene_parametros && parametros && parametros.length > 0) {
        for (const param of parametros) {
          await query(
            `INSERT INTO transaccion_parametros (transaccion_id, nombre, cantidad) 
             VALUES ($1, $2, $3)`,
            [transaccionId, param.nombre, param.cantidad]
          );
        }
      }

      const productResult = await query('SELECT precio FROM productos WHERE id = $1', [productoId]);
      const productPrice = productResult.rows[0]?.precio;

      if (!productPrice) {
        throw new Error('No se pudo obtener el precio del producto');
      }

      await query(
        `INSERT INTO usuario_productos (usuario_id, producto_id, cantidad, precio) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (usuario_id, producto_id) 
         DO UPDATE SET cantidad = usuario_productos.cantidad + $3, precio = $4`,
        [vendedorId, productoId, cantidad, productPrice]
      );

      // Actualizar parámetros del usuario
      if (tiene_parametros && parametros && parametros.length > 0) {
        for (const param of parametros) {
          // Actualizar stock de parámetros
          await query(
            'UPDATE producto_parametros SET cantidad = cantidad - $1 WHERE producto_id = $2 AND nombre = $3',
            [param.cantidad, productoId, param.nombre]
          );

          // Actualizar parámetros del usuario
          await query(
            `INSERT INTO usuario_producto_parametros (usuario_id, producto_id, nombre, cantidad)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (usuario_id, producto_id, nombre)
            DO UPDATE SET cantidad = usuario_producto_parametros.cantidad + $4`,
            [vendedorId, productoId, param.nombre, param.cantidad]
          );
        }
      }

      await query('COMMIT');

      return NextResponse.json({
        message: 'Producto entregado exitosamente',
        transaction: transactionResult.rows[0]
      });

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: 'Error al entregar producto', details: error.message }, { status: 500 });
    } else {
      return NextResponse.json({ error: 'Error desconocido al entregar producto' }, { status: 500 });
    }
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const vendedorId = searchParams.get('vendedorId');
  const productoId = searchParams.get('productoId');

  if (!vendedorId && !productoId) {
    return NextResponse.json({ error: 'Se requiere el ID del vendedor o el ID del producto' }, { status: 400 });
  }

  try {
    let transacciones;
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
    `;

    if (productoId) {
      transacciones = await query(
        baseQuery + ' WHERE t.producto = $1 ORDER BY t.fecha DESC',
        [productoId]
      );
    } else {
      transacciones = await query(
        baseQuery + ' WHERE t.hacia = $1 OR t.desde = $1 ORDER BY t.fecha DESC',
        [vendedorId]
      );
    }

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

    return NextResponse.json(transaccionesConParametros);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Error al obtener transacciones', details: error.message }, 
        { status: 500 }
      );
    } else {
      return NextResponse.json(
        { error: 'Error desconocido al obtener transacciones' }, 
        { status: 500 }
      );
    }
  }
}
