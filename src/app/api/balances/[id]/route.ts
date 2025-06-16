import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;

        // Verificar si el balance existe
        const checkResult = await query('SELECT id FROM balances WHERE id = $1', [id]);

        if (checkResult.rows.length === 0) {
            return NextResponse.json(
                { error: 'Balance no encontrado' }, 
                { 
                    status: 404,
                    headers: {
                        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
                    }
                }
            );
        }

        // Eliminar el balance
        await query('DELETE FROM balances WHERE id = $1', [id]);

        // Revalidar las páginas que muestran balances
        revalidatePath('/admin/balances');
        revalidatePath('/balances');
        revalidatePath('/admin');
        revalidatePath('/');

        return NextResponse.json(
            { message: 'Balance eliminado correctamente' },
            {
                headers: {
                    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            }
        );
    } catch (error) {
        console.error('Error al eliminar balance:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' }, 
            { 
                status: 500,
                headers: {
                    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
                }
            }
        );
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;

        const result = await query(`
      SELECT 
        id, 
        fecha_inicio as "fechaInicio", 
        fecha_fin as "fechaFin", 
        ganancia_bruta as "gananciaBruta", 
        gastos, 
        total_gastos as "totalGastos", 
        ganancia_neta as "gananciaNeta", 
        fecha_creacion as "fechaCreacion"
      FROM balances
      WHERE id = $1
    `, [id]);

        if (result.rows.length === 0) {
            return NextResponse.json(
                { error: 'Balance no encontrado' }, 
                { 
                    status: 404,
                    headers: {
                        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
                    }
                }
            );
        }

        // Convertir los gastos de JSON a objetos JavaScript
        const balance = {
            ...result.rows[0],
            gastos: result.rows[0].gastos || []
        };

        return NextResponse.json(balance, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
    } catch (error) {
        console.error('Error al obtener balance:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' }, 
            { 
                status: 500,
                headers: {
                    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
                }
            }
        );
    }
}
