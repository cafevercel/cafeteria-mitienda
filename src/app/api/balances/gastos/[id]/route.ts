// app/api/gastos/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// DELETE - Eliminar un gasto específico por ID
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const gastoId = params.id

        if (!gastoId) {
            return NextResponse.json({ error: 'ID del gasto es requerido' }, { status: 400 })
        }

        // Verificar que el gasto existe antes de eliminarlo
        const checkResult = await query('SELECT id FROM gastos WHERE id = $1', [gastoId])

        if (checkResult.rows.length === 0) {
            return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 })
        }

        // Eliminar el gasto
        const result = await query('DELETE FROM gastos WHERE id = $1 RETURNING *', [gastoId])

        return NextResponse.json({
            message: 'Gasto eliminado correctamente',
            gasto: result.rows[0]
        })
    } catch (error) {
        console.error('Error al eliminar gasto:', error)
        return NextResponse.json({ error: 'Error al eliminar el gasto' }, { status: 500 })
    }
}

// GET - Obtener un gasto específico por ID (opcional, por si lo necesitas)
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const gastoId = params.id

        if (!gastoId) {
            return NextResponse.json({ error: 'ID del gasto es requerido' }, { status: 400 })
        }

        const result = await query('SELECT * FROM gastos WHERE id = $1', [gastoId])

        if (result.rows.length === 0) {
            return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 })
        }

        return NextResponse.json(result.rows[0])
    } catch (error) {
        console.error('Error al obtener gasto:', error)
        return NextResponse.json({ error: 'Error al obtener el gasto' }, { status: 500 })
    }
}
