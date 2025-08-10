import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { productoId, cantidad, parametros } = body;

        console.log('Enviando a almacén:', body);

        if (!productoId || cantidad === undefined || cantidad === null) {
            return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
        }

        await query('BEGIN');

        try {
            // Obtener información del producto
            const productoResult = await query(
                'SELECT nombre, tiene_parametros, precio FROM productos WHERE id = $1',
                [productoId]
            );

            if (productoResult.rows.length === 0) {
                throw new Error('Producto no encontrado');
            }

            const { nombre, tiene_parametros, precio } = productoResult.rows[0];

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

            // Devolver al almacén (inventario principal)
            if (tiene_parametros && parametros && parametros.length > 0) {
                // Devolver parámetros al almacén
                for (const param of parametros) {
                    await query(
                        `INSERT INTO producto_parametros (producto_id, nombre, cantidad) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (producto_id, nombre) 
             DO UPDATE SET cantidad = producto_parametros.cantidad + $3`,
                        [productoId, param.nombre, param.cantidad]
                    );
                }
            } else {
                // Devolver cantidad normal al almacén
                await query(
                    'UPDATE productos SET cantidad = cantidad + $1 WHERE id = $2',
                    [cantidad, productoId]
                );
            }

            // Registrar transacción de tipo "Baja" (devolución)
            const transactionResult = await query(
                'INSERT INTO transacciones (producto, cantidad, tipo, desde, hacia, fecha) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
                [productoId, cantidad, 'Baja', 'Cocina', 'Almacen', new Date()]
            );

            const transaccionId = transactionResult.rows[0].id;

            // Registrar parámetros de la transacción si los hay
            if (tiene_parametros && parametros && parametros.length > 0) {
                for (const param of parametros) {
                    await query(
                        `INSERT INTO transaccion_parametros (transaccion_id, nombre, cantidad) 
             VALUES ($1, $2, $3)`,
                        [transaccionId, param.nombre, param.cantidad]
                    );
                }
            }

            // Registrar como gasto en cocina
            await query(
                'INSERT INTO gastos (nombre, cantidad, fecha) VALUES ($1, $2, $3)',
                [`Devolución ${nombre} a Almacén`, cantidad, new Date()]
            );

            await query('COMMIT');

            return NextResponse.json({
                message: `Se enviaron ${cantidad} unidades de ${nombre} de vuelta al almacén`,
                transaction: transactionResult.rows[0]
            });

        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Error al enviar producto a almacén:', error);
        if (error instanceof Error) {
            return NextResponse.json({
                error: 'Error al enviar producto a almacén',
                details: error.message
            }, { status: 500 });
        } else {
            return NextResponse.json({
                error: 'Error desconocido al enviar producto a almacén'
            }, { status: 500 });
        }
    }
}
