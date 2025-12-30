import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Endpoint para verificar la estructura de la tabla
export async function GET() {
    try {
        // Verificar estructura de usuario_productos
        const tableStructure = await query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'usuario_productos'
      ORDER BY ordinal_position
    `);

        // Verificar estructura de usuarios
        const usuariosStructure = await query(`
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'usuarios'
      ORDER BY ordinal_position
    `);

        // Verificar si existe tabla cocina
        const cocinaExists = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'cocina'
      )
    `);

        // Verificar constraints
        const constraints = await query(`
      SELECT
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'usuario_productos'
    `);

        return NextResponse.json({
            usuario_productos: tableStructure.rows,
            usuarios: usuariosStructure.rows,
            cocina_exists: cocinaExists.rows[0].exists,
            constraints: constraints.rows
        });

    } catch (error) {
        console.error('Error verificando estructura:', error);
        return NextResponse.json({
            error: 'Error al verificar estructura',
            details: error instanceof Error ? error.message : 'Error desconocido'
        }, { status: 500 });
    }
}
