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

// GET - Obtener todos los balances
export async function GET(request: NextRequest) {
    try {
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
      ORDER BY fecha_creacion DESC
    `);

        // Convertir los gastos de JSON a objetos JavaScript
        const balances = result.rows.map(balance => ({
            ...balance,
            gastos: balance.gastos || []
        }));

        return NextResponse.json(balances);
    } catch (error) {
        console.error('Error al obtener balances:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
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

        // Validaciones
        if (!fechaInicio || !fechaFin) {
            return NextResponse.json({ error: 'Las fechas de inicio y fin son requeridas' }, { status: 400 });
        }

        if (typeof gananciaBruta !== 'number' || typeof totalGastos !== 'number' || typeof gananciaNeta !== 'number') {
            return NextResponse.json({ error: 'Los valores monetarios deben ser números' }, { status: 400 });
        }

        if (!Array.isArray(gastos)) {
            return NextResponse.json({ error: 'Los gastos deben ser un array' }, { status: 400 });
        }

        // Generar un ID único
        const id = uuidv4();

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

        return NextResponse.json(result.rows[0]);
    } catch (error) {
        console.error('Error al crear balance:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

// DELETE - Eliminar un balance
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Se requiere un ID para eliminar el balance' }, { status: 400 });
        }

        // Verificar si el balance existe
        const checkResult = await query('SELECT id FROM balances WHERE id = $1', [id]);

        if (checkResult.rows.length === 0) {
            return NextResponse.json({ error: 'Balance no encontrado' }, { status: 404 });
        }

        // Eliminar el balance
        await query('DELETE FROM balances WHERE id = $1', [id]);

        return NextResponse.json({ message: 'Balance eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar balance:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
