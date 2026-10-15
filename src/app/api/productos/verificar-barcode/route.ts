
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const barcode = request.nextUrl.searchParams.get('barcode');
        const excludeId = request.nextUrl.searchParams.get('excludeId');
        
        if (!barcode) {
            return NextResponse.json({ 
                error: 'Código de barras no proporcionado' 
            }, { status: 400 });
        }

        let sql = 'SELECT COUNT(*) as count FROM productos WHERE codigo_barras = $1';
        const params: any[] = [barcode.trim()];

        if (excludeId) {
            sql += ' AND id != $2';
            params.push(excludeId);
        }

        const result = await query(sql, params);
        const exists = parseInt(result.rows[0].count) > 0;

        return NextResponse.json({ exists });
    } catch (error) {
        console.error('Error verificando código de barras:', error);
        return NextResponse.json({ 
            error: 'Error interno del servidor' 
        }, { status: 500 });
    }
}
