import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Interfaces para el tipado
interface GastoBalance {
    nombre: string;
    cantidad: number;
}

interface Balance {
    id: string;
    fechaInicio: string;
    fechaFin: string;
    gananciaBruta: number;
    gastos: GastoBalance[];
    totalGastos: number;
    gananciaNeta: number;
    fechaCreacion: string;
}

// Función de validación de gastos
function validarGastos(gastos: any[]): gastos is GastoBalance[] {
    return gastos.every(gasto =>
        typeof gasto === 'object' &&
        typeof gasto.nombre === 'string' &&
        typeof gasto.cantidad === 'number' &&
        gasto.nombre.trim().length > 0 &&
        gasto.cantidad >= 0
    );
}

// GET - Obtener un balance específico por ID
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;

        // Validar que el ID no esté vacío
        if (!id || id.trim() === '') {
            return NextResponse.json({
                error: 'ID del balance es requerido'
            }, { status: 400 });
        }

        const result = await query(`
            SELECT 
                id, 
                fecha_inicio as "fechaInicio", 
                fecha_fin as "fechaFin", 
                ganancia_bruta as "gananciaBruta", 
                gastos, 
                total_gastos as "totalGastos", 
                ganancia_neta as "gananciaNeta", 
                fecha_creacion as "fechaCreacion"
            FROM balances
            WHERE id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return NextResponse.json({
                error: 'Balance no encontrado',
                details: `No se encontró un balance con ID: ${id}`
            }, { status: 404 });
        }

        // Convertir los gastos de JSON a objetos JavaScript
        const balance = {
            ...result.rows[0],
            gastos: result.rows[0].gastos || []
        };

        return NextResponse.json(balance);
    } catch (error) {
        console.error('Error al obtener balance:', error);

        // Manejo específico para errores de UUID inválido
        if (error instanceof Error && error.message.includes('invalid input syntax for type uuid')) {
            return NextResponse.json({
                error: 'ID del balance inválido',
                details: 'El ID proporcionado no tiene un formato válido'
            }, { status: 400 });
        }

        return NextResponse.json({
            error: 'Error interno del servidor al obtener balance',
            details: process.env.NODE_ENV === 'development' ? error : undefined
        }, { status: 500 });
    }
}

// PUT - Actualizar un balance específico
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;

        // Validar que el ID no esté vacío
        if (!id || id.trim() === '') {
            return NextResponse.json({
                error: 'ID del balance es requerido'
            }, { status: 400 });
        }

        const data = await request.json();
        const {
            fechaInicio,
            fechaFin,
            gananciaBruta,
            gastos,
            totalGastos,
            gananciaNeta
        } = data;

        // Validaciones robustas
        if (!fechaInicio || !fechaFin) {
            return NextResponse.json({
                error: 'Las fechas de inicio y fin son requeridas'
            }, { status: 400 });
        }

        // Validar formato de fechas
        if (new Date(fechaInicio).toString() === 'Invalid Date' ||
            new Date(fechaFin).toString() === 'Invalid Date') {
            return NextResponse.json({
                error: 'Las fechas deben tener un formato válido'
            }, { status: 400 });
        }

        // Validar que fecha fin sea posterior a fecha inicio
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
                error: 'Los gastos deben ser un array con la estructura correcta (nombre: string, cantidad: number)'
            }, { status: 400 });
        }

        // Validar que la ganancia neta sea correcta
        const gananciaNeteCalculada = gananciaBruta - totalGastos;
        if (Math.abs(gananciaNeta - gananciaNeteCalculada) > 0.01) {
            return NextResponse.json({
                error: 'La ganancia neta no coincide con el cálculo (ganancia bruta - total gastos)'
            }, { status: 400 });
        }

        // Iniciar transacción
        await query('BEGIN');

        try {
            // Actualizar el balance (una sola consulta)
            const result = await query(`
                UPDATE balances 
                SET 
                    fecha_inicio = $2,
                    fecha_fin = $3,
                    ganancia_bruta = $4,
                    gastos = $5,
                    total_gastos = $6,
                    ganancia_neta = $7
                WHERE id = $1
                RETURNING 
                    id, 
                    fecha_inicio as "fechaInicio", 
                    fecha_fin as "fechaFin", 
                    ganancia_bruta as "gananciaBruta", 
                    gastos, 
                    total_gastos as "totalGastos", 
                    ganancia_neta as "gananciaNeta", 
                    fecha_creacion as "fechaCreacion"
            `, [
                id,
                fechaInicio,
                fechaFin,
                gananciaBruta,
                JSON.stringify(gastos),
                totalGastos,
                gananciaNeta
            ]);

            if (result.rows.length === 0) {
                await query('ROLLBACK');
                return NextResponse.json({
                    error: 'Balance no encontrado',
                    details: `No se encontró un balance con ID: ${id}`
                }, { status: 404 });
            }

            // Confirmar transacción
            await query('COMMIT');

            return NextResponse.json({
                ...result.rows[0],
                gastos: result.rows[0].gastos || []
            });

        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }

    } catch (error) {
        console.error('Error al actualizar balance:', error);

        // Manejo específico para errores de UUID inválido
        if (error instanceof Error && error.message.includes('invalid input syntax for type uuid')) {
            return NextResponse.json({
                error: 'ID del balance inválido',
                details: 'El ID proporcionado no tiene un formato válido'
            }, { status: 400 });
        }

        return NextResponse.json({
            error: 'Error interno del servidor al actualizar balance',
            details: process.env.NODE_ENV === 'development' ? error : undefined
        }, { status: 500 });
    }
}

// DELETE - Eliminar un balance específico
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;

        // Validar que el ID no esté vacío
        if (!id || id.trim() === '') {
            return NextResponse.json({
                error: 'ID del balance es requerido'
            }, { status: 400 });
        }

        // Iniciar transacción
        await query('BEGIN');

        try {
            // ✅ Una sola consulta: eliminar y retornar datos
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
                    ganancia_neta as "gananciaNeta", 
                    fecha_creacion as "fechaCreacion"
            `, [id]);

            if (result.rows.length === 0) {
                await query('ROLLBACK');
                return NextResponse.json({
                    error: 'Balance no encontrado',
                    details: `No se encontró un balance con ID: ${id}`
                }, { status: 404 });
            }

            // Confirmar transacción
            await query('COMMIT');

            return NextResponse.json({
                message: 'Balance eliminado correctamente',
                balance: {
                    ...result.rows[0],
                    gastos: result.rows[0].gastos || []
                }
            });

        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }

    } catch (error) {
        console.error('Error al eliminar balance:', error);

        // Manejo específico para errores de UUID inválido
        if (error instanceof Error && error.message.includes('invalid input syntax for type uuid')) {
            return NextResponse.json({
                error: 'ID del balance inválido',
                details: 'El ID proporcionado no tiene un formato válido'
            }, { status: 400 });
        }

        return NextResponse.json({
            error: 'Error interno del servidor al eliminar balance',
            details: process.env.NODE_ENV === 'development' ? error : undefined
        }, { status: 500 });
    }
}
