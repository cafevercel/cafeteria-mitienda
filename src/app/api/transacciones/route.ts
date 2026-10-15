import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// api/transacciones/route.ts - Función POST (sin cambios)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productoId, cantidad, tipo, parametros, userId } = body;

    console.log('Request body:', body);

    if (!productoId || cantidad === undefined || cantidad === null || !tipo || !userId) {
      return NextResponse.json({ error: 'Faltan datos requeridos (incluyendo userId)' }, { status: 400 });
    }

    await query('BEGIN');

    try {
      // 1. Obtener información del usuario destino
      const usuarioResult = await query('SELECT nombre FROM usuarios WHERE id = $1', [userId]);
      if (usuarioResult.rows.length === 0) {
        throw new Error('Usuario destino no encontrado');
      }
      const nombreUsuario = usuarioResult.rows[0].nombre;
      const esCocina = nombreUsuario.toLowerCase() === 'cocina';

      // 2. Obtener información del producto
      const productoResult = await query(
        'SELECT tiene_parametros, cantidad as stock_actual, precio FROM productos WHERE id = $1',
        [productoId]
      );

      if (productoResult.rows.length === 0) {
        throw new Error('Producto no encontrado');
      }

      const { tiene_parametros, stock_actual, precio } = productoResult.rows[0];

      // 3. Validar stock y actualizar inventario principal (Almacén)
      if (tiene_parametros) {
        if (!parametros || !Array.isArray(parametros) || parametros.length === 0) {
          throw new Error('Este producto requiere parámetros. Por favor, especifique los parámetros.');
        }

        const cantidadTotalParametros = parametros.reduce((sum: number, param: any) => sum + param.cantidad, 0);

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

      // 4. Registrar la transacción
      const transactionResult = await query(
        'INSERT INTO transacciones (producto, cantidad, tipo, desde, hacia, fecha, es_cocina) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [productoId, cantidad, tipo, 'Almacen', nombreUsuario, new Date(), esCocina]
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

      // 5. Actualizar inventario del Usuario Destino (usuario_productos)
      // Usamos ON CONFLICT para simplificar insert/update
      await query(
        `INSERT INTO usuario_productos (usuario_id, producto_id, cantidad, precio) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (usuario_id, producto_id) 
         DO UPDATE SET 
           cantidad = usuario_productos.cantidad + $3, 
           precio = $4`,
        [userId, productoId, cantidad, precio]
      );

      // Si tiene parámetros, actualizar usuario_producto_parametros
      if (tiene_parametros && parametros && parametros.length > 0) {
        for (const param of parametros) {
          await query(
            `INSERT INTO usuario_producto_parametros (usuario_id, producto_id, nombre, cantidad) 
             VALUES ($1, $2, $3, $4) 
             ON CONFLICT (usuario_id, producto_id, nombre) 
             DO UPDATE SET cantidad = usuario_producto_parametros.cantidad + $4`,
            [userId, productoId, param.nombre, param.cantidad]
          );
        }
      }

      // Si el destino es un Vendedor (excluyendo Almacén), registrar/iniciar vigencia
      const esVendedorRes = await query(`SELECT rol FROM usuarios WHERE id = $1`, [userId]);
      if (esVendedorRes.rows.length > 0 && esVendedorRes.rows[0].rol === 'Vendedor') {
        // Iniciar nuevo período de vigencia para esta entrega
        await query(
          `INSERT INTO vigencias_productos (usuario_id, producto_id, cantidad_inicial, fecha_inicio, estado)
           VALUES ($1, $2, $3, NOW(), 'activa')`,
          [userId, productoId, cantidad]
        );
      }

      await query('COMMIT');

      return NextResponse.json({
        message: `Producto entregado a ${nombreUsuario} exitosamente`,
        transaction: transactionResult.rows[0],
        destino: nombreUsuario
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

// ✅ GET MODIFICADO - SIN FILTROS DE es_cocina
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const vendedorId = searchParams.get('vendedorId');
  const productoId = searchParams.get('productoId');

  try {
    const limit = searchParams.get('limit') || '200';
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
        p.tiene_parametros,
        t.es_cocina,
        t.producto as producto_id,
        COALESCE(
          json_agg(
            json_build_object(
              'nombre', tp.nombre,
              'cantidad', tp.cantidad
            )
          ) FILTER (WHERE tp.id IS NOT NULL),
          '[]'::json
        ) as parametros
      FROM transacciones t 
      JOIN productos p ON t.producto = p.id 
      LEFT JOIN transaccion_parametros tp ON t.id = tp.transaccion_id
    `;

    const whereClauses: string[] = [];
    const params: any[] = [];

    if (productoId) {
      params.push(productoId);
      whereClauses.push(`t.producto = $${params.length}`);
    } else if (vendedorId) {
      params.push(vendedorId);
      whereClauses.push(`(t.hacia = $${params.length} OR t.desde = $${params.length})`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    params.push(parseInt(limit));
    const limitParamIndex = params.length;

    const fullQuery = `
      ${baseQuery}
      ${whereSql}
      GROUP BY t.id, p.nombre, t.cantidad, t.tipo, t.desde, t.hacia, t.fecha, p.precio, p.tiene_parametros, t.es_cocina, t.producto
      ORDER BY t.fecha DESC
      LIMIT $${limitParamIndex}
    `;

    const transacciones = await query(fullQuery, params);

    const transaccionesConParametros = transacciones.rows.map((transaccion) => {
      if (transaccion.tiene_parametros) {
        return {
          ...transaccion,
          parametros: Array.isArray(transaccion.parametros) ? transaccion.parametros : []
        };
      }
      const { parametros, ...rest } = transaccion;
      return rest;
    });

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
