import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
    try {
        // 1. Add column if it doesn't exist
        await sql`
      ALTER TABLE ventas 
      ADD COLUMN IF NOT EXISTS precio_compra NUMERIC;
    `;

        // 2. Backfill data from products table
        // We update only records where precio_compra is NULL to avoid overwriting if run multiple times
        const updateResult = await sql`
      UPDATE ventas v 
      SET precio_compra = p.precio_compra 
      FROM productos p 
      WHERE v.producto = p.id 
      AND v.precio_compra IS NULL;
    `;

        return NextResponse.json({
            message: 'Migration successful',
            updatedRows: updateResult.rowCount
        });
    } catch (error: any) {
        console.error('Migration error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
