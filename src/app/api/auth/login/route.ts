import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  const { nombre, password }: { nombre: string; password: string } = await request.json();

  const result = await query('SELECT * FROM usuarios WHERE nombre = $1', [nombre]);
  const user = result.rows[0];

  console.log('Usuario encontrado:', user); // Para depuración

  if (!user || user.password !== password) {
    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
  }

  // Verificar si el usuario está activo (solo para vendedores)
  if (user.rol === 'Vendedor' && user.activo === false) {
    return NextResponse.json({ 
      error: 'Acceso denegado. Por favor, póngase en contacto con el administrador.' 
    }, { status: 403 });
  }

  // Return user data directly without token
  return NextResponse.json({
    id: user.id.toString(),
    nombre: user.nombre,
    rol: user.rol
  });
}
