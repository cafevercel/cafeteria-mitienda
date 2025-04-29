// app/api/users/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Simplemente obtener usuarios con rol Almacen
    const result = await query(
      'SELECT id, nombre, telefono, rol FROM usuarios WHERE rol = $1 LIMIT 1',
      ['Almacen']
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    return NextResponse.json(
      { error: 'Error al obtener información del usuario' }, 
      { status: 500 }
    );
  }
}
