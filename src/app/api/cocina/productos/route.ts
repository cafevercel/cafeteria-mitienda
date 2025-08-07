import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
    try {
        const result = await query(`
            SELECT 
                up.id,
                up.producto_id,
                p.nombre,
                p.precio,
                p.precio_compra,
                p.foto,
                p.tiene_parametros,
                up.cantidad,
                -- Obtener parámetros si existen
                COALESCE(
                    (SELECT json_agg(
                        json_build_object(
                            'nombre', upp.nombre,
                            'cantidad', upp.cantidad
                        )
                    )
                    FROM usuario_producto_parametros upp 
                    WHERE upp.producto_id = p.id),
                    '[]'::json
                ) as parametros
            FROM usuario_productos up
            INNER JOIN productos p ON up.producto_id = p.id
            WHERE up.cocina = true
            ORDER BY p.nombre
        `);

        return NextResponse.json(result.rows);

    } catch (error) {
        console.error('Error fetching cocina products:', error);
        return NextResponse.json({
            error: 'Error interno del servidor al obtener productos de cocina'
        }, { status: 500 });
    }
}
