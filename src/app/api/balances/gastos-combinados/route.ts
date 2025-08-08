import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// ✅ Agregar para evitar caché
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // ✅ UNA SOLA CONSULTA que combina ambas fuentes
        const gastosResult = await query(`
            WITH gastos_balances AS (
                SELECT 
                    gasto_item->>'nombre' as nombre,
                    CAST(gasto_item->>'cantidad' as DECIMAL) as cantidad,
                    'balance' as tipo,
                    b.id::text as origen_id,
                    b.fecha_creacion as fecha,
                    json_build_object(
                        'balanceId', b.id,
                        'fechaInicio', b.fecha_inicio,
                        'fechaFin', b.fecha_fin
                    ) as metadata
                FROM balances b,
                     json_array_elements(b.gastos) as gasto_item
                WHERE b.gastos IS NOT NULL 
                AND json_array_length(b.gastos) > 0
            ),
            gastos_directos AS (
                SELECT 
                    g.nombre,
                    g.cantidad,
                    'directo' as tipo,
                    g.id::text as origen_id,
                    g.fecha,
                    json_build_object('gastoId', g.id) as metadata
                FROM gastos g
            ),
            todos_gastos AS (
                SELECT * FROM gastos_balances
                UNION ALL
                SELECT * FROM gastos_directos
            )
            SELECT 
                DATE(fecha) as fecha_dia,
                json_agg(
                    json_build_object(
                        'nombre', nombre,
                        'cantidad', cantidad,
                        'tipo', tipo,
                        'origenId', origen_id,
                        'fechaCreacion', fecha,
                        'metadata', metadata
                    ) ORDER BY fecha DESC
                ) as gastos,
                SUM(cantidad) as total_dia
            FROM todos_gastos
            GROUP BY DATE(fecha)
            ORDER BY fecha_dia DESC
        `);

        // ✅ Formatear la respuesta de manera simple
        const gastosFormateados = gastosResult.rows.map(row => ({
            fecha: new Date(row.fecha_dia).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            }),
            gastos: row.gastos,
            total: Number(row.total_dia)
        }));

        return NextResponse.json(gastosFormateados);

    } catch (error) {
        console.error('Error al obtener gastos combinados:', error);
        return NextResponse.json({
            error: 'Error interno del servidor al obtener gastos combinados'
        }, { status: 500 });
    }
}
