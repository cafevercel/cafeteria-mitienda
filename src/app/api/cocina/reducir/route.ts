import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const { productoId, cantidad, parametros } = await request.json();

        if (!productoId || cantidad <= 0) {
            return NextResponse.json({
                error: 'ID del producto y cantidad son requeridos'
            }, { status: 400 });
        }

        // Iniciar transacción
        await query('BEGIN');

        try {
            // 1. Obtener información del producto
            const productoResult = await query(`
                SELECT 
                    p.id,
                    p.nombre, 
                    p.precio_compra, 
                    p.tiene_parametros, 
                    up.cantidad as cantidad_inventario
                FROM productos p
                INNER JOIN usuario_productos up ON p.id = up.producto_id
                WHERE p.id = $1 AND up.cocina = true
            `, [productoId]);

            if (productoResult.rows.length === 0) {
                await query('ROLLBACK');
                return NextResponse.json({
                    error: 'Producto no encontrado en cocina'
                }, { status: 404 });
            }

            const producto = productoResult.rows[0];
            const precioCompra = Number(producto.precio_compra) || 0;
            let cantidadTotal = 0;
            let detalleConsumo = [];

            // 2. Procesar según el tipo de producto
            if (producto.tiene_parametros && parametros && parametros.length > 0) {
                // ✅ Para productos con parámetros
                for (const param of parametros) {
                    if (param.cantidad > 0) {
                        // Verificar stock disponible
                        const stockResult = await query(`
                            SELECT cantidad 
                            FROM usuario_producto_parametros 
                            WHERE producto_id = $1 AND nombre = $2
                        `, [productoId, param.nombre]);

                        if (stockResult.rows.length === 0 || stockResult.rows[0].cantidad < param.cantidad) {
                            await query('ROLLBACK');
                            return NextResponse.json({
                                error: `Stock insuficiente para ${param.nombre}. Disponible: ${stockResult.rows[0]?.cantidad || 0}, Solicitado: ${param.cantidad}`
                            }, { status: 400 });
                        }

                        // Reducir cantidad
                        const updateResult = await query(`
                            UPDATE usuario_producto_parametros 
                            SET cantidad = cantidad - $1
                            WHERE producto_id = $2 AND nombre = $3
                            RETURNING cantidad
                        `, [param.cantidad, productoId, param.nombre]);

                        cantidadTotal += param.cantidad;
                        detalleConsumo.push(`${param.nombre}: ${param.cantidad}`);
                    }
                }

                if (cantidadTotal === 0) {
                    await query('ROLLBACK');
                    return NextResponse.json({
                        error: 'No se especificaron cantidades válidas para los parámetros'
                    }, { status: 400 });
                }

            } else {
                // ✅ Para productos sin parámetros
                if (producto.cantidad_inventario < cantidad) {
                    await query('ROLLBACK');
                    return NextResponse.json({
                        error: `Stock insuficiente. Disponible: ${producto.cantidad_inventario}, Solicitado: ${cantidad}`
                    }, { status: 400 });
                }

                const updateResult = await query(`
                    UPDATE usuario_productos 
                    SET cantidad = cantidad - $1
                    WHERE producto_id = $2 AND cocina = true
                    RETURNING cantidad
                `, [cantidad, productoId]);

                if (updateResult.rows.length === 0) {
                    await query('ROLLBACK');
                    return NextResponse.json({
                        error: 'Error al actualizar el inventario'
                    }, { status: 400 });
                }

                cantidadTotal = cantidad;
                detalleConsumo.push(`Cantidad: ${cantidad}`);
            }

            // 3. Calcular y registrar el gasto
            const gastoTotal = cantidadTotal * precioCompra;
            const nombreGasto = `Consumo cocina: ${producto.nombre}${detalleConsumo.length > 0 ? ` (${detalleConsumo.join(', ')})` : ''}`;
            
            await query(`
                INSERT INTO gastos (nombre, cantidad, fecha)
                VALUES ($1, $2, CURRENT_TIMESTAMP)
            `, [nombreGasto, gastoTotal]);

            // Confirmar transacción
            await query('COMMIT');

            return NextResponse.json({
                message: 'Producto reducido y gasto registrado exitosamente',
                producto: producto.nombre,
                cantidadTotal: cantidadTotal,
                gasto: gastoTotal,
                detalle: detalleConsumo
            });

        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }

    } catch (error) {
        console.error('Error reducing cocina product:', error);
        return NextResponse.json({
            error: 'Error interno del servidor al reducir producto'
        }, { status: 500 });
    }
}
