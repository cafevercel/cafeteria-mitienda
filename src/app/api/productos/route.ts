import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

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
        const porcentajeGanancia = formData.get('porcentajeGanancia') as string;
        const seccion = formData.get('seccion') as string;

        let fotoUrl = '';

        if (foto) {
            fotoUrl = foto;
        }

        await query('BEGIN');

        try {
            // ACTUALIZAR: Agregar tiene_costo con valor por defecto FALSE
            const result = await query(
                'INSERT INTO productos (nombre, precio, precio_compra, cantidad, foto, tiene_parametros, tiene_agrego, tiene_costo, porcentaje_ganancia, seccion) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
                [nombre, Number(precio), Number(precioCompra), Number(cantidad), fotoUrl, tieneParametros, false, false, Number(porcentajeGanancia) || 0, seccion || '']
            );

            const productoId = result.rows[0].id;

            if (tieneParametros && parametros.length > 0) {
                for (const param of parametros) {
                    await query(
                        'INSERT INTO producto_parametros (producto_id, nombre, cantidad) VALUES ($1, $2, $3)',
                        [productoId, param.nombre, param.cantidad]
                    );
                }
            }

            await query('COMMIT');

            // ACTUALIZAR: Incluir costos en la consulta
            const productoCompleto = await query(`
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
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'nombre', pp.nombre,
                                'cantidad', pp.cantidad
                            )
                        ) FILTER (WHERE pp.id IS NOT NULL),
                        '[]'::json
                    ) as parametros,
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'id', a.id,
                                'nombre', a.nombre,
                                'precio', a.precio
                            )
                        ) FILTER (WHERE a.id IS NOT NULL),
                        '[]'::json
                    ) as agregos,
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'id', c.id,
                                'nombre', c.nombre,
                                'precio', c.precio
                            )
                        ) FILTER (WHERE c.id IS NOT NULL),
                        '[]'::json
                    ) as costos
                FROM productos p
                LEFT JOIN producto_parametros pp ON p.id = pp.producto_id
                LEFT JOIN agregos a ON p.id = a.producto_id
                LEFT JOIN costos c ON p.id = c.producto_id
                WHERE p.id = $1
                GROUP BY p.id
            `, [productoId]);

            return NextResponse.json(productoCompleto.rows[0]);
        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Error creating product:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        // ACTUALIZAR: Incluir costos en la consulta
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
                COALESCE(
                    json_agg(
                        json_build_object(
                            'nombre', pp.nombre,
                            'cantidad', pp.cantidad
                        )
                    ) FILTER (WHERE pp.id IS NOT NULL),
                    '[]'::json
                ) as parametros,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', a.id,
                            'nombre', a.nombre,
                            'precio', a.precio
                        )
                    ) FILTER (WHERE a.id IS NOT NULL),
                    '[]'::json
                ) as agregos,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', c.id,
                            'nombre', c.nombre,
                            'precio', c.precio
                        )
                    ) FILTER (WHERE c.id IS NOT NULL),
                    '[]'::json
                ) as costos
            FROM productos p
            LEFT JOIN producto_parametros pp ON p.id = pp.producto_id
            LEFT JOIN agregos a ON p.id = a.producto_id
            LEFT JOIN costos c ON p.id = c.producto_id
            GROUP BY p.id
        `);

        return NextResponse.json(result.rows);
    } catch (error) {
        console.error('Error fetching products:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

