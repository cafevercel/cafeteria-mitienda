//productos/[id]/route.ts
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

// Nueva interface para agregos
interface Agrego {
    id?: number;
    nombre: string;
    precio: number;
}

// Nueva interface para costos
interface Costo {
    id?: number;
    nombre: string;
    precio: number;
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
            p.tiene_agrego,
            p.tiene_costo,
            p.precio_compra,
            p.porcentaje_ganancia as "porcentajeGanancia",
            p.seccion,
            -- ✅ SUBCONSULTA SEPARADA para parámetros
            (
                SELECT COALESCE(
                    json_agg(
                        json_build_object(
                            'nombre', pp.nombre,
                            'cantidad', pp.cantidad
                        )
                    ),
                    '[]'::json
                )
                FROM producto_parametros pp
                WHERE pp.producto_id = p.id
            ) as parametros,
            -- ✅ SUBCONSULTA SEPARADA para agregos
            (
                SELECT COALESCE(
                    json_agg(
                        json_build_object(
                            'id', a.id,
                            'nombre', a.nombre,
                            'precio', a.precio
                        )
                    ),
                    '[]'::json
                )
                FROM agregos a
                WHERE a.producto_id = p.id
            ) as agregos,
            -- ✅ SUBCONSULTA SEPARADA para costos
            (
                SELECT COALESCE(
                    json_agg(
                        json_build_object(
                            'id', c.id,
                            'nombre', c.nombre,
                            'precio', c.precio
                        )
                    ),
                    '[]'::json
                )
                FROM costos c
                WHERE c.producto_id = p.id
            ) as costos
        FROM productos p
        WHERE p.id = $1
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
        const seccion = formData.get('seccion') as string;

        // EXISTENTE: Manejar agregos
        const tieneAgrego = formData.get('tiene_agrego') === 'true';
        const agregosRaw = formData.get('agregos') as string;
        const agregos: Agrego[] = agregosRaw ? JSON.parse(agregosRaw) : [];

        // NUEVO: Manejar costos
        const tieneCosto = formData.get('tiene_costo') === 'true';
        const costosRaw = formData.get('costos') as string;
        const costos: Costo[] = costosRaw ? JSON.parse(costosRaw) : [];

        const currentProduct = await query('SELECT * FROM productos WHERE id = $1', [id]);

        if (currentProduct.rows.length === 0) {
            return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
        }

        // Solo actualizar la foto si se proporciona una nueva
        const nuevaFotoUrl = fotoUrl ? fotoUrl : currentProduct.rows[0].foto;

        await query('BEGIN');

        try {
            // 1. Actualizar producto principal (AGREGAR tiene_costo)
            let updateQuery: string;
            let updateParams: any[];

            if (tieneParametros) {
                updateQuery = 'UPDATE productos SET nombre = $1, precio = $2, foto = $3, tiene_parametros = $4, tiene_agrego = $5, tiene_costo = $6, precio_compra = $7, porcentaje_ganancia = $8, seccion = $9 WHERE id = $10 RETURNING *';
                updateParams = [
                    nombre,
                    Number(precio),
                    nuevaFotoUrl,
                    tieneParametros,
                    tieneAgrego,
                    tieneCosto, // NUEVO
                    precioCompra ? Number(precioCompra) : currentProduct.rows[0].precio_compra || 0,
                    porcentajeGanancia ? Number(porcentajeGanancia) : currentProduct.rows[0].porcentaje_ganancia || 0,
                    seccion || '',
                    id
                ];
            } else {
                updateQuery = 'UPDATE productos SET nombre = $1, precio = $2, cantidad = $3, foto = $4, tiene_parametros = $5, tiene_agrego = $6, tiene_costo = $7, precio_compra = $8, porcentaje_ganancia = $9, seccion = $10 WHERE id = $11 RETURNING *';
                updateParams = [
                    nombre,
                    Number(precio),
                    Number(cantidad),
                    nuevaFotoUrl,
                    tieneParametros,
                    tieneAgrego,
                    tieneCosto, // NUEVO
                    precioCompra ? Number(precioCompra) : currentProduct.rows[0].precio_compra || 0,
                    porcentajeGanancia ? Number(porcentajeGanancia) : currentProduct.rows[0].porcentaje_ganancia || 0,
                    seccion || '',
                    id
                ];
            }

            const result = await query(updateQuery, updateParams);

            // 2-4. Manejar parámetros (código existente)...
            const parametrosAntiguosResult = await query(
                'SELECT nombre FROM producto_parametros WHERE producto_id = $1',
                [id]
            );

            const parametrosAntiguos: ParametroAntiguo[] = parametrosAntiguosResult.rows.map(row => ({
                nombre: row.nombre as string
            }));

            const mapeoParametros: Record<string, string> = {};
            if (parametrosAntiguos.length > 0 && parametros.length > 0) {
                if (parametrosAntiguos.length === parametros.length) {
                    for (let i = 0; i < parametrosAntiguos.length; i++) {
                        mapeoParametros[parametrosAntiguos[i].nombre] = parametros[i].nombre;
                    }
                }
            }

            await query('DELETE FROM producto_parametros WHERE producto_id = $1', [id]);

            if (tieneParametros && parametros.length > 0) {
                for (const param of parametros) {
                    await query(
                        'INSERT INTO producto_parametros (producto_id, nombre, cantidad) VALUES ($1, $2, $3)',
                        [id, param.nombre, param.cantidad]
                    );
                }
            }

            // 5. Manejar agregos (código existente)
            await query('DELETE FROM agregos WHERE producto_id = $1', [id]);

            if (tieneAgrego && agregos.length > 0) {
                for (const agrego of agregos) {
                    if (agrego.nombre && agrego.nombre.trim() !== '') {
                        await query(
                            'INSERT INTO agregos (producto_id, nombre, precio) VALUES ($1, $2, $3)',
                            [id, agrego.nombre.trim(), agrego.precio || 0]
                        );
                    }
                }
            }

            // NUEVO: 6. Manejar costos
            await query('DELETE FROM costos WHERE producto_id = $1', [id]);

            if (tieneCosto && costos.length > 0) {
                for (const costo of costos) {
                    if (costo.nombre && costo.nombre.trim() !== '') {
                        await query(
                            'INSERT INTO costos (producto_id, nombre, precio) VALUES ($1, $2, $3)',
                            [id, costo.nombre.trim(), costo.precio || 0]
                        );
                    }
                }
            }

            // 7-8. Actualizar transacciones y parámetros de usuario (código existente)...
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

            if (tieneParametros && parametros.length > 0) {
                const nombresParametrosActuales = parametros.map(p => p.nombre);
                await query(`
                    DELETE FROM usuario_producto_parametros 
                    WHERE producto_id = $1 
                    AND nombre NOT IN (${nombresParametrosActuales.map((_, i) => `$${i + 2}`).join(', ')})`,
                    [id, ...nombresParametrosActuales]
                );
            } else if (!tieneParametros) {
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

            // NUEVO: 2. Eliminar costos del producto
            await query(
                'DELETE FROM costos WHERE producto_id = $1',
                [id]
            );

            // 3. Eliminar agregos del producto (existente)
            await query(
                'DELETE FROM agregos WHERE producto_id = $1',
                [id]
            );

            // 4-12. Resto del código de eliminación existente...
            await query(
                'DELETE FROM merma_parametros WHERE merma_id IN (SELECT id FROM merma WHERE producto_id = $1)',
                [id]
            );

            await query(
                'DELETE FROM merma WHERE producto_id = $1',
                [id]
            );

            await query(
                'DELETE FROM usuario_producto_parametros WHERE producto_id = $1',
                [id]
            );

            await query(
                'DELETE FROM usuario_productos WHERE producto_id = $1',
                [id]
            );

            await query(
                'DELETE FROM producto_parametros WHERE producto_id = $1',
                [id]
            );

            await query(
                'DELETE FROM transaccion_parametros WHERE transaccion_id IN (SELECT id FROM transacciones WHERE producto = $1)',
                [id]
            );

            await query(
                'DELETE FROM transacciones WHERE producto = $1',
                [id]
            );

            await query(
                'DELETE FROM venta_parametros WHERE venta_id IN (SELECT id FROM ventas WHERE producto = $1)',
                [id]
            );

            await query(
                'DELETE FROM ventas WHERE producto = $1',
                [id]
            );

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
