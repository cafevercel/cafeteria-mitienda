// src/app/api/gastos-vendedores/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(request: NextRequest) {
    let client;

    try {
        const { searchParams } = new URL(request.url);
        const vendedorId = searchParams.get('vendedorId');
        const mes = searchParams.get('mes');
        const anio = searchParams.get('anio');
        const nombre = searchParams.get('nombre');

        if (!vendedorId || !mes || !anio) {
            return NextResponse.json(
                { error: 'Faltan parámetros requeridos: vendedorId, mes, anio' },
                { status: 400 }
            );
        }

        let query = `
      SELECT id, nombre, cantidad, fecha, vendedor_id, mes, anio 
      FROM gastos 
      WHERE vendedor_id = $1 AND mes = $2 AND anio = $3
    `;
        const params: any[] = [vendedorId, mes, anio];

        if (nombre) {
            query += ` AND nombre = $4`;
            params.push(nombre);
        }

        query += ` ORDER BY fecha DESC`;

        const result = await sql.query(query, params);
        return NextResponse.json(result.rows);
    } catch (error: any) {
        console.error('Error al obtener gastos:', error);
        return NextResponse.json(
            { error: 'Error al obtener gastos del vendedor', details: error.message },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { vendedorId, nombre, valor, mes, anio } = body;

        if (!vendedorId || !nombre || !valor || !mes || !anio) {
            return NextResponse.json(
                { error: 'Faltan campos requeridos: vendedorId, nombre, valor, mes, anio' },
                { status: 400 }
            );
        }

        // Crear fecha para el primer día del mes
        const fecha = new Date(anio, mes - 1, 1).toISOString();

        const query = `
      INSERT INTO gastos (nombre, cantidad, fecha, vendedor_id, mes, anio)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
        const params = [nombre, valor, fecha, vendedorId, mes, anio];

        const result = await sql.query(query, params);
        return NextResponse.json(result.rows[0], { status: 201 });
    } catch (error: any) {
        console.error('Error al crear gasto:', error);
        return NextResponse.json(
            { error: 'Error al crear gasto del vendedor', details: error.message },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const vendedorId = searchParams.get('vendedorId');
        const nombre = searchParams.get('nombre');
        const mes = searchParams.get('mes');
        const anio = searchParams.get('anio');

        if (!vendedorId || !nombre || !mes || !anio) {
            return NextResponse.json(
                { error: 'Faltan parámetros requeridos: vendedorId, nombre, mes, anio' },
                { status: 400 }
            );
        }

        const query = `
      DELETE FROM gastos 
      WHERE vendedor_id = $1 AND nombre = $2 AND mes = $3 AND anio = $4
    `;
        const params = [vendedorId, nombre, mes, anio];

        await sql.query(query, params);
        return NextResponse.json({ message: 'Gasto eliminado correctamente' });
    } catch (error: any) {
        console.error('Error al eliminar gasto:', error);
        return NextResponse.json(
            { error: 'Error al eliminar gasto del vendedor', details: error.message },
            { status: 500 }
        );
    }
}
