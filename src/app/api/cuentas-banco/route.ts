import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const res = await query(`
      SELECT id, nombre, banco, numero_cuenta, activa, creado_en 
      FROM cuentas_banco 
      ORDER BY id ASC
    `);
    return NextResponse.json(res.rows);
  } catch (error: any) {
    if (error.code === '42P01') {
      return NextResponse.json([]);
    }
    console.error('Error fetching cuentas_banco:', error);
    return NextResponse.json({ error: 'Error al obtener cuentas' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nombre, banco, numero_cuenta, activa } = body;

    if (!nombre || !banco || !numero_cuenta) {
      return NextResponse.json({ error: 'Nombre, banco y número de cuenta son obligatorios' }, { status: 400 });
    }

    const res = await query(
      `INSERT INTO cuentas_banco (nombre, banco, numero_cuenta, activa) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, nombre, banco, numero_cuenta, activa, creado_en`,
      [nombre.trim(), banco.trim(), numero_cuenta.trim(), activa !== false]
    );

    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    console.error('Error creating cuenta_banco:', error);
    return NextResponse.json({ error: error.message || 'Error al crear cuenta' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, nombre, banco, numero_cuenta, activa } = body;

    if (!id || !nombre || !banco || !numero_cuenta) {
      return NextResponse.json({ error: 'ID, nombre, banco y número de cuenta son obligatorios' }, { status: 400 });
    }

    const res = await query(
      `UPDATE cuentas_banco 
       SET nombre = $1, banco = $2, numero_cuenta = $3, activa = $4 
       WHERE id = $5 
       RETURNING id, nombre, banco, numero_cuenta, activa, creado_en`,
      [nombre.trim(), banco.trim(), numero_cuenta.trim(), activa !== false, id]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
    }

    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    console.error('Error updating cuenta_banco:', error);
    return NextResponse.json({ error: error.message || 'Error al actualizar cuenta' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de cuenta no especificado' }, { status: 400 });
    }

    await query('DELETE FROM cuentas_banco WHERE id = $1', [parseInt(id, 10)]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting cuenta_banco:', error);
    return NextResponse.json({ error: error.message || 'Error al eliminar cuenta' }, { status: 500 });
  }
}
