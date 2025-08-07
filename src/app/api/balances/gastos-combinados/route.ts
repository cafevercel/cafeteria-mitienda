import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
    try {
        // Obtener gastos de balances
        const balancesResult = await query(`
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

        // Obtener gastos directos de la tabla gastos
        const gastosResult = await query(`
            SELECT 
                id,
                nombre,
                cantidad,
                fecha as "fechaCreacion"
            FROM gastos
            ORDER BY fecha DESC
        `);

        // Procesar los datos para agrupar por día
        const gastosPorDia = new Map<string, {
            fecha: string;
            gastos: Array<{
                nombre: string;
                cantidad: number;
                tipo: 'balance' | 'directo';
                balanceId?: string;
                fechaInicio?: string;
                fechaFin?: string;
                gastoId?: string;
                fechaCreacion?: string;
            }>;
            total: number;
        }>();

        // Procesar gastos de balances
        balancesResult.rows.forEach(balance => {
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

            if (Array.isArray(balance.gastos)) {
                balance.gastos.forEach((gasto: any) => {
                    const gastoItem = {
                        nombre: gasto.nombre,
                        cantidad: Number(gasto.cantidad),
                        tipo: 'balance' as const,
                        balanceId: balance.id,
                        fechaInicio: balance.fechaInicio,
                        fechaFin: balance.fechaFin,
                        fechaCreacion: balance.fechaCreacion
                    };
                    diaData.gastos.push(gastoItem);
                    diaData.total += gastoItem.cantidad;
                });
            }
        });

        // Procesar gastos directos
        gastosResult.rows.forEach(gasto => {
            const fechaGasto = new Date(gasto.fechaCreacion).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });

            if (!gastosPorDia.has(fechaGasto)) {
                gastosPorDia.set(fechaGasto, {
                    fecha: fechaGasto,
                    gastos: [],
                    total: 0
                });
            }

            const diaData = gastosPorDia.get(fechaGasto)!;
            const gastoItem = {
                nombre: gasto.nombre,
                cantidad: Number(gasto.cantidad),
                tipo: 'directo' as const,
                gastoId: gasto.id,
                fechaCreacion: gasto.fechaCreacion
            };
            diaData.gastos.push(gastoItem);
            diaData.total += gastoItem.cantidad;
        });

        // Convertir Map a Array y ordenar por fecha
        const gastosArray = Array.from(gastosPorDia.values()).sort((a, b) => {
            // Usar la fecha más reciente de los gastos del día para ordenar
            const fechaA = new Date(a.gastos[0]?.fechaCreacion || a.fecha.split('/').reverse().join('-'));
            const fechaB = new Date(b.gastos[0]?.fechaCreacion || b.fecha.split('/').reverse().join('-'));
            return fechaB.getTime() - fechaA.getTime(); // Más reciente primero
        });

        return NextResponse.json(gastosArray);

    } catch (error) {
        console.error('Error al obtener gastos combinados:', error);
        return NextResponse.json({
            error: 'Error interno del servidor al obtener gastos combinados'
        }, { status: 500 });
    }
}
