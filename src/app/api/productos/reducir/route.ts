import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { productoId, cantidad, parametros } = body;
        const vendedorId = body.vendedorId || null; // Hacemos el vendedorId opcional, solo para tracking

        if (!productoId) {
            return NextResponse.json({ error: 'Falta el ID del producto' }, { status: 400 });
        }

        await query('BEGIN');

        try {
            // Verificar si el producto tiene parámetros
            const productoResult = await query(
                'SELECT tiene_parametros FROM productos WHERE id = $1',
                [productoId]
            );

            const tieneParametros = productoResult.rows[0]?.tiene_parametros;

            if (tieneParametros) {
                // Validar que se enviaron parámetros
                if (!parametros || parametros.length === 0) {
                    throw new Error('Este producto requiere especificar parámetros');
                }

                // Verificar y actualizar cada parámetro
                for (const param of parametros) {
                    const paramResult = await query(
                        'SELECT cantidad FROM usuario_producto_parametros WHERE producto_id = $1 AND nombre = $2',
                        [productoId, param.nombre]
                    );

                    if (paramResult.rows.length === 0 || paramResult.rows[0].cantidad < param.cantidad) {
                        throw new Error(`Cantidad insuficiente para el parámetro ${param.nombre}`);
                    }

                    // Actualizar cantidad del parámetro en usuario_producto_parametros
                    await query(
                        'UPDATE usuario_producto_parametros SET cantidad = cantidad - $1 WHERE producto_id = $2 AND nombre = $3',
                        [param.cantidad, productoId, param.nombre]
                    );

                    // Actualizar cantidad en producto_parametros (almacén)
                    await query(
                        'UPDATE producto_parametros SET cantidad = cantidad + $1 WHERE producto_id = $2 AND nombre = $3',
                        [param.cantidad, productoId, param.nombre]
                    );
                }

                // Registrar transacción principal
                const transaccionResult = await query(
                    'INSERT INTO transacciones (producto, cantidad, tipo, desde, hacia, fecha, parametro_nombre) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
                    [productoId, parametros[0].cantidad, 'Baja', vendedorId, null, new Date(), null]
                );

                const transaccionId = transaccionResult.rows[0].id;

                // Registrar parámetros en transaccion_parametros
                for (const param of parametros) {
                    await query(
                        'INSERT INTO transaccion_parametros (transaccion_id, nombre, cantidad) VALUES ($1, $2, $3)',
                        [transaccionId, param.nombre, param.cantidad]
                    );
                }

            } else {
                // Lógica para productos sin parámetros
                if (!cantidad) {
                    throw new Error('Cantidad requerida para productos sin parámetros');
                }

                const usuarioProductoResult = await query(
                    'SELECT cantidad FROM usuario_productos WHERE producto_id = $1',
                    [productoId]
                );

                if (usuarioProductoResult.rows.length === 0) {
                    throw new Error('Este producto no existe en el inventario');
                }

                if (cantidad > usuarioProductoResult.rows[0].cantidad) {
                    throw new Error('La cantidad a reducir es mayor que la cantidad disponible');
                }

                // Actualizar cantidad principal 
                await query(
                    'UPDATE usuario_productos SET cantidad = cantidad - $1 WHERE producto_id = $2',
                    [cantidad, productoId]
                );

                // Actualizar cantidad en almacén
                await query(
                    'UPDATE productos SET cantidad = cantidad + $1 WHERE id = $2',
                    [cantidad, productoId]
                );

                // Registrar transacción
                await query(
                    'INSERT INTO transacciones (producto, cantidad, tipo, desde, hacia, fecha) VALUES ($1, $2, $3, $4, $5, $6)',
                    [productoId, cantidad, 'Baja', vendedorId, null, new Date()]
                );
            }

            await query('COMMIT');

            // Obtener datos actualizados
            const updatedData = await query(`
                SELECT 
                    up.producto_id as id,
                    p.nombre,
                    p.precio,
                    up.cantidad,
                    p.foto,
                    p.tiene_parametros,
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'nombre', upp.nombre,
                                'cantidad', upp.cantidad
                            )
                        ) FILTER (WHERE upp.id IS NOT NULL),
                        '[]'::json
                    ) as parametros
                FROM usuario_productos up
                JOIN productos p ON up.producto_id = p.id
                LEFT JOIN usuario_producto_parametros upp ON up.producto_id = upp.producto_id
                WHERE up.producto_id = $1
                GROUP BY up.producto_id, p.nombre, p.precio, up.cantidad, p.foto, p.tiene_parametros
            `, [productoId]);

            return NextResponse.json(updatedData.rows[0]);
        } catch (error) {
            await query('ROLLBACK');
            console.error('Error en la transacción:', error);
            return NextResponse.json({ 
                error: 'Error al procesar la reducción', 
                details: (error as Error).message 
            }, { status: 400 });
        }
    } catch (error) {
        console.error('Error en la ruta de reducción:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
