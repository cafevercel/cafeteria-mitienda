import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

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
                ganancia_neta as "gananciaNeta", 
                fecha_creacion as "fechaCreacion"
            FROM balances
            ORDER BY fecha_creacion DESC
        `;
        
        const params: any[] = [];
        
        // Agregar paginación si se proporciona
        if (limit) {
            queryText += ` LIMIT $${params.length + 1}`;
            params.push(parseInt(limit));
        }
        
        if (offset) {
            queryText += ` OFFSET $${params.length + 1}`;
            params.push(parseInt(offset));
        }

        const result = await query(queryText, params);

        // Convertir los gastos de JSON a objetos JavaScript
        const balances = result.rows.map(balance => ({
            ...balance,
            gastos: balance.gastos || []
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
            gananciaNeta,
            fechaCreacion
        } = data;

        // Validaciones mejoradas
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

        if (!Array.isArray(gastos)) {
            return NextResponse.json({ 
                error: 'Los gastos deben ser un array' 
            }, { status: 400 });
        }

        // Validar estructura de gastos
        if (!validarGastos(gastos)) {
            return NextResponse.json({ 
                error: 'Los gastos deben tener la estructura correcta (nombre: string, cantidad: number)' 
            }, { status: 400 });
        }

        // Validar que la ganancia neta sea correcta
        const gananciaNeteCalculada = gananciaBruta - totalGastos;
        if (Math.abs(gananciaNeta - gananciaNeteCalculada) > 0.01) {
            return NextResponse.json({ 
                error: 'La ganancia neta no coincide con el cálculo (ganancia bruta - total gastos)' 
            }, { status: 400 });
        }

        // Generar un ID único
        const id = uuidv4();

        // Iniciar transacción
        await query('BEGIN');

        try {
            // Insertar el balance en la base de datos
            const result = await query(`
                INSERT INTO balances (
                    id, 
                    fecha_inicio, 
                    fecha_fin, 
                    ganancia_bruta, 
                    gastos, 
                    total_gastos, 
                    ganancia_neta, 
                    fecha_creacion
                ) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
                gananciaNeta,
                fechaCreacion || new Date().toISOString()
            ]);

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
        console.error('Error al crear balance:', error);
        return NextResponse.json({ 
            error: 'Error interno del servidor al crear balance' 
        }, { status: 500 });
    }
}

// PUT - Actualizar un balance existente
export async function PUT(request: NextRequest) {
    try {
        const data = await request.json();
        const {
            id,
            fechaInicio,
            fechaFin,
            gananciaBruta,
            gastos,
            totalGastos,
            gananciaNeta
        } = data;

        if (!id) {
            return NextResponse.json({ 
                error: 'Se requiere un ID para actualizar el balance' 
            }, { status: 400 });
        }

        // Validaciones (mismas que POST)
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

        const gananciaNeteCalculada = gananciaBruta - totalGastos;
        if (Math.abs(gananciaNeta - gananciaNeteCalculada) > 0.01) {
            return NextResponse.json({ 
                error: 'La ganancia neta no coincide con el cálculo' 
            }, { status: 400 });
        }

        // Iniciar transacción
        await query('BEGIN');

        try {
            // Actualizar el balance
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
                    error: 'Balance no encontrado' 
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
        return NextResponse.json({ 
            error: 'Error interno del servidor al actualizar balance' 
        }, { status: 500 });
    }
}

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

        // Iniciar transacción
        await query('BEGIN');

        try {
            // Eliminar el balance (sin consulta previa de verificación)
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
                    error: 'Balance no encontrado' 
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
        return NextResponse.json({ 
            error: 'Error interno del servidor al eliminar balance' 
        }, { status: 500 });
    }
}
