import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

// GET: List all moderators
export async function GET(request: NextRequest) {
  try {
    const result = await query(
      'SELECT id, nombre, telefono, rol, activo FROM usuarios WHERE rol = $1 ORDER BY id DESC',
      ['Moderador']
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error al obtener moderadores:', error);
    return NextResponse.json({ error: 'Error al obtener moderadores' }, { status: 500 });
  }
}

// POST: Create a new moderator
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nombre, password, telefono, activo } = body;

    if (!nombre || !password) {
      return NextResponse.json({ error: 'Nombre y contraseña son requeridos' }, { status: 400 });
    }

    // Verificar si ya existe un usuario con el mismo nombre
    const existingUser = await query('SELECT id FROM usuarios WHERE nombre = $1', [nombre]);
    if (existingUser.rows.length > 0) {
      return NextResponse.json({ error: 'Ya existe una cuenta con este nombre' }, { status: 400 });
    }

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 10);
    const isActivo = activo !== undefined ? activo : true;

    const result = await query(
      `INSERT INTO usuarios (nombre, password, telefono, rol, activo) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, nombre, telefono, rol, activo`,
      [nombre, hashedPassword, telefono || '', 'Moderador', isActivo]
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear moderador:', error);
    return NextResponse.json({ error: 'Error al crear moderador' }, { status: 500 });
  }
}

// PUT: Update a moderator
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID no proporcionado' }, { status: 400 });
    }

    const body = await request.json();
    const { nombre, telefono, password, activo } = body;

    // Obtener datos actuales
    const userResult = await query('SELECT nombre, telefono, password FROM usuarios WHERE id = $1 AND rol = $2', [id, 'Moderador']);
    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'Moderador no encontrado' }, { status: 404 });
    }
    const currentModerator = userResult.rows[0];

    const nombreToUpdate = nombre !== undefined ? nombre : currentModerator.nombre;
    const telefonoToUpdate = telefono !== undefined ? telefono : currentModerator.telefono;
    const activoToUpdate = activo !== undefined ? activo : true;

    let hashedPassword = currentModerator.password;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const result = await query(
      `UPDATE usuarios 
       SET nombre = $1, telefono = $2, password = $3, activo = $4 
       WHERE id = $5 AND rol = $6 
       RETURNING id, nombre, telefono, rol, activo`,
      [nombreToUpdate, telefonoToUpdate, hashedPassword, activoToUpdate, id, 'Moderador']
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar moderador:', error);
    return NextResponse.json({ error: 'Error al actualizar moderador' }, { status: 500 });
  }
}

// DELETE: Delete a moderator
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID no proporcionado' }, { status: 400 });
    }

    // Primero verificamos que sea un moderador
    const checkResult = await query('SELECT id FROM usuarios WHERE id = $1 AND rol = $2', [id, 'Moderador']);
    if (checkResult.rows.length === 0) {
      return NextResponse.json({ error: 'Moderador no encontrado' }, { status: 404 });
    }

    await query('BEGIN');

    try {
      // Eliminar registros de la bitácora del moderador
      await query('DELETE FROM bitacora_moderadores WHERE moderador_id = $1', [id]);
      
      // Eliminar el usuario
      await query('DELETE FROM usuarios WHERE id = $1 AND rol = $2', [id, 'Moderador']);

      await query('COMMIT');
      return NextResponse.json({ message: 'Moderador eliminado con éxito', id });
    } catch (err) {
      await query('ROLLBACK');
      throw err;
    }
  } catch (error) {
    console.error('Error al eliminar moderador:', error);
    return NextResponse.json({ error: 'Error al eliminar moderador' }, { status: 500 });
  }
}
