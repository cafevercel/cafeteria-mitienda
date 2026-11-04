// app/api/ventas/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { 
    productoId, cantidad, fecha, parametros, vendedorId, metodoPago, montoEfectivo, montoTransferencia,
    clienteNombre, cliente_nombre,
    clienteCarnet, cliente_carnet,
    clienteTelefono, cliente_telefono,
    numeroTransaccion, numero_transaccion,
    banco,
    cuentaBancoId, cuenta_banco_id,
    cuentaNombre, cuenta_nombre,
    cuentaNumero, cuenta_numero
  } = body;

  if (!productoId || !cantidad || !fecha || !vendedorId) {
    return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
  }

  try {
    const fechaVenta = new Date(fecha);
    await query('BEGIN');

    // Verificar si el producto tiene parámetros y obtener stock del vendedor
    const productoResult = await query(
      `SELECT p.precio, p.precio_compra, p.tiene_parametros, up.cantidad as stock_disponible 
       FROM productos p 
       JOIN usuario_productos up ON p.id = up.producto_id 
       WHERE p.id = $1 AND up.usuario_id = $2`,
      [productoId, vendedorId]
    );

    if (productoResult.rows.length === 0) {
      // Intentar ver si el producto existe pero no en el inventario del usuario
      const productoExiste = await query('SELECT id FROM productos WHERE id = $1', [productoId]);
      if (productoExiste.rows.length > 0) {
        await query('ROLLBACK');
        return NextResponse.json({ error: 'Producto no encontrado en el inventario del vendedor' }, { status: 404 });
      }
      await query('ROLLBACK');
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    const { precio: precioUnitario, precio_compra: precioCompra, stock_disponible, tiene_parametros } = productoResult.rows[0];

    // Verificar stock según si tiene parámetros o no
    if (tiene_parametros && parametros) {
      for (const param of parametros) {
        const stockParam = await query(
          `SELECT cantidad FROM usuario_producto_parametros 
           WHERE producto_id = $1 AND nombre = $2 AND usuario_id = $3`,
          [productoId, param.nombre, vendedorId]
        );

        if (!stockParam.rows.length || stockParam.rows[0].cantidad < param.cantidad) {
          await query('ROLLBACK');
          return NextResponse.json({
            error: `Stock insuficiente para el parámetro ${param.nombre}`
          }, { status: 400 });
        }
      }
    } else if (!tiene_parametros && stock_disponible < cantidad) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'Stock insuficiente' }, { status: 400 });
    }

    // Determinar desgloses por método de pago
    const totalVenta = precioUnitario * cantidad;
    const mPago = metodoPago || 'efectivo';
    let mEfectivo = totalVenta;
    let mTransferencia = 0;

    if (mPago === 'transferencia') {
      mEfectivo = 0;
      mTransferencia = totalVenta;
    } else if (mPago === 'mixto') {
      mEfectivo = parseFloat(montoEfectivo) || 0;
      mTransferencia = parseFloat(montoTransferencia) || 0;
    }

    const cNombre = clienteNombre || cliente_nombre || null;
    const cCarnet = clienteCarnet || cliente_carnet || null;
    const cTelefono = clienteTelefono || cliente_telefono || null;
    const nTransaccion = numeroTransaccion || numero_transaccion || null;
    const bco = banco || null;
    const rawCuentaId = cuentaBancoId !== undefined ? cuentaBancoId : cuenta_banco_id;
    const cBancoId = rawCuentaId ? parseInt(rawCuentaId, 10) : null;
    const cNombreCuenta = cuentaNombre || cuenta_nombre || null;
    const cNumeroCuenta = cuentaNumero || cuenta_numero || null;

    // Buscar si existe registro de transferencia previo para asociar transferencia_id
    let transId = body.transferenciaId || body.transferencia_id || null;
    if (!transId && nTransaccion) {
      const exTrans = await query(
        'SELECT id FROM registro_transferencias WHERE numero_transaccion = $1 AND vendedor_id = $2 LIMIT 1',
        [nTransaccion, vendedorId ? parseInt(vendedorId, 10) : null]
      );
      if (exTrans.rows.length > 0) {
        transId = exTrans.rows[0].id;
      }
    }

    // Crear venta
    const ventaResult = await query(
      `INSERT INTO ventas (
         producto, cantidad, precio_unitario, precio_compra, total, vendedor, fecha, 
         metodo_pago, monto_efectivo, monto_transferencia,
         cliente_nombre, cliente_carnet, cliente_telefono, numero_transaccion, banco, 
         cuenta_banco_id, cuenta_nombre, cuenta_numero, transferencia_id
       ) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING *`,
      [
        productoId,
        cantidad,
        precioUnitario,
        precioCompra || 0,
        totalVenta,
        vendedorId,
        fechaVenta,
        mPago,
        mEfectivo,
        mTransferencia,
        cNombre,
        cCarnet,
        cTelefono,
        nTransaccion,
        bco,
        cBancoId,
        cNombreCuenta,
        cNumeroCuenta,
        transId
      ]
    );

    // Manejar actualizaciones según el tipo de producto
    if (tiene_parametros && parametros) {
      for (const param of parametros) {
        // Insertar parámetros de la venta
        await query(
          `INSERT INTO venta_parametros (venta_id, parametro, cantidad)
           VALUES ($1, $2, $3)`,
          [ventaResult.rows[0].id, param.nombre, param.cantidad]
        );

        // Actualizar parámetros (filtrando por usuario_id)
        await query(
          `UPDATE usuario_producto_parametros 
           SET cantidad = cantidad - $1 
           WHERE producto_id = $2 AND nombre = $3 AND usuario_id = $4`,
          [param.cantidad, productoId, param.nombre, vendedorId]
        );
        // El trigger actualiza usuario_productos.cantidad, pero DEBE manejar usuario_id?
        // Los triggers en usuario_producto_parametros actualizan usuario_productos.
        // Si el trigger no tiene en cuenta usuario_id, podría romper cosas.
        // Asumiendo que el trigger usa (usuario_id, producto_id) para hacer join/update.
      }

    } else {
      // Para productos SIN parámetros
      await query(
        'UPDATE usuario_productos SET cantidad = cantidad - $1 WHERE producto_id = $2 AND usuario_id = $3',
        [cantidad, productoId, vendedorId]
      );
    }

    // Verificar si el stock del vendedor llegó a 0 para cerrar vigencia
    const checkStockFinal = await query(
      'SELECT cantidad FROM usuario_productos WHERE producto_id = $1 AND usuario_id = $2',
      [productoId, vendedorId]
    );

    if (checkStockFinal.rows.length === 0 || Number(checkStockFinal.rows[0].cantidad) <= 0) {
      await query(
        `UPDATE vigencias_productos 
         SET fecha_fin = NOW(), estado = 'agotada' 
         WHERE usuario_id = $1 AND producto_id = $2 AND estado = 'activa'`,
        [vendedorId, productoId]
      );
    }

    await query('COMMIT');

    // Crear respuesta con encabezados anti-caché
    const response = NextResponse.json(ventaResult.rows[0]);
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');

    return response;
  } catch (error) {
    await query('ROLLBACK');
    console.error('Error al crear venta:', error);
    return NextResponse.json({ error: 'Error al crear venta' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const vendedorId = searchParams.get('vendedorId');
  const productoId = searchParams.get('productoId');
  const ventaId = searchParams.get('id');
  const getAllVentas = searchParams.get('all') === 'true';

  const startDate = searchParams.get('startDate') || searchParams.get('fechaInicio');
  const endDate = searchParams.get('endDate') || searchParams.get('fechaFin');

  try {
    let result;

    if (ventaId) {
      // Obtener venta con sus parámetros
      result = await query(
        `SELECT v.*, p.nombre as producto_nombre, p.foto as producto_foto, 
                v.precio_unitario,
                json_agg(json_build_object(
                  'nombre', vp.parametro,
                  'cantidad', vp.cantidad
                )) FILTER (WHERE vp.parametro IS NOT NULL) as parametros
         FROM ventas v
         JOIN productos p ON v.producto = p.id
         LEFT JOIN venta_parametros vp ON v.id = vp.venta_id
         WHERE v.id = $1
         GROUP BY v.id, p.nombre, p.foto`,
        [ventaId]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });
      }

      const response = NextResponse.json(result.rows[0]);
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      response.headers.set('Surrogate-Control', 'no-store');

      return response;
    }

    // Consultas para listar ventas
    const baseQuery = `
      SELECT v.*, p.nombre as producto_nombre, p.foto as producto_foto, 
             v.precio_unitario,
             u.nombre as vendedor_nombre,
             json_agg(json_build_object(
               'nombre', vp.parametro,
               'cantidad', vp.cantidad
             )) FILTER (WHERE vp.parametro IS NOT NULL) as parametros
      FROM ventas v
      JOIN productos p ON v.producto = p.id
      JOIN usuarios u ON v.vendedor = u.id
      LEFT JOIN venta_parametros vp ON v.id = vp.venta_id
    `;

    const whereClauses: string[] = [];
    const params: any[] = [];

    if (productoId) {
      params.push(productoId);
      whereClauses.push(`v.producto = $${params.length}`);
      if (vendedorId) {
        params.push(vendedorId);
        whereClauses.push(`v.vendedor = $${params.length}`);
      }
    } else if (vendedorId) {
      params.push(vendedorId);
      whereClauses.push(`v.vendedor = $${params.length}`);
    } else if (!getAllVentas) {
      return NextResponse.json({ error: 'Se requiere vendedorId, productoId, id o all=true' }, { status: 400 });
    }

    if (startDate) {
      params.push(startDate);
      whereClauses.push(`v.fecha >= $${params.length}`);
    }

    if (endDate) {
      const endFormatted = endDate.includes(' ') || endDate.includes('T') ? endDate : `${endDate} 23:59:59`;
      params.push(endFormatted);
      whereClauses.push(`v.fecha <= $${params.length}`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    result = await query(
      `${baseQuery}
       ${whereSql}
       GROUP BY v.id, p.nombre, p.foto, u.nombre
       ORDER BY v.fecha DESC`,
      params
    );

    // Crear respuesta con encabezados anti-caché
    const response = NextResponse.json(result.rows);
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');

    return response;
  } catch (error) {
    console.error('Error al obtener ventas:', error);
    return NextResponse.json({ error: 'Error al obtener ventas' }, { status: 500 });
  }
}