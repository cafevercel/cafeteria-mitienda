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

        let fotoUrl = '';

        if (foto) {
            fotoUrl = foto;
        }

        await query('BEGIN');

        try {
            const result = await query(
                'INSERT INTO productos (nombre, precio, precio_compra, cantidad, foto, tiene_parametros, porcentaje_ganancia) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
                [nombre, Number(precio), Number(precioCompra), Number(cantidad), fotoUrl, tieneParametros, Number(porcentajeGanancia) || 0]
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

            // Usar la misma función que en [id]/route.ts para obtener el producto con parámetros
            const productoCompleto = await query(`
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
            
            // Crear respuesta con encabezados anti-caché
            const response = NextResponse.json(productoCompleto.rows[0]);
            response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            response.headers.set('Pragma', 'no-cache');
            response.headers.set('Expires', '0');
            response.headers.set('Surrogate-Control', 'no-store');
            
            return response;
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
            GROUP BY p.id
        `);

        // Crear respuesta con encabezados anti-caché
        const response = NextResponse.json(result.rows);
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
        response.headers.set('Surrogate-Control', 'no-store');
        
        return response;
    } catch (error) {
        console.error('Error fetching products:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}