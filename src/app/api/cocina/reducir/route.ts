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
                SELECT p.nombre, p.precio_compra, p.tiene_parametros, up.cantidad
                FROM productos p
                INNER JOIN usuario_productos up ON p.id = up.producto_id
                WHERE up.id = $1 AND up.cocina = true
            `, [productoId]);

            if (productoResult.rows.length === 0) {
                await query('ROLLBACK');
                return NextResponse.json({
                    error: 'Producto no encontrado en cocina'
                }, { status: 404 });
            }

            const producto = productoResult.rows[0];
            const precioCompra = Number(producto.precio_compra) || 0;

            // 2. Reducir cantidad según el tipo de producto
            if (producto.tiene_parametros && parametros && parametros.length > 0) {
                // Para productos con parámetros
                for (const param of parametros) {
                    if (param.cantidad > 0) {
                        await query(`
                            UPDATE usuario_producto_parametros 
                            SET cantidad = cantidad - $1
                            WHERE producto_id = (
                                SELECT producto_id FROM usuario_productos WHERE id = $2
                            ) AND nombre = $3 AND cantidad >= $1
                        `, [param.cantidad, productoId, param.nombre]);
                    }
                }
            } else {
                // Para productos sin parámetros
                const updateResult = await query(`
                    UPDATE usuario_productos 
                    SET cantidad = cantidad - $1
                    WHERE id = $2 AND cantidad >= $1 AND cocina = true
                    RETURNING cantidad
                `, [cantidad, productoId]);

                if (updateResult.rows.length === 0) {
                    await query('ROLLBACK');
                    return NextResponse.json({
                        error: 'Stock insuficiente'
                    }, { status: 400 });
                }
            }

            // 3. Calcular y registrar el gasto
            const gastoTotal = cantidad * precioCompra;
            
            await query(`
                INSERT INTO gastos (nombre, cantidad, fecha)
                VALUES ($1, $2, CURRENT_TIMESTAMP)
            `, [
                `Consumo cocina: ${producto.nombre}`,
                gastoTotal
            ]);

            // Confirmar transacción
            await query('COMMIT');

            return NextResponse.json({
                message: 'Producto reducido y gasto registrado exitosamente',
                gasto: gastoTotal
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
