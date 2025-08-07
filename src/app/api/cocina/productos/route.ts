import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
    try {
        // Consulta corregida - misma lógica que cafetería pero filtrando cocina = true
        const result = await query(`
            SELECT 
                p.id,
                p.nombre,
                p.precio,
                p.precio_compra,
                p.foto,
                p.tiene_parametros,
                -- Para productos con parámetros, usar la suma de parámetros
                -- Para productos sin parámetros, usar la cantidad directa
                CASE 
                    WHEN p.tiene_parametros = true THEN 
                        COALESCE(
                            (SELECT SUM(upp_sum.cantidad) 
                             FROM usuario_producto_parametros upp_sum 
                             WHERE upp_sum.producto_id = p.id), 
                            0
                        )
                    ELSE 
                        COALESCE(up.cantidad, 0)
                END as cantidad,
                -- Obtener parámetros si existen
                COALESCE(
                    (SELECT json_agg(
                        json_build_object(
                            'nombre', upp_params.nombre,
                            'cantidad', upp_params.cantidad
                        )
                    )
                    FROM usuario_producto_parametros upp_params 
                    WHERE upp_params.producto_id = p.id),
                    '[]'::json
                ) as parametros
            FROM productos p
            LEFT JOIN usuario_productos up ON p.id = up.producto_id
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
