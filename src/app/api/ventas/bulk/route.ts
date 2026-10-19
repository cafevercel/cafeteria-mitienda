
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sales, vendedorId } = body;

    if (!sales || !Array.isArray(sales) || !vendedorId) {
      return NextResponse.json({ error: 'Faltan datos requeridos (sales, vendedorId)' }, { status: 400 });
    }

    const results = [];
    const errors = [];

    for (const sale of sales) {
        const { productoId, cantidad, fecha, parametros, id_local, metodoPago, montoEfectivo, montoTransferencia } = sale;

        try {
          await query('BEGIN');

          // Verificar stock y obtener datos del producto
          const productoResult = await query(
            `SELECT p.precio, p.precio_compra, p.tiene_parametros, up.cantidad as stock_disponible 
             FROM productos p 
             JOIN usuario_productos up ON p.id = up.producto_id 
             WHERE p.id = $1 AND up.usuario_id = $2`,
            [productoId, vendedorId]
          );

          if (productoResult.rows.length === 0) {
            throw new Error('Producto no encontrado en el inventario del vendedor');
          }

          const { precio: precioUnitario, precio_compra: precioCompra, stock_disponible, tiene_parametros } = productoResult.rows[0];

          // Verificar stock
          if (tiene_parametros && parametros) {
            for (const param of parametros) {
              const stockParam = await query(
                `SELECT cantidad FROM usuario_producto_parametros 
                 WHERE producto_id = $1 AND nombre = $2 AND usuario_id = $3`,
                [productoId, param.nombre, vendedorId]
              );

              if (!stockParam.rows.length || stockParam.rows[0].cantidad < param.cantidad) {
                throw new Error(`Stock insuficiente para ${param.nombre}`);
              }
            }
          } else if (!tiene_parametros && stock_disponible < cantidad) {
            throw new Error('Stock insuficiente');
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

          // Crear venta
          const fechaVenta = new Date(fecha);
          const ventaResult = await query(
            `INSERT INTO ventas (producto, cantidad, precio_unitario, precio_compra, total, vendedor, fecha, metodo_pago, monto_efectivo, monto_transferencia) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
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
              mTransferencia
            ]
          );

        const newVentaId = ventaResult.rows[0].id;

        // Actualizar stock y guardar parámetros
        if (tiene_parametros && parametros) {
          for (const param of parametros) {
            await query(
              `INSERT INTO venta_parametros (venta_id, parametro, cantidad)
               VALUES ($1, $2, $3)`,
              [newVentaId, param.nombre, param.cantidad]
            );

            await query(
              `UPDATE usuario_producto_parametros 
               SET cantidad = cantidad - $1 
               WHERE producto_id = $2 AND nombre = $3 AND usuario_id = $4`,
              [param.cantidad, productoId, param.nombre, vendedorId]
            );
          }
        } else {
          await query(
            'UPDATE usuario_productos SET cantidad = cantidad - $1 WHERE producto_id = $2 AND usuario_id = $3',
            [cantidad, productoId, vendedorId]
          );
        }

        // Verificar si el stock del vendedor llegó a 0 para cerrar vigencia
        const checkStockFinalBulk = await query(
          'SELECT cantidad FROM usuario_productos WHERE producto_id = $1 AND usuario_id = $2',
          [productoId, vendedorId]
        );

        if (checkStockFinalBulk.rows.length === 0 || Number(checkStockFinalBulk.rows[0].cantidad) <= 0) {
          await query(
            `UPDATE vigencias_productos 
             SET fecha_fin = NOW(), estado = 'agotada' 
             WHERE usuario_id = $1 AND producto_id = $2 AND estado = 'activa'`,
            [vendedorId, productoId]
          );
        }

        await query('COMMIT');
        results.push({ id_local, server_id: newVentaId, status: 'synced' });
      } catch (err: any) {
        await query('ROLLBACK');
        errors.push({ id_local, error: err.message });
      }
    }

    const syncedTransfers = [];
    if (body.transfers && Array.isArray(body.transfers)) {
      for (const t of body.transfers) {
        try {
          const { id_local, clienteNombre, clienteTelefono, clienteCarnet, numeroTransaccion, banco, cuentaBancoId, cuentaNombre, cuentaNumero, monto, fecha, detalles, vendedorNombre } = t;
          if (!clienteNombre || !numeroTransaccion || !banco) continue;

          const existing = await query(
            'SELECT id FROM registro_transferencias WHERE numero_transaccion = $1 AND vendedor_id = $2 LIMIT 1',
            [numeroTransaccion, vendedorId ? parseInt(vendedorId, 10) : null]
          );

          if (existing.rows.length > 0) {
            syncedTransfers.push({ id_local, server_id: existing.rows[0].id, status: 'already_exists' });
            continue;
          }

          const fechaFinal = fecha ? new Date(fecha) : new Date();
          const detallesJson = typeof detalles === 'string' ? detalles : JSON.stringify(detalles || []);

          const res = await query(
            `INSERT INTO registro_transferencias 
             (vendedor_id, vendedor_nombre, cliente_nombre, cliente_telefono, cliente_carnet, numero_transaccion, banco, cuenta_banco_id, cuenta_nombre, cuenta_numero, monto, fecha, detalles) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
             RETURNING id`,
            [
              vendedorId ? parseInt(vendedorId, 10) : null,
              vendedorNombre || null,
              clienteNombre,
              clienteTelefono || '',
              clienteCarnet || null,
              numeroTransaccion,
              banco,
              cuentaBancoId ? parseInt(cuentaBancoId, 10) : null,
              cuentaNombre || null,
              cuentaNumero || null,
              parseFloat(monto) || 0,
              fechaFinal,
              detallesJson
            ]
          );
          if (res.rows.length > 0) {
            syncedTransfers.push({ id_local, server_id: res.rows[0].id, status: 'synced' });
          }
        } catch (tErr) {
          console.error('Error insertando transfer en bulk sync:', tErr);
        }
      }
    }

    return NextResponse.json({ 
      success: errors.length === 0,
      synced: results,
      synced_transfers: syncedTransfers,
      errors: errors 
    });

  } catch (error: any) {
    console.error('Error en bulk sync:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
