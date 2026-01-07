import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

// PUT /api/empleados/[id] - Actualizar empleado
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const { nombre, activo, password } = await request.json();

    // Validar que el empleado exista primero
    const existingResult = await query(
      'SELECT * FROM empleados WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    const existingEmpleado = existingResult.rows[0];
    const now = new Date().toISOString();

    // Si se proporciona nombre, validarlo
    if (nombre !== undefined && !nombre.trim()) {
      return NextResponse.json(
        { error: 'El nombre no puede estar vacío' },
        { status: 400 }
      );
    }

    // Si se proporciona una nueva contraseña, encriptarla
    if (password && password.trim()) {
      // Encriptar la nueva contraseña
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const result = await query(
        `UPDATE empleados SET
          nombre = COALESCE($1, nombre),
          activo = COALESCE($2, activo),
          updated_at = $3,
          password = $4
         WHERE id = $5 RETURNING *`,
        [nombre, activo, now, hashedPassword, id]
      );
      
      return NextResponse.json(result.rows[0]);
    } else {
      // Actualizar sin cambiar la contraseña
      const result = await query(
        `UPDATE empleados SET
          nombre = COALESCE($1, nombre),
          activo = COALESCE($2, activo),
          updated_at = $3
         WHERE id = $4 RETURNING *`,
        [nombre, activo, now, id]
      );
      
      return NextResponse.json(result.rows[0]);
    }
  } catch (error) {
    console.error('Error al actualizar empleado:', error);
    return NextResponse.json(
      { error: 'Error al actualizar empleado' },
      { status: 500 }
    );
  }
}

// DELETE /api/empleados/[id] - Eliminar empleado
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const result = await query(
      'DELETE FROM empleados WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Empleado eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar empleado:', error);
    return NextResponse.json(
      { error: 'Error al eliminar empleado' },
      { status: 500 }
    );
  }
}