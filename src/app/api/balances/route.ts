import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { GastoBalance, Balance, IngresoBalance } from '@/types'

function validarIngresos(ingresos: any[]): ingresos is IngresoBalance[] {
    return ingresos.every(ingreso =>
        typeof ingreso === 'object' &&
        typeof ingreso.nombre === 'string' &&
        typeof ingreso.cantidad === 'number' &&
        ingreso.nombre.trim().length > 0 &&
        ingreso.cantidad >= 0
    );
}

function validarGastos(gastos: any[]): gastos is GastoBalance[] {
    return gastos.every(gasto =>
        typeof gasto === 'object' &&
        typeof gasto.nombre === 'string' &&
        typeof gasto.cantidad === 'number' &&
        gasto.nombre.trim().length > 0 &&
        gasto.cantidad >= 0
    );
}

// GET - Obtener todos los balances
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = searchParams.get('limit');
        const offset = searchParams.get('offset');
        
        let queryText = `
            SELECT 
                id, 
                fecha_inicio as "fechaInicio", 
                fecha_fin as "fechaFin", 
                ganancia_bruta as "gananciaBruta", 
                gastos, 
                total_gastos as "totalGastos", 
                ingresos,                          
                total_ingresos as "totalIngresos",
                ganancia_neta as "gananciaNeta", 
                fecha_creacion as "fechaCreacion"
            FROM balances
            ORDER BY fecha_creacion DESC
        `;
        
        const params: any[] = [];
        
        if (limit) {
            queryText += ` LIMIT $${params.length + 1}`;
            params.push(parseInt(limit));
        }

        if (offset) {
            queryText += ` OFFSET $${params.length + 1}`;
            params.push(parseInt(offset));
        }

        const result = await query(queryText, params);

        const balances = result.rows.map(balance => ({
            ...balance,
            gastos: balance.gastos || [],
            ingresos: balance.ingresos || []
        }));

        return NextResponse.json(balances);
    } catch (error) {
        console.error('Error al obtener balances:', error);
        return NextResponse.json({
            error: 'Error interno del servidor al obtener balances'
        }, { status: 500 });
    }
}

// POST - Crear un nuevo balance
export async function POST(request: NextRequest) {
    try {
        const data = await request.json();
        const {
            fechaInicio,
            fechaFin,
            gananciaBruta,
            gastos,
            totalGastos,
            ingresos,
            totalIngresos,
            gananciaNeta,
            fechaCreacion
        } = data;

        // Validaciones...
        if (!fechaInicio || !fechaFin) {
            return NextResponse.json({
                error: 'Las fechas de inicio y fin son requeridas'
            }, { status: 400 });
        }

        if (new Date(fechaInicio).toString() === 'Invalid Date' ||
            new Date(fechaFin).toString() === 'Invalid Date') {
            return NextResponse.json({
                error: 'Las fechas deben tener un formato válido'
            }, { status: 400 });
        }

        if (new Date(fechaFin) < new Date(fechaInicio)) {
            return NextResponse.json({
                error: 'La fecha de fin debe ser posterior a la fecha de inicio'
            }, { status: 400 });
        }

        if (typeof gananciaBruta !== 'number' || typeof totalGastos !== 'number' || typeof gananciaNeta !== 'number') {
            return NextResponse.json({
                error: 'Los valores monetarios deben ser números'
            }, { status: 400 });
        }

        if (gananciaBruta < 0 || totalGastos < 0) {
            return NextResponse.json({
                error: 'Los valores monetarios no pueden ser negativos'
            }, { status: 400 });
        }

        if (!Array.isArray(gastos) || !validarGastos(gastos)) {
            return NextResponse.json({
                error: 'Los gastos deben ser un array con la estructura correcta'
            }, { status: 400 });
        }

        if (!Array.isArray(ingresos) || !validarIngresos(ingresos)) {
            return NextResponse.json({
                error: 'Los ingresos deben ser un array con la estructura correcta'
            }, { status: 400 });
        }

        if (typeof totalIngresos !== 'number' || totalIngresos < 0) {
            return NextResponse.json({
                error: 'El total de ingresos debe ser un número no negativo'
            }, { status: 400 });
        }

        const gananciaNeteCalculada = gananciaBruta + totalIngresos - totalGastos;
        if (Math.abs(gananciaNeta - gananciaNeteCalculada) > 0.01) {
            return NextResponse.json({
                error: 'La ganancia neta no coincide con el cálculo (ganancia bruta + ingresos - gastos)'
            }, { status: 400 });
        }

        const id = uuidv4();

        // Iniciar transacción
        await query('BEGIN');

        try {
            const result = await query(`
                INSERT INTO balances (
                    id, fecha_inicio, fecha_fin, ganancia_bruta, 
                    gastos, total_gastos, 
                    ingresos, total_ingresos,  
                    ganancia_neta, fecha_creacion
                ) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING 
                    id, 
                    fecha_inicio as "fechaInicio", 
                    fecha_fin as "fechaFin", 
                    ganancia_bruta as "gananciaBruta", 
                    gastos, 
                    total_gastos as "totalGastos", 
                    ingresos,                          
                    total_ingresos as "totalIngresos",
                    ganancia_neta as "gananciaNeta", 
                    fecha_creacion as "fechaCreacion"
            `, [
                id,
                fechaInicio,
                fechaFin,
                gananciaBruta,
                JSON.stringify(gastos),
                totalGastos,
                JSON.stringify(ingresos),
                totalIngresos,
                gananciaNeta,
                fechaCreacion || new Date().toISOString()
            ]);

            // ✅ AGREGAR COMMIT - ESTO ERA LO QUE FALTABA!
            await query('COMMIT');

            return NextResponse.json({
                ...result.rows[0],
                gastos: result.rows[0].gastos || [],
                ingresos: result.rows[0].ingresos || []
            });
            
        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }

    } catch (error) {
        console.error('Error al crear balance:', error);
        return NextResponse.json({
            error: 'Error interno del servidor al crear balance'
        }, { status: 500 });
    }
}

// ❌ ELIMINAR COMPLETAMENTE LA FUNCIÓN PUT DE AQUÍ
// Ya no necesitas PUT en este archivo porque tienes /api/balances/[id]/route.ts

// DELETE - Eliminar un balance
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({
                error: 'Se requiere un ID para eliminar el balance'
            }, { status: 400 });
        }

        await query('BEGIN');

        try {
            const result = await query(`
                DELETE FROM balances 
                WHERE id = $1 
                RETURNING 
                    id, 
                    fecha_inicio as "fechaInicio", 
                    fecha_fin as "fechaFin", 
                    ganancia_bruta as "gananciaBruta", 
                    gastos, 
                    total_gastos as "totalGastos", 
                    ingresos,
                    total_ingresos as "totalIngresos",
                    ganancia_neta as "gananciaNeta", 
                    fecha_creacion as "fechaCreacion"
            `, [id]);

            if (result.rows.length === 0) {
                await query('ROLLBACK');
                return NextResponse.json({
                    error: 'Balance no encontrado'
                }, { status: 404 });
            }

            await query('COMMIT');

            return NextResponse.json({
                message: 'Balance eliminado correctamente',
                balance: {
                    ...result.rows[0],
                    gastos: result.rows[0].gastos || [],
                    ingresos: result.rows[0].ingresos || []
                }
            });

        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }

    } catch (error) {
        console.error('Error al eliminar balance:', error);
        return NextResponse.json({
            error: 'Error interno del servidor al eliminar balance'
        }, { status: 500 });
    }
}
