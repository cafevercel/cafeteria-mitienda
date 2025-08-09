// api/cocina/productos/route.ts - Reemplaza completamente
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

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
                CASE 
                    WHEN p.tiene_parametros = true THEN 
                        COALESCE(
                            (SELECT SUM(cp.cantidad) 
                                FROM cocina_parametros cp 
                                WHERE cp.producto_id = p.id), 
                            0
                        )
                    ELSE 
                        COALESCE(c.cantidad, 0)
                END as cantidad,
                CASE 
                    WHEN p.tiene_parametros = true THEN
                        COALESCE(
                            (SELECT json_agg(
                                json_build_object(
                                    'nombre', cp.nombre,
                                    'cantidad', cp.cantidad
                                )
                            )
                            FROM cocina_parametros cp 
                            WHERE cp.producto_id = p.id),
                            '[]'::json
                        )
                    ELSE '[]'::json
                END as parametros
            FROM productos p
            LEFT JOIN cocina c ON p.id = c.producto_id
            WHERE c.producto_id IS NOT NULL
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
