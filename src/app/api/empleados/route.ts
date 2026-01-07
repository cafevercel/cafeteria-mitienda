import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// GET /api/empleados - Obtener empleados por usuario_id (punto de venta)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const usuario_id = searchParams.get('usuario_id');

    if (!usuario_id) {
      return NextResponse.json(
        { error: 'El usuario_id es requerido' },
        { status: 400 }
      );
    }

    const result = await query(
      `SELECT * FROM empleados WHERE usuario_id = $1 ORDER BY created_at DESC`,
      [usuario_id]
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error al obtener empleados:', error);
    return NextResponse.json(
      { error: 'Error al obtener empleados' },
      { status: 500 }
    );
  }
}

// POST /api/empleados - Crear nuevo empleado
export async function POST(request: NextRequest) {
  try {
    const { nombre, usuario_id, password, activo } = await request.json();

    if (!nombre || !usuario_id || !password) {
      return NextResponse.json(
        { error: 'El nombre, usuario_id y password son requeridos' },
        { status: 400 }
      );
    }

    // Encriptar la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = uuidv4();
    const now = new Date().toISOString();

    const result = await query(
      `INSERT INTO empleados (id, nombre, usuario_id, password, activo, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, nombre, usuario_id, hashedPassword, activo ?? true, now, now]
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear empleado:', error);
    return NextResponse.json(
      { error: 'Error al crear empleado' },
      { status: 500 }
    );
  }
}