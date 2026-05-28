import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const moderadorId = searchParams.get('moderadorId');

    if (!moderadorId) {
      return NextResponse.json({ error: 'ID de moderador requerido' }, { status: 400 });
    }

    // Consulta para obtener todos los registros del moderador ordenados cronológicamente
    const result = await query(
      `SELECT id, moderador_id, accion, detalles, fecha 
       FROM bitacora_moderadores 
       WHERE moderador_id = $1 
       ORDER BY fecha DESC`,
      [moderadorId]
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error al obtener bitácora de moderador:', error);
    return NextResponse.json({ error: 'Error al obtener bitácora' }, { status: 500 });
  }
}
