import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/recordatorios - Obtener todos los recordatorios
export async function GET(request: NextRequest) {
  try {
    const result = await query(
      `SELECT 
         id, 
         texto, 
         TO_CHAR(fecha, 'YYYY-MM-DD') as fecha,
         completado,
         fecha_creacion
       FROM recordatorios 
       ORDER BY fecha ASC, id DESC`
    );

    return NextResponse.json(result.rows);
  } catch (error: any) {
    // Si la tabla aún no existe, devolver lista vacía en lugar de romper la app
    if (error?.code === '42P01') {
      console.warn('La tabla recordatorios aún no ha sido creada.');
      return NextResponse.json([]);
    }
    console.error('Error al obtener recordatorios:', error);
    return NextResponse.json(
      { error: 'Error al obtener los recordatorios' },
      { status: 500 }
    );
  }
}

// POST /api/recordatorios - Crear un nuevo recordatorio
export async function POST(request: NextRequest) {
  try {
    const { texto, fecha } = await request.json();

    if (!texto || !texto.trim()) {
      return NextResponse.json(
        { error: 'El texto del recordatorio es obligatorio.' },
        { status: 400 }
      );
    }

    if (!fecha) {
      return NextResponse.json(
        { error: 'La fecha del recordatorio es obligatoria.' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO recordatorios (texto, fecha)
       VALUES ($1, $2)
       RETURNING id, texto, TO_CHAR(fecha, 'YYYY-MM-DD') as fecha, completado, fecha_creacion`,
      [texto.trim(), fecha]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error: any) {
    console.error('Error al crear recordatorio:', error);
    return NextResponse.json(
      { error: 'Error al crear el recordatorio.' },
      { status: 500 }
    );
  }
}

// PUT /api/recordatorios - Actualizar un recordatorio existente
export async function PUT(request: NextRequest) {
  try {
    const { id, texto, fecha, completado } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'El ID del recordatorio es requerido.' },
        { status: 400 }
      );
    }

    // Construcción de actualización dinámicas o estándar
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (texto !== undefined) {
      updates.push(`texto = $${paramIndex++}`);
      values.push(texto.trim());
    }

    if (fecha !== undefined) {
      updates.push(`fecha = $${paramIndex++}`);
      values.push(fecha);
    }

    if (completado !== undefined) {
      updates.push(`completado = $${paramIndex++}`);
      values.push(Boolean(completado));
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No se enviaron campos a actualizar.' },
        { status: 400 }
      );
    }

    values.push(id);
    const queryText = `
      UPDATE recordatorios 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex} 
      RETURNING id, texto, TO_CHAR(fecha, 'YYYY-MM-DD') as fecha, completado, fecha_creacion
    `;

    const result = await query(queryText, values);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Recordatorio no encontrado.' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error al actualizar recordatorio:', error);
    return NextResponse.json(
      { error: 'Error al actualizar el recordatorio.' },
      { status: 500 }
    );
  }
}

// DELETE /api/recordatorios - Eliminar un recordatorio
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'El id es requerido.' },
        { status: 400 }
      );
    }

    const result = await query(
      `DELETE FROM recordatorios WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Recordatorio no encontrado.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Recordatorio eliminado exitosamente.' });
  } catch (error: any) {
    console.error('Error al eliminar recordatorio:', error);
    return NextResponse.json(
      { error: 'Error al eliminar el recordatorio.' },
      { status: 500 }
    );
  }
}
