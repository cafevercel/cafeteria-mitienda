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

        // Procesar los datos para agrupar por día
        const gastosPorDia = new Map<string, {
            fecha: string;
            gastos: Array<{
                nombre: string;
                cantidad: number;
                balanceId: string;
                fechaInicio: string;
                fechaFin: string;
            }>;
            total: number;
        }>();

        result.rows.forEach(balance => {
            // Usar la fecha de creación del balance como fecha del gasto
            const fechaBalance = new Date(balance.fechaCreacion).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });

            if (!gastosPorDia.has(fechaBalance)) {
                gastosPorDia.set(fechaBalance, {
                    fecha: fechaBalance,
                    gastos: [],
                    total: 0
                });
            }

            const diaData = gastosPorDia.get(fechaBalance)!;

            // Agregar cada gasto del balance
            if (Array.isArray(balance.gastos)) {
                balance.gastos.forEach((gasto: any) => {
                    diaData.gastos.push({
                        nombre: gasto.nombre,
                        cantidad: Number(gasto.cantidad),
                        balanceId: balance.id,
                        fechaInicio: balance.fechaInicio,
                        fechaFin: balance.fechaFin
                    });
                    diaData.total += Number(gasto.cantidad);
                });
            }
        });

        // Convertir Map a Array y ordenar por fecha
        const gastosArray = Array.from(gastosPorDia.values()).sort((a, b) => {
            const fechaA = new Date(a.gastos[0]?.fechaInicio || a.fecha);
            const fechaB = new Date(b.gastos[0]?.fechaInicio || b.fecha);
            return fechaB.getTime() - fechaA.getTime(); // Más reciente primero
        });

        return NextResponse.json(gastosArray);

    } catch (error) {
        console.error('Error al obtener gastos de balances:', error);
        return NextResponse.json({
            error: 'Error interno del servidor al obtener gastos'
        }, { status: 500 });
    }
}
