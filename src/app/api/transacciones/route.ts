//api/transacciones/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// api/transacciones/route.ts - Reemplaza la función POST
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productoId, cantidad, tipo, parametros, esCocina } = body;

    console.log('Request body:', body);

    if (!productoId || cantidad === undefined || cantidad === null || !tipo) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    await query('BEGIN');

    try {
      const productoResult = await query(
        'SELECT tiene_parametros, cantidad as stock_actual, precio FROM productos WHERE id = $1',
        [productoId]
      );

      if (productoResult.rows.length === 0) {
        throw new Error('Producto no encontrado');
      }

      const { tiene_parametros, stock_actual, precio } = productoResult.rows[0];

      // Validar stock y actualizar inventario principal
      if (tiene_parametros) {
        if (!parametros || !Array.isArray(parametros) || parametros.length === 0) {
          throw new Error('Este producto requiere parámetros. Por favor, especifique los parámetros.');
        }

        const cantidadTotalParametros = parametros.reduce((sum, param) => sum + param.cantidad, 0);

        if (stock_actual < cantidadTotalParametros) {
          throw new Error('Stock total insuficiente');
        }

        // Actualizar parámetros en inventario principal
        for (const param of parametros) {
          await query(
            'UPDATE producto_parametros SET cantidad = cantidad - $1 WHERE producto_id = $2 AND nombre = $3',
            [param.cantidad, productoId, param.nombre]
          );
        }
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
        [productoId, cantidad, tipo, 'Almacen', esCocina ? 'Cocina' : 'Cafeteria', new Date()]
      );

      const transaccionId = transactionResult.rows[0].id;

      // Registrar parámetros de la transacción
      if (tiene_parametros && parametros && parametros.length > 0) {
        for (const param of parametros) {
          await query(
            `INSERT INTO transaccion_parametros (transaccion_id, nombre, cantidad) 
             VALUES ($1, $2, $3)`,
            [transaccionId, param.nombre, param.cantidad]
          );
        }
      }

      // ✅ CAMBIO PRINCIPAL: Manejar destino según esCocina
      if (esCocina) {
        // ✅ NUEVO: Insertar en tabla cocina
        await query(
          'INSERT INTO cocina (producto_id, cantidad, precio, cocina) VALUES ($1, $2, $3, $4)',
          [productoId, cantidad, precio, true]
        );

        // Si tiene parámetros, también insertar los parámetros en cocina
        if (tiene_parametros && parametros && parametros.length > 0) {
          // Necesitarás crear una tabla cocina_parametros similar a usuario_producto_parametros
          for (const param of parametros) {
            await query(
              'INSERT INTO cocina_parametros (producto_id, nombre, cantidad) VALUES ($1, $2, $3) ON CONFLICT (producto_id, nombre) DO UPDATE SET cantidad = cocina_parametros.cantidad + $3',
              [productoId, param.nombre, param.cantidad]
            );
          }
        }
      } else {
        // Mantener lógica existente para cafetería (usuario_productos)
        const existingProduct = await query(
          'SELECT * FROM usuario_productos WHERE producto_id = $1',
          [productoId]
        );

        if (tiene_parametros) {
          if (existingProduct.rows.length === 0) {
            await query(
              'INSERT INTO usuario_productos (producto_id, cantidad, precio, cocina) VALUES ($1, $2, $3, $4)',
              [productoId, 0, precio, false]
            );
          } else {
            await query(
              'UPDATE usuario_productos SET precio = $1, cocina = $2 WHERE producto_id = $3',
              [precio, false, productoId]
            );
          }

          // Actualizar parámetros de usuario
          for (const param of parametros) {
            const existingParam = await query(
              'SELECT * FROM usuario_producto_parametros WHERE producto_id = $1 AND nombre = $2',
              [productoId, param.nombre]
            );

            if (existingParam.rows.length > 0) {
              await query(
                'UPDATE usuario_producto_parametros SET cantidad = cantidad + $1 WHERE producto_id = $2 AND nombre = $3',
                [param.cantidad, productoId, param.nombre]
              );
            } else {
              await query(
                'INSERT INTO usuario_producto_parametros (producto_id, nombre, cantidad) VALUES ($1, $2, $3)',
                [productoId, param.nombre, param.cantidad]
              );
            }
          }
        } else {
          if (existingProduct.rows.length > 0) {
            await query(
              'UPDATE usuario_productos SET cantidad = cantidad + $1, precio = $2, cocina = $3 WHERE producto_id = $4',
              [cantidad, precio, false, productoId]
            );
          } else {
            await query(
              'INSERT INTO usuario_productos (producto_id, cantidad, precio, cocina) VALUES ($1, $2, $3, $4)',
              [productoId, cantidad, precio, false]
            );
          }
        }
      }

      await query('COMMIT');

      return NextResponse.json({
        message: `Producto entregado ${esCocina ? 'a cocina' : 'a cafetería'} exitosamente`,
        transaction: transactionResult.rows[0],
        destino: esCocina ? 'Cocina' : 'Cafeteria'
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
    } else if (vendedorId) {
      transacciones = await query(
        baseQuery + ' WHERE t.hacia = $1 OR t.desde = $1 ORDER BY t.fecha DESC',
        [vendedorId]
      );
    } else {
      // Si no hay filtros, devolver todas las transacciones
      transacciones = await query(
        baseQuery + ' ORDER BY t.fecha DESC'
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
