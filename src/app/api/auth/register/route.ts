import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {

  const body = await request.json();
  const { nombre, password, telefono, rol, activo } = body;

  try {
    // Si el rol es Vendedor y no se proporciona el campo activo, lo establecemos como true por defecto
    const isActivo = rol === 'Vendedor' ? (activo !== undefined ? activo : true) : true;
    
    const result = await query(
      'INSERT INTO usuarios (nombre, password, telefono, rol, activo) VALUES ($1, $2, $3, $4, $5) RETURNING id, nombre, telefono, rol, activo',
      [nombre, password, telefono, rol, isActivo]
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    return NextResponse.json({ error: 'Error al registrar usuario' }, { status: 500 });
  }
}