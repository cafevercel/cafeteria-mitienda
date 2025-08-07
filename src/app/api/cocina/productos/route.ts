import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
    try {
        const result = await query(`
            SELECT 
                p.id,
                p.nombre,
                p.precio,
                p.precio_compra,
                p.foto,
                p.tiene_parametros,
                p.seccion,
                (
                    SELECT COALESCE(up.cantidad, 0)
                    FROM usuario_productos up 
                    WHERE up.producto_id = p.id AND up.cocina = true
                    LIMIT 1
                ) as cantidad,
                (
                    SELECT COALESCE(
                        json_agg(
                            json_build_object(
                                'nombre', upp.nombre,
                                'cantidad', upp.cantidad
                            )
                        ),
                        '[]'::json
                    )
                    FROM usuario_producto_parametros upp 
                    WHERE upp.producto_id = p.id
                ) as parametros
            FROM productos p
            WHERE EXISTS (
                SELECT 1 
                FROM usuario_productos up 
                WHERE up.producto_id = p.id AND up.cocina = true
            )
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


