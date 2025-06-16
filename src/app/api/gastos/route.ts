import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET - Obtener todos los gastos
export async function GET() {
  try {
    const result = await query(
      'SELECT * FROM gastos ORDER BY fecha DESC'
    )
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error al obtener gastos:', error)
    return NextResponse.json({ error: 'Error al obtener los gastos' }, { status: 500 })
  }
}

// POST - Crear un nuevo gasto
export async function POST(request: NextRequest) {
  try {
    const { nombre, cantidad, fecha } = await request.json()

    if (!nombre || !cantidad) {
      return NextResponse.json({ error: 'Nombre y cantidad son requeridos' }, { status: 400 })
    }

    const result = await query(
      'INSERT INTO gastos (nombre, cantidad, fecha) VALUES ($1, $2, $3) RETURNING *',
      [nombre, cantidad, fecha || new Date().toISOString()]
    )

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error al crear gasto:', error)
    return NextResponse.json({ error: 'Error al crear el gasto' }, { status: 500 })
  }
}

// DELETE - Eliminar un gasto
export async function DELETE(request: NextRequest) {
  try {
    const gastoId = request.nextUrl.searchParams.get('id')

    if (!gastoId) {
      return NextResponse.json({ error: 'ID del gasto es requerido' }, { status: 400 })
    }

    await query('DELETE FROM gastos WHERE id = $1', [gastoId])
    return NextResponse.json({ message: 'Gasto eliminado correctamente' })
  } catch (error) {
    console.error('Error al eliminar gasto:', error)
    return NextResponse.json({ error: 'Error al eliminar el gasto' }, { status: 500 })
  }
} 