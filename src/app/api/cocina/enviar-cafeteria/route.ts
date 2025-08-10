import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { productoId, cantidad, parametros } = body;

        console.log('Enviando a cafetería:', body);

        if (!productoId || cantidad === undefined || cantidad === null) {
            return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
        }

        await query('BEGIN');

        try {
            // Obtener información del producto
            const productoResult = await query(
                'SELECT nombre, tiene_parametros FROM productos WHERE id = $1',
                [productoId]
            );

            if (productoResult.rows.length === 0) {
                throw new Error('Producto no encontrado');
            }

            const { nombre, tiene_parametros } = productoResult.rows[0];

            // Validar stock en cocina y reducir
            if (tiene_parametros && parametros && parametros.length > 0) {
                // Validar y reducir parámetros en cocina
                for (const param of parametros) {
                    const stockParam = await query(
                        'SELECT cantidad FROM cocina_parametros WHERE producto_id = $1 AND nombre = $2',
                        [productoId, param.nombre]
                    );

                    if (stockParam.rows.length === 0 || stockParam.rows[0].cantidad < param.cantidad) {
                        throw new Error(`Stock insuficiente para el parámetro ${param.nombre} en cocina`);
                    }

                    // Reducir en cocina
                    await query(
                        'UPDATE cocina_parametros SET cantidad = cantidad - $1 WHERE producto_id = $2 AND nombre = $3',
                        [param.cantidad, productoId, param.nombre]
                    );
                }
            } else {
                // Validar y reducir cantidad normal en cocina
                const stockCocina = await query(
                    'SELECT cantidad FROM cocina WHERE producto_id = $1',
                    [productoId]
                );

                if (stockCocina.rows.length === 0 || stockCocina.rows[0].cantidad < cantidad) {
                    throw new Error('Stock insuficiente en cocina');
                }

                // Reducir en cocina
                await query(
                    'UPDATE cocina SET cantidad = cantidad - $1 WHERE producto_id = $2',
                    [cantidad, productoId]
                );
            }

            // Agregar a cafetería (usuario_productos/usuario_producto_parametros)
            if (tiene_parametros && parametros && parametros.length > 0) {
                // Agregar parámetros a cafetería
                for (const param of parametros) {
                    await query(
                        `INSERT INTO usuario_producto_parametros (producto_id, nombre, cantidad) 
                         VALUES ($1, $2, $3) 
                         ON CONFLICT (producto_id, nombre) 
                         DO UPDATE SET cantidad = usuario_producto_parametros.cantidad + $3`,
                        [productoId, param.nombre, param.cantidad]
                    );
                }
            } else {
                // Agregar cantidad normal a cafetería
                // Verificar si ya existe el producto en usuario_productos
                const existingProduct = await query(
                    'SELECT cantidad FROM usuario_productos WHERE producto_id = $1 AND (cocina IS NOT TRUE OR cocina IS NULL)',
                    [productoId]
                );

                if (existingProduct.rows.length > 0) {
                    // Si existe, actualizar cantidad
                    await query(
                        'UPDATE usuario_productos SET cantidad = cantidad + $1 WHERE producto_id = $2 AND (cocina IS NOT TRUE OR cocina IS NULL)',
                        [cantidad, productoId]
                    );
                } else {
                    // Si no existe, crear nuevo registro
                    await query(
                        'INSERT INTO usuario_productos (producto_id, cantidad, precio, cocina) VALUES ($1, $2, $3, $4)',
                        [productoId, cantidad, 0, false] // precio = 0 por defecto
                    );
                }
            }

            // 🔥 REGISTRO 1: BAJA en cocina (es_cocina = TRUE) - CORREGIDO ✅
            const transactionBaja = await query(
                'INSERT INTO transacciones (producto, cantidad, tipo, desde, hacia, fecha, es_cocina) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
                [productoId, cantidad, 'Baja', 'Cocina', 'Cafeteria', new Date(), true]
                //                                  ↑        ↑
                //                               desde    hacia
                //                          CORREGIDO: Cocina → Cafeteria ✅
            );

            const transaccionBajaId = transactionBaja.rows[0].id;

            // 🔥 REGISTRO 2: ENTREGA a cafetería (es_cocina = FALSE)
            const transactionEntrega = await query(
                'INSERT INTO transacciones (producto, cantidad, tipo, desde, hacia, fecha, es_cocina) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
                [productoId, cantidad, 'Entrega', 'Cocina', 'Cafeteria', new Date(), false]
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
                message: `Se enviaron ${cantidad} unidades de ${nombre} a cafetería`,
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
        console.error('Error al enviar producto a cafetería:', error);
        if (error instanceof Error) {
            return NextResponse.json({
                error: 'Error al enviar producto a cafetería',
                details: error.message
            }, { status: 500 });
        } else {
            return NextResponse.json({
                error: 'Error desconocido al enviar producto a cafetería'
            }, { status: 500 });
        }
    }
}
