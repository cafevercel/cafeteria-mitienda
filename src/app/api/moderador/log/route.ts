import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { moderadorId, accion, detalles } = body;

    if (!moderadorId || !accion || !detalles) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos: moderadorId, accion, detalles' },
        { status: 400 }
      );
    }

    // Insertar el log en la tabla bitacora_moderadores
    const result = await query(
      `INSERT INTO bitacora_moderadores (moderador_id, accion, detalles, fecha)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [moderadorId, accion, detalles]
    );

    return NextResponse.json({ success: true, log: result.rows[0] });
  } catch (error) {
    console.error('Error al registrar en bitácora:', error);
    return NextResponse.json(
      { error: 'Error al registrar en bitácora', details: error instanceof Error ? error.message : '' },
      { status: 500 }
    );
  }
}
