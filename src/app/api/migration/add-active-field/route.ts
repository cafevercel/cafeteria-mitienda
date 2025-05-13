import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST() {
  try {
    // Verificar si la columna ya existe para no crear duplicados
    const checkColumnExists = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'usuarios' AND column_name = 'activo'
    `);

    if (checkColumnExists.rows.length === 0) {
      // La columna no existe, así que la añadimos
      await query(`
        ALTER TABLE usuarios 
        ADD COLUMN activo BOOLEAN NOT NULL DEFAULT TRUE
      `);
      
      return NextResponse.json({ 
        success: true, 
        message: 'Campo "activo" añadido correctamente a la tabla usuarios' 
      });
    } else {
      return NextResponse.json({ 
        success: true, 
        message: 'El campo "activo" ya existe en la tabla usuarios' 
      });
    }
  } catch (error) {
    console.error('Error al añadir el campo activo:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Error al modificar la tabla usuarios' 
    }, { status: 500 });
  }
} 