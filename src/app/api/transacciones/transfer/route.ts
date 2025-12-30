import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Modificar la interfaz de la solicitud para incluir parámetros específicos
interface TransferRequest {
  productId: string;
  fromVendorId: string;
  toVendorId: string;
  cantidad: number;
  parametros?: { nombre: string; cantidad: number }[];
}

export async function POST(request: NextRequest) {
  try {
    const body: TransferRequest = await request.json();
    const { productId, fromVendorId, toVendorId, cantidad, parametros } = body;

    if (!productId || !fromVendorId || !toVendorId || cantidad === undefined) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    // Si cantidad es 0, debe haber parámetros
    if (cantidad === 0 && (!parametros || parametros.length === 0)) {
      return NextResponse.json({ error: 'Si la cantidad es 0, debe especificar parámetros' }, { status: 400 });
    }

    await query('BEGIN');

    try {
      // 1. Obtener nombres de los vendedores
      const vendedorOrigenResult = await query(
        'SELECT nombre FROM usuarios WHERE id = $1',
        [fromVendorId]
      );

      const vendedorDestinoResult = await query(
        'SELECT nombre FROM usuarios WHERE id = $1',
        [toVendorId]
      );

      if (vendedorOrigenResult.rows.length === 0) {
        throw new Error('Vendedor origen no encontrado');
      }

      if (vendedorDestinoResult.rows.length === 0) {
        throw new Error('Vendedor destino no encontrado');
      }

      const nombreVendedorOrigen = vendedorOrigenResult.rows[0].nombre;
      const nombreVendedorDestino = vendedorDestinoResult.rows[0].nombre;

      // 2. Verificar stock del vendedor origen
      const vendedorProductoResult = await query(
        'SELECT cantidad, precio FROM usuario_productos WHERE usuario_id = $1 AND producto_id = $2',
        [fromVendorId, productId]
      );

      if (vendedorProductoResult.rows.length === 0) {
        throw new Error('El vendedor origen no tiene este producto');
      }

      const { cantidad: stockVendedor, precio } = vendedorProductoResult.rows[0];

      if (stockVendedor < cantidad) {
        throw new Error('Stock insuficiente en vendedor origen');
      }

      // 3. Verificar si el producto tiene parámetros
      const productoResult = await query(
        'SELECT tiene_parametros FROM productos WHERE id = $1',
        [productId]
      );

      const { tiene_parametros } = productoResult.rows[0];

      // 4. Si tiene parámetros, verificar que los parámetros enviados sean válidos
      if (tiene_parametros) {
        if (!parametros || parametros.length === 0) {
          throw new Error('Este producto requiere especificar parámetros para la transferencia');
        }

        // Verificar que cada parámetro tenga stock suficiente
        for (const param of parametros) {
          const paramResult = await query(
            'SELECT cantidad FROM usuario_producto_parametros WHERE usuario_id = $1 AND producto_id = $2 AND nombre = $3',
            [fromVendorId, productId, param.nombre]
          );

          if (paramResult.rows.length === 0 || paramResult.rows[0].cantidad < param.cantidad) {
            throw new Error(`Stock insuficiente para el parámetro ${param.nombre}`);
          }
        }
      }

      // ✅ 5. Registrar las transacciones - USAR productId (INTEGER) en lugar de nombreProducto (STRING)
      const bajaResult = await query(
        'INSERT INTO transacciones (producto, cantidad, tipo, desde, hacia, fecha) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [productId, cantidad, 'Baja', nombreVendedorOrigen, nombreVendedorDestino, new Date()]
        //                                                    
      );

      const entregaResult = await query(
        'INSERT INTO transacciones (producto, cantidad, tipo, desde, hacia, fecha) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [productId, cantidad, 'Entrega', nombreVendedorOrigen, nombreVendedorDestino, new Date()]
      );

      // 6. Actualizar stock del vendedor origen
      await query(
        'UPDATE usuario_productos SET cantidad = cantidad - $1 WHERE usuario_id = $2 AND producto_id = $3',
        [cantidad, fromVendorId, productId]
      );

      // 7. Actualizar o crear stock del vendedor destino
      await query(
        `INSERT INTO usuario_productos (usuario_id, producto_id, cantidad, precio) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (usuario_id, producto_id) 
         DO UPDATE SET cantidad = usuario_productos.cantidad + $3`,
        [toVendorId, productId, cantidad, precio]
      );

      // 8. Manejar los parámetros si existen
      if (tiene_parametros && parametros) {
        for (const param of parametros) {
          // Reducir parámetros del vendedor origen
          const updateOrigin = await query(
            'UPDATE usuario_producto_parametros SET cantidad = cantidad - $1 WHERE usuario_id = $2 AND producto_id = $3 AND nombre = $4 RETURNING cantidad',
            [param.cantidad, fromVendorId, productId, param.nombre]
          );

          // Verificar si la cantidad resultante es 0 para eliminar el registro
          if (updateOrigin.rows[0].cantidad === 0) {
            await query(
              'DELETE FROM usuario_producto_parametros WHERE usuario_id = $1 AND producto_id = $2 AND nombre = $3',
              [fromVendorId, productId, param.nombre]
            );
          }

          // Agregar o actualizar parámetros en vendedor destino
          await query(
            `INSERT INTO usuario_producto_parametros (usuario_id, producto_id, nombre, cantidad)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (usuario_id, producto_id, nombre)
            DO UPDATE SET cantidad = usuario_producto_parametros.cantidad + $4`,
            [toVendorId, productId, param.nombre, param.cantidad]
          );

          // Registrar los parámetros en ambas transacciones
          await query(
            'INSERT INTO transaccion_parametros (transaccion_id, nombre, cantidad) VALUES ($1, $2, $3)',
            [bajaResult.rows[0].id, param.nombre, param.cantidad]
          );

          await query(
            'INSERT INTO transaccion_parametros (transaccion_id, nombre, cantidad) VALUES ($1, $2, $3)',
            [entregaResult.rows[0].id, param.nombre, param.cantidad]
          );
        }
      }

      await query('COMMIT');

      return NextResponse.json({
        message: 'Transferencia completada exitosamente',
        transactions: {
          baja: bajaResult.rows[0],
          entrega: entregaResult.rows[0]
        }
      });

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Error en la transferencia', details: error.message },
        { status: 500 }
      );
    } else {
      return NextResponse.json(
        { error: 'Error desconocido en la transferencia' },
        { status: 500 }
      );
    }
  }
}



export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fromVendorId = searchParams.get('fromVendorId');
  const toVendorId = searchParams.get('toVendorId');

  if (!fromVendorId && !toVendorId) {
    return NextResponse.json(
      { error: 'Se requiere al menos un ID de vendedor' },
      { status: 400 }
    );
  }

  try {
    let result;
    const baseQuery = `
      SELECT 
        t.id,
        t.producto as producto_id,
        p.nombre as producto,
        t.cantidad,
        t.tipo,
        t.desde,
        t.hacia,
        t.fecha,
        p.precio,
        p.tiene_parametros,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', tp.id,
                'transaccion_id', tp.transaccion_id,
                'nombre', tp.nombre,
                'cantidad', tp.cantidad
              )
            )
            FROM transaccion_parametros tp
            WHERE tp.transaccion_id = t.id
          ),
          '[]'::json
        ) as parametros,
        u_desde.nombre as desde_nombre,
        u_hacia.nombre as hacia_nombre
      FROM transacciones t 
      JOIN productos p ON t.producto = p.id
      LEFT JOIN usuarios u_desde ON t.desde = u_desde.id
      LEFT JOIN usuarios u_hacia ON t.hacia = u_hacia.id
    `;

    if (fromVendorId && toVendorId) {
      // Si tenemos ambos IDs, mostramos SOLO las transacciones donde:
      // - Si es el fromVendorId, solo muestra las Bajas donde él es el origen
      // - Si es el toVendorId, solo muestra las Entregas donde él es el destino
      result = await query(
        `${baseQuery} 
        WHERE 
          CASE 
            WHEN t.desde = $1 THEN t.tipo = 'Baja'
            WHEN t.hacia = $2 THEN t.tipo = 'Entrega'
            ELSE FALSE
          END
        ORDER BY t.fecha DESC`,
        [fromVendorId, toVendorId]
      );
    } else {
      const vendorId = fromVendorId || toVendorId;
      result = await query(
        `${baseQuery} 
        WHERE 
          CASE 
            WHEN t.desde = $1 THEN t.tipo = 'Baja'
            WHEN t.hacia = $1 THEN t.tipo = 'Entrega'
            ELSE FALSE
          END
        ORDER BY t.fecha DESC`,
        [vendorId]
      );
    }


    // Transformar los resultados
    const formattedResults = result.rows.map(row => ({
      id: row.id,
      producto_id: row.producto_id,
      producto: row.producto,
      cantidad: row.cantidad,
      tipo: row.tipo,
      desde: row.desde,
      desde_nombre: row.desde_nombre,
      hacia: row.hacia,
      hacia_nombre: row.hacia_nombre,
      fecha: row.fecha,
      precio: row.precio,
      tiene_parametros: row.tiene_parametros,
      parametros: Array.isArray(row.parametros) ? row.parametros : []
    }));

    return NextResponse.json(formattedResults);

  } catch (error) {
    console.error('Error al obtener transacciones:', error);
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


