import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/salarios - Obtener salarios por usuario_id (punto de venta)
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

    // Obtener salarios con información de empleados
    const result = await query(
      `SELECT 
         s.id,
         s.usuario_id,
         s.empleado_id,
         s.salario,
         s.activo,
         s.created_at,
         s.updated_at,
         e.nombre as empleado_nombre
       FROM salarios s
       JOIN empleados e ON s.empleado_id = e.id
       WHERE s.usuario_id = $1
       ORDER BY e.nombre ASC`,
      [usuario_id]
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error al obtener salarios:', error);
    return NextResponse.json(
      { error: 'Error al obtener salarios' },
      { status: 500 }
    );
  }
}

// POST /api/salarios - Crear o actualizar salario
export async function POST(request: NextRequest) {
  try {
    const { usuario_id, empleado_id, salario } = await request.json();

    if (!usuario_id || !empleado_id || salario === undefined) {
      return NextResponse.json(
        { error: 'El usuario_id, empleado_id y salario son requeridos' },
        { status: 400 }
      );
    }

    // Verificar si ya existe un salario para este empleado
    const existingResult = await query(
      `SELECT id FROM salarios WHERE empleado_id = $1 AND activo = true`,
      [empleado_id]
    );

    if (existingResult.rows.length > 0) {
      // Actualizar salario existente
      const result = await query(
        `UPDATE salarios 
         SET salario = $1, updated_at = CURRENT_TIMESTAMP
         WHERE empleado_id = $2 AND activo = true
         RETURNING *`,
        [salario, empleado_id]
      );
      return NextResponse.json(result.rows[0]);
    } else {
      // Crear nuevo salario
      const result = await query(
        `INSERT INTO salarios (usuario_id, empleado_id, salario, activo)
         VALUES ($1, $2, $3, true)
         RETURNING *`,
        [usuario_id, empleado_id, salario]
      );
      return NextResponse.json(result.rows[0]);
    }
  } catch (error) {
    console.error('Error al crear/actualizar salario:', error);
    return NextResponse.json(
      { error: 'Error al crear/actualizar salario' },
      { status: 500 }
    );
  }
}

// PUT /api/salarios - Actualizar salario existente
export async function PUT(request: NextRequest) {
  try {
    const { id, salario } = await request.json();

    if (!id || salario === undefined) {
      return NextResponse.json(
        { error: 'El id y salario son requeridos' },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE salarios 
       SET salario = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [salario, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Salario no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar salario:', error);
    return NextResponse.json(
      { error: 'Error al actualizar salario' },
      { status: 500 }
    );
  }
}

// DELETE /api/salarios - Eliminar salario
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'El id es requerido' },
        { status: 400 }
      );
    }

    const result = await query(
      `DELETE FROM salarios WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Salario no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Salario eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar salario:', error);
    return NextResponse.json(
      { error: 'Error al eliminar salario' },
      { status: 500 }
    );
  }
}