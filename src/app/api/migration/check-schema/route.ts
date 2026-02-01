import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
    try {
        const result = await sql`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('ventas', 'transacciones', 'productos')
      ORDER BY table_name, column_name;
    `;

        // Also check if 'ventas' is a view
        const views = await sql`
      SELECT table_name, view_definition 
      FROM information_schema.views 
      WHERE table_name = 'ventas';
    `;

        return NextResponse.json({
            columns: result.rows,
            views: views.rows
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
