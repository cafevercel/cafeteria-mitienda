import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { put } from '@vercel/blob';

// Definir interfaces para mejorar el tipado
interface Parametro {
    nombre: string;
    cantidad: number;
}

interface ParametroAntiguo {
    nombre: string;
}

interface ParametroVendedor {
    nombre: string;
    cantidad: number;
}

const obtenerProductoConParametros = async (productoId: string) => {
    const result = await query(`
        SELECT 
            p.id,
            p.nombre,
            p.precio,
            p.cantidad,
            p.foto,
            p.tiene_parametros,
            p.precio_compra,
            p.porcentaje_ganancia as "porcentajeGanancia",
            COALESCE(
                json_agg(
                    json_build_object(
                        'nombre', pp.nombre,
                        'cantidad', pp.cantidad
                    )
                ) FILTER (WHERE pp.id IS NOT NULL),
                '[]'::json
            ) as parametros
        FROM productos p
        LEFT JOIN producto_parametros pp ON p.id = pp.producto_id
        WHERE p.id = $1
        GROUP BY p.id
    `, [productoId]);

    return result.rows[0];
};

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const { id } = params;
        const formData = await request.formData();

        const nombre = formData.get('nombre') as string;
        const precio = formData.get('precio') as string;
        const cantidad = formData.get('cantidad') as string;
        const fotoUrl = formData.get('fotoUrl') as string | null;
        const tieneParametros = formData.get('tiene_parametros') === 'true';
        const parametrosRaw = formData.get('parametros') as string;
        const parametros: Parametro[] = parametrosRaw ? JSON.parse(parametrosRaw) : [];
        const precioCompra = formData.get('precio_compra') as string;
        const porcentajeGanancia = formData.get('porcentajeGanancia') as string;

        const currentProduct = await query('SELECT * FROM productos WHERE id = $1', [id]);

        if (currentProduct.rows.length === 0) {
            return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
        }

        // Solo actualizar la foto si se proporciona una nueva
        const nuevaFotoUrl = fotoUrl ? fotoUrl : currentProduct.rows[0].foto;

        await query('BEGIN');

        try {
            // 1. Actualizar producto principal
            let updateQuery: string;
            let updateParams: any[];

            if (tieneParametros) {
                // ✅ Para productos CON parámetros: NO actualizar cantidad
                updateQuery = 'UPDATE productos SET nombre = $1, precio = $2, foto = $3, tiene_parametros = $4, precio_compra = $5, porcentaje_ganancia = $6 WHERE id = $7 RETURNING *';
                updateParams = [
                    nombre,
                    Number(precio),
                    nuevaFotoUrl,
                    tieneParametros,
                    precioCompra ? Number(precioCompra) : currentProduct.rows[0].precio_compra || 0,
                    porcentajeGanancia ? Number(porcentajeGanancia) : currentProduct.rows[0].porcentaje_ganancia || 0,
                    id
                ];
            } else {
                // ✅ Para productos SIN parámetros: SÍ actualizar cantidad
                updateQuery = 'UPDATE productos SET nombre = $1, precio = $2, cantidad = $3, foto = $4, tiene_parametros = $5, precio_compra = $6, porcentaje_ganancia = $7 WHERE id = $8 RETURNING *';
                updateParams = [
                    nombre,
                    Number(precio),
                    Number(cantidad),
                    nuevaFotoUrl,
                    tieneParametros,
                    precioCompra ? Number(precioCompra) : currentProduct.rows[0].precio_compra || 0,
                    porcentajeGanancia ? Number(porcentajeGanancia) : currentProduct.rows[0].porcentaje_ganancia || 0,
                    id
                ];
            }

            const result = await query(updateQuery, updateParams);

            // 2. Obtener los parámetros antiguos del producto principal para mapeo
            const parametrosAntiguosResult = await query(
                'SELECT nombre FROM producto_parametros WHERE producto_id = $1',
                [id]
            );

            // Convertir explícitamente los resultados al tipo deseado
            const parametrosAntiguos: ParametroAntiguo[] = parametrosAntiguosResult.rows.map(row => ({
                nombre: row.nombre as string
            }));

            // Crear un mapa para relacionar índices de parámetros antiguos con nuevos
            const mapeoParametros: Record<string, string> = {};
            if (parametrosAntiguos.length > 0 && parametros.length > 0) {
                // Mapear por posición si tienen la misma longitud
                if (parametrosAntiguos.length === parametros.length) {
                    for (let i = 0; i < parametrosAntiguos.length; i++) {
                        mapeoParametros[parametrosAntiguos[i].nombre] = parametros[i].nombre;
                    }
                }
            }

            // 3. Eliminar parámetros antiguos del producto principal
            await query('DELETE FROM producto_parametros WHERE producto_id = $1', [id]);

            // 4. Insertar nuevos parámetros para el producto principal
            if (tieneParametros && parametros.length > 0) {
                for (const param of parametros) {
                    await query(
                        'INSERT INTO producto_parametros (producto_id, nombre, cantidad) VALUES ($1, $2, $3)',
                        [id, param.nombre, param.cantidad]
                    );
                }
            }

            // 5. Actualizar nombres en transaccion_parametros si hay mapeo de parámetros
            if (Object.keys(mapeoParametros).length > 0) {
                for (const nombreAntiguo in mapeoParametros) {
                    const nombreNuevo = mapeoParametros[nombreAntiguo];
                    await query(`
                        UPDATE transaccion_parametros 
                        SET nombre = $1 
                        WHERE nombre = $2 
                        AND transaccion_id IN (
                            SELECT id FROM transacciones 
                            WHERE producto = $3
                        )`,
                        [nombreNuevo, nombreAntiguo, id]
                    );
                }
            }

            // 6. Actualizar nombres de parámetros en usuario_producto_parametros (SOLO NOMBRES, NO CANTIDADES)
            if (Object.keys(mapeoParametros).length > 0) {
                for (const nombreAntiguo in mapeoParametros) {
                    const nombreNuevo = mapeoParametros[nombreAntiguo];
                    await query(`
                        UPDATE usuario_producto_parametros 
                        SET nombre = $1 
                        WHERE nombre = $2 AND producto_id = $3`,
                        [nombreNuevo, nombreAntiguo, id]
                    );
                }
            }

            // 7. Si se eliminaron parámetros del producto principal, eliminar también de vendedores
            if (tieneParametros && parametros.length > 0) {
                // Obtener nombres de parámetros actuales
                const nombresParametrosActuales = parametros.map(p => p.nombre);

                // Eliminar parámetros de vendedores que ya no existen en el producto principal
                await query(`
                    DELETE FROM usuario_producto_parametros 
                    WHERE producto_id = $1 
                    AND nombre NOT IN (${nombresParametrosActuales.map((_, i) => `$${i + 2}`).join(', ')})`,
                    [id, ...nombresParametrosActuales]
                );
            } else if (!tieneParametros) {
                // Si el producto ya no tiene parámetros, eliminar todos los parámetros de vendedores
                await query(
                    'DELETE FROM usuario_producto_parametros WHERE producto_id = $1',
                    [id]
                );
            }

            await query('COMMIT');

            const productoActualizado = await obtenerProductoConParametros(id);
            return NextResponse.json(productoActualizado);
        } catch (error) {
            await query('ROLLBACK');
            console.error('Error en la transacción:', error);
            throw error;
        }
    } catch (error) {
        console.error('Error updating product:', error);
        return NextResponse.json({
            error: 'Error interno del servidor',
            details: (error as Error).message
        }, { status: 500 });
    }
}

// ... resto del código (DELETE y GET permanecen igual)


export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const { id } = params;

        await query('BEGIN');

        try {
            // 1. Verificar si el producto existe
            const producto = await query(
                'SELECT * FROM productos WHERE id = $1',
                [id]
            );

            if (producto.rows.length === 0) {
                await query('ROLLBACK');
                return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
            }

            // 2. Eliminar merma_parametros primero
            await query(
                'DELETE FROM merma_parametros WHERE merma_id IN (SELECT id FROM merma WHERE producto_id = $1)',
                [id]
            );

            // 3. Eliminar registros de merma
            await query(
                'DELETE FROM merma WHERE producto_id = $1',
                [id]
            );

            // 4. Eliminar parámetros de producto para vendedores
            await query(
                'DELETE FROM usuario_producto_parametros WHERE producto_id = $1',
                [id]
            );

            // 5. Eliminar producto de vendedores
            await query(
                'DELETE FROM usuario_productos WHERE producto_id = $1',
                [id]
            );

            // 6. Eliminar parámetros de producto principal
            await query(
                'DELETE FROM producto_parametros WHERE producto_id = $1',
                [id]
            );

            // 7. Eliminar parámetros en transacciones
            await query(
                'DELETE FROM transaccion_parametros WHERE transaccion_id IN (SELECT id FROM transacciones WHERE producto = $1)',
                [id]
            );

            // 8. Eliminar transacciones
            await query(
                'DELETE FROM transacciones WHERE producto = $1',
                [id]
            );

            // 9. Eliminar venta_parametros antes de eliminar ventas
            await query(
                'DELETE FROM venta_parametros WHERE venta_id IN (SELECT id FROM ventas WHERE producto = $1)',
                [id]
            );

            // 10. Eliminar registros de ventas relacionados con este producto
            await query(
                'DELETE FROM ventas WHERE producto = $1',
                [id]
            );

            // 11. Eliminar el producto
            await query(
                'DELETE FROM productos WHERE id = $1',
                [id]
            );

            await query('COMMIT');

            return NextResponse.json({ message: 'Producto eliminado correctamente' });
        } catch (error) {
            await query('ROLLBACK');
            console.error('Error al eliminar producto:', error);
            throw error;
        }
    } catch (error) {
        console.error('Error al eliminar producto:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}


export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const { id } = params;

        const producto = await obtenerProductoConParametros(id);

        if (!producto) {
            return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
        }

        return NextResponse.json(producto);
    } catch (error) {
        console.error('Error al obtener producto:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}