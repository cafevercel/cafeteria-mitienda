import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        // Consulta única optimizada con JOINs y agregación JSON
        const result = await query(`
            SELECT 
                p.id,
                p.nombre,
                p.precio,
                p.precio_compra,
                p.foto,
                p.tiene_parametros,
                COALESCE(up.cantidad, 0) as cantidad,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'nombre', upp.nombre,
                            'cantidad', upp.cantidad
                        )
                    ) FILTER (WHERE upp.id IS NOT NULL),
                    '[]'::json
                ) as parametros
            FROM productos p
            LEFT JOIN usuario_productos up ON p.id = up.producto_id
            LEFT JOIN usuario_producto_parametros upp ON p.id = upp.producto_id
            GROUP BY p.id, p.nombre, p.precio, p.precio_compra, p.foto, p.tiene_parametros, up.cantidad
            ORDER BY p.id
        `);

        return NextResponse.json(result.rows);
        
    } catch (error) {
        console.error('Error fetching cafeteria products:', error);
        return NextResponse.json({ 
            error: 'Error interno del servidor al obtener productos de cafetería' 
        }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const nombre = formData.get('nombre') as string;
        const precio = formData.get('precio') as string;
        const precioCompra = formData.get('precioCompra') as string;
        const cantidad = formData.get('cantidad') as string;
        const foto = formData.get('foto') as string;
        const tieneParametros = formData.get('tieneParametros') === 'true';
        const parametrosRaw = formData.get('parametros') as string;
        const parametros = parametrosRaw ? JSON.parse(parametrosRaw) : [];

        // Validación básica
        if (!nombre || !precio || !precioCompra) {
            return NextResponse.json({ 
                error: 'Nombre, precio y precio de compra son requeridos' 
            }, { status: 400 });
        }

        let fotoUrl = '';
        if (foto) {
            fotoUrl = foto;
        }

        // Iniciar transacción
        await query('BEGIN');

        try {
            // 1. Insertar producto
            const productoResult = await query(
                `INSERT INTO productos (nombre, precio, precio_compra, foto, tiene_parametros) 
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [nombre, Number(precio), Number(precioCompra), fotoUrl, tieneParametros]
            );

            const productoId = productoResult.rows[0].id;

            // 2. Insertar inventario del usuario
            if (cantidad && Number(cantidad) > 0) {
                await query(
                    `INSERT INTO usuario_productos (producto_id, cantidad) 
                     VALUES ($1, $2)`,
                    [productoId, Number(cantidad)]
                );
            }

            // 3. Insertar parámetros si los tiene
            if (tieneParametros && parametros.length > 0) {
                for (const param of parametros) {
                    await query(
                        `INSERT INTO usuario_producto_parametros (producto_id, nombre, cantidad) 
                         VALUES ($1, $2, $3)`,
                        [productoId, param.nombre, param.cantidad]
                    );
                }
            }

            // Confirmar transacción
            await query('COMMIT');

            // Obtener el producto completo recién creado con una consulta optimizada
            const productoCompleto = await query(`
                SELECT 
                    p.id,
                    p.nombre,
                    p.precio,
                    p.precio_compra,
                    p.foto,
                    p.tiene_parametros,
                    COALESCE(up.cantidad, 0) as cantidad,
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'nombre', upp.nombre,
                                'cantidad', upp.cantidad
                            )
                        ) FILTER (WHERE upp.id IS NOT NULL),
                        '[]'::json
                    ) as parametros
                FROM productos p
                LEFT JOIN usuario_productos up ON p.id = up.producto_id
                LEFT JOIN usuario_producto_parametros upp ON p.id = upp.producto_id
                WHERE p.id = $1
                GROUP BY p.id, p.nombre, p.precio, p.precio_compra, p.foto, p.tiene_parametros, up.cantidad
            `, [productoId]);
            
            return NextResponse.json(productoCompleto.rows[0]);

        } catch (error) {
            // Revertir transacción en caso de error
            await query('ROLLBACK');
            throw error;
        }

    } catch (error) {
        console.error('Error creating cafeteria product:', error);
        return NextResponse.json({ 
            error: 'Error interno del servidor al crear producto' 
        }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const formData = await request.formData();
        const id = formData.get('id') as string;
        const nombre = formData.get('nombre') as string;
        const precio = formData.get('precio') as string;
        const precioCompra = formData.get('precioCompra') as string;
        const cantidad = formData.get('cantidad') as string;
        const foto = formData.get('foto') as string;
        const tieneParametros = formData.get('tieneParametros') === 'true';
        const parametrosRaw = formData.get('parametros') as string;
        const parametros = parametrosRaw ? JSON.parse(parametrosRaw) : [];

        if (!id) {
            return NextResponse.json({ 
                error: 'ID del producto es requerido' 
            }, { status: 400 });
        }

        let fotoUrl = '';
        if (foto) {
            fotoUrl = foto;
        }

        // Iniciar transacción
        await query('BEGIN');

        try {
            // 1. Actualizar producto
            await query(
                `UPDATE productos 
                 SET nombre = $1, precio = $2, precio_compra = $3, foto = $4, tiene_parametros = $5
                 WHERE id = $6`,
                [nombre, Number(precio), Number(precioCompra), fotoUrl, tieneParametros, Number(id)]
            );

            // 2. Actualizar o insertar inventario del usuario
            if (cantidad !== null && cantidad !== undefined) {
                await query(
                    `INSERT INTO usuario_productos (producto_id, cantidad) 
                     VALUES ($1, $2)
                     ON CONFLICT (producto_id) 
                     DO UPDATE SET cantidad = EXCLUDED.cantidad`,
                    [Number(id), Number(cantidad)]
                );
            }

            // 3. Eliminar parámetros existentes
            await query(
                `DELETE FROM usuario_producto_parametros WHERE producto_id = $1`,
                [Number(id)]
            );

            // 4. Insertar nuevos parámetros si los tiene
            if (tieneParametros && parametros.length > 0) {
                for (const param of parametros) {
                    await query(
                        `INSERT INTO usuario_producto_parametros (producto_id, nombre, cantidad) 
                         VALUES ($1, $2, $3)`,
                        [Number(id), param.nombre, param.cantidad]
                    );
                }
            }

            // Confirmar transacción
            await query('COMMIT');

            // Obtener el producto actualizado
            const productoActualizado = await query(`
                SELECT 
                    p.id,
                    p.nombre,
                    p.precio,
                    p.precio_compra,
                    p.foto,
                    p.tiene_parametros,
                    COALESCE(up.cantidad, 0) as cantidad,
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'nombre', upp.nombre,
                                'cantidad', upp.cantidad
                            )
                        ) FILTER (WHERE upp.id IS NOT NULL),
                        '[]'::json
                    ) as parametros
                FROM productos p
                LEFT JOIN usuario_productos up ON p.id = up.producto_id
                LEFT JOIN usuario_producto_parametros upp ON p.id = upp.producto_id
                WHERE p.id = $1
                GROUP BY p.id, p.nombre, p.precio, p.precio_compra, p.foto, p.tiene_parametros, up.cantidad
            `, [Number(id)]);
            
            return NextResponse.json(productoActualizado.rows[0]);

        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }

    } catch (error) {
        console.error('Error updating cafeteria product:', error);
        return NextResponse.json({ 
            error: 'Error interno del servidor al actualizar producto' 
        }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ 
                error: 'ID del producto es requerido' 
            }, { status: 400 });
        }

        // Iniciar transacción
        await query('BEGIN');

        try {
            // 1. Eliminar parámetros del usuario
            await query(
                `DELETE FROM usuario_producto_parametros WHERE producto_id = $1`,
                [Number(id)]
            );

            // 2. Eliminar inventario del usuario
            await query(
                `DELETE FROM usuario_productos WHERE producto_id = $1`,
                [Number(id)]
            );

            // 3. Eliminar producto
            const result = await query(
                `DELETE FROM productos WHERE id = $1 RETURNING *`,
                [Number(id)]
            );

            if (result.rows.length === 0) {
                await query('ROLLBACK');
                return NextResponse.json({ 
                    error: 'Producto no encontrado' 
                }, { status: 404 });
            }

            // Confirmar transacción
            await query('COMMIT');
            
            return NextResponse.json({ 
                message: 'Producto eliminado exitosamente',
                producto: result.rows[0]
            });

        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }

    } catch (error) {
        console.error('Error deleting cafeteria product:', error);
        return NextResponse.json({ 
            error: 'Error interno del servidor al eliminar producto' 
        }, { status: 500 });
    }
}
