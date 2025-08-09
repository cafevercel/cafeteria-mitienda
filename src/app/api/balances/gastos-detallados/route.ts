//balances/gastos-detallados/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
    try {
        const result = await query(`
            SELECT 
                id,
                fecha_inicio as "fechaInicio",
                fecha_fin as "fechaFin",
                gastos,
                total_gastos as "totalGastos",
                fecha_creacion as "fechaCreacion"
            FROM balances
            WHERE gastos IS NOT NULL 
            AND json_array_length(gastos) > 0
            ORDER BY fecha_creacion DESC
        `);

        const gastosDetallados = result.rows.map(balance => ({
            balanceId: balance.id,
            fechaInicio: balance.fechaInicio,
            fechaFin: balance.fechaFin,
            gastos: Array.isArray(balance.gastos) ? balance.gastos : [],
            totalGastos: Number(balance.totalGastos) || 0,
            fechaCreacion: balance.fechaCreacion
        }));

        return NextResponse.json(gastosDetallados);

    } catch (error) {
        console.error('Error al obtener gastos detallados:', error);
        return NextResponse.json({
            error: 'Error interno del servidor al obtener gastos detallados'
        }, { status: 500 });
    }
}
