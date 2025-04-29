import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const nombre = request.nextUrl.searchParams.get('nombre');
        
        if (!nombre) {
            return NextResponse.json({ error: 'Nombre no proporcionado' }, { status: 400 });
        }

        const result = await query(
            'SELECT COUNT(*) as count FROM productos WHERE nombre = $1',
            [nombre]
        );

        const exists = result.rows[0].count > 0;

        return NextResponse.json({ exists });
    } catch (error) {
        console.error('Error verificando nombre:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
} 