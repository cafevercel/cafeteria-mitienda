import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { productoId, cantidad, parametros } = body;

        console.log('Enviando de cafetería a cocina:', body);

        if (!productoId || cantidad === undefined || cantidad === null) {
            return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
        }

        await query('BEGIN');

        try {
            // Obtener información completa del producto incluyendo el precio
            const productoResult = await query(
                'SELECT nombre, precio, tiene_parametros FROM productos WHERE id = $1',
                [productoId]
            );

            if (productoResult.rows.length === 0) {
                throw new Error('Producto no encontrado');
            }

            const { nombre, precio, tiene_parametros } = productoResult.rows[0];

            // Validar stock en cafetería y reducir
            if (tiene_parametros && parametros && parametros.length > 0) {
                // Validar y reducir parámetros en cafetería
                for (const param of parametros) {
                    const stockParam = await query(
                        'SELECT cantidad FROM usuario_producto_parametros WHERE producto_id = $1 AND nombre = $2',
                        [productoId, param.nombre]
                    );

                    if (stockParam.rows.length === 0 || stockParam.rows[0].cantidad < param.cantidad) {
                        throw new Error(`Stock insuficiente para el parámetro ${param.nombre} en cafetería`);
                    }

                    // Reducir en cafetería
                    await query(
                        'UPDATE usuario_producto_parametros SET cantidad = cantidad - $1 WHERE producto_id = $2 AND nombre = $3',
                        [param.cantidad, productoId, param.nombre]
                    );
                }
            } else {
                // Validar y reducir cantidad normal en cafetería
                const stockCafeteria = await query(
                    'SELECT cantidad FROM usuario_productos WHERE producto_id = $1 AND (cocina IS NOT TRUE OR cocina IS NULL)',
                    [productoId]
                );

                if (stockCafeteria.rows.length === 0 || stockCafeteria.rows[0].cantidad < cantidad) {
                    throw new Error('Stock insuficiente en cafetería');
                }

                // Reducir en cafetería
                await query(
                    'UPDATE usuario_productos SET cantidad = cantidad - $1 WHERE producto_id = $2 AND (cocina IS NOT TRUE OR cocina IS NULL)',
                    [cantidad, productoId]
                );
            }

            // Agregar a cocina CON PRECIO Y CAMPO COCINA
            if (tiene_parametros && parametros && parametros.length > 0) {
                // Agregar parámetros a cocina
                for (const param of parametros) {
                    await query(
                        `INSERT INTO cocina_parametros (producto_id, nombre, cantidad) 
                         VALUES ($1, $2, $3) 
                         ON CONFLICT (producto_id, nombre) 
                         DO UPDATE SET cantidad = cocina_parametros.cantidad + $3`,
                        [productoId, param.nombre, param.cantidad]
                    );
                }
            } else {
                // Agregar cantidad normal a cocina CON TODOS LOS CAMPOS OBLIGATORIOS
                await query(
                    `INSERT INTO cocina (producto_id, cantidad, precio, cocina) 
                     VALUES ($1, $2, $3, $4) 
                     ON CONFLICT (producto_id) 
                     DO UPDATE SET cantidad = cocina.cantidad + $2`,
                    [productoId, cantidad, precio, true]
                );
            }

            // 🔥 REGISTRO 1: BAJA en cafetería (es_cocina = FALSE) - CORREGIDO ✅
            const transactionBaja = await query(
                'INSERT INTO transacciones (producto, cantidad, tipo, desde, hacia, fecha, es_cocina) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
                [productoId, cantidad, 'Baja', 'Cafeteria', 'Cocina', new Date(), false]
                //                                    ↑         ↑
                //                                 desde     hacia
                //                            CORREGIDO: Cafeteria → Cocina ✅
            );

            const transaccionBajaId = transactionBaja.rows[0].id;

            // 🔥 REGISTRO 2: ENTREGA a cocina (es_cocina = TRUE)
            const transactionEntrega = await query(
                'INSERT INTO transacciones (producto, cantidad, tipo, desde, hacia, fecha, es_cocina) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
                [productoId, cantidad, 'Entrega', 'Cafeteria', 'Cocina', new Date(), true]
            );

            const transaccionEntregaId = transactionEntrega.rows[0].id;

            // Registrar parámetros para AMBAS transacciones si los hay
            if (tiene_parametros && parametros && parametros.length > 0) {
                for (const param of parametros) {
                    // Parámetros para transacción de BAJA
                    await query(
                        `INSERT INTO transaccion_parametros (transaccion_id, nombre, cantidad) 
                         VALUES ($1, $2, $3)`,
                        [transaccionBajaId, param.nombre, param.cantidad]
                    );

                    // Parámetros para transacción de ENTREGA
                    await query(
                        `INSERT INTO transaccion_parametros (transaccion_id, nombre, cantidad) 
                         VALUES ($1, $2, $3)`,
                        [transaccionEntregaId, param.nombre, param.cantidad]
                    );
                }
            }

            await query('COMMIT');

            return NextResponse.json({
                message: `Se enviaron ${cantidad} unidades de ${nombre} de cafetería a cocina`,
                transactions: {
                    baja: transactionBaja.rows[0],
                    entrega: transactionEntrega.rows[0]
                }
            });

        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Error al enviar producto a cocina:', error);
        if (error instanceof Error) {
            return NextResponse.json({
                error: 'Error al enviar producto a cocina',
                details: error.message
            }, { status: 500 });
        } else {
            return NextResponse.json({
                error: 'Error desconocido al enviar producto a cocina'
            }, { status: 500 });
        }
    }
}
