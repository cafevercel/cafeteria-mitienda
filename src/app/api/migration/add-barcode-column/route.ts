
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    console.log('Running migration: adding codigo_barras to productos');
    
    // Check if column exists
    const checkColumn = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'productos' AND column_name = 'codigo_barras'
    `);

    if (checkColumn.rows.length === 0) {
      await query('ALTER TABLE productos ADD COLUMN codigo_barras VARCHAR(255) UNIQUE');
      return NextResponse.json({ success: true, message: 'Column codigo_barras added successfully' });
    } else {
      return NextResponse.json({ success: true, message: 'Column codigo_barras already exists' });
    }
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
