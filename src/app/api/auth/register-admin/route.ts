import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { nombre, password, telefono } = await request.json();

    if (!nombre || !password) {
      return NextResponse.json(
        { error: 'Nombre y contraseña son requeridos' },
        { status: 400 }
      );
    }

    // Verificar si ya existe un administrador con ese nombre
    const existingUser = await query(
      'SELECT * FROM usuarios WHERE nombre = $1',
      [nombre]
    );

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { error: 'Ya existe un usuario con ese nombre' },
        { status: 400 }
      );
    }

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario administrador
    const result = await query(
      `INSERT INTO usuarios (nombre, password, telefono, rol, activo) 
       VALUES ($1, $2, $3, 'Almacen', true) 
       RETURNING id, nombre, rol, activo`,
      [nombre, hashedPassword, telefono || null]
    );

    return NextResponse.json({
      success: true,
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Error al registrar administrador:', error);
    return NextResponse.json(
      { error: 'Error al registrar administrador' },
      { status: 500 }
    );
  }
}