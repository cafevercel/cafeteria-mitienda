
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
      const { productoId, cantidad, fecha, parametros, id_local } = sale;

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

        // Crear venta
        const fechaVenta = new Date(fecha);
        const ventaResult = await query(
          `INSERT INTO ventas (producto, cantidad, precio_unitario, precio_compra, total, vendedor, fecha) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [
            productoId,
            cantidad,
            precioUnitario,
            precioCompra || 0,
            precioUnitario * cantidad,
            vendedorId,
            fechaVenta
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

        await query('COMMIT');
        results.push({ id_local, server_id: newVentaId, status: 'synced' });
      } catch (err: any) {
        await query('ROLLBACK');
        errors.push({ id_local, error: err.message });
      }
    }

    return NextResponse.json({ 
      success: errors.length === 0,
      synced: results,
      errors: errors 
    });

  } catch (error: any) {
    console.error('Error en bulk sync:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
