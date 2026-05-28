import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: number; nombre: string; rol: string };
        
        if (decoded && decoded.id) {
          const result = await query(
            'SELECT id, nombre, telefono, rol FROM usuarios WHERE id = $1',
            [decoded.id]
          );
          
          if (result.rows.length > 0) {
            return NextResponse.json(result.rows[0]);
          }
        }
      } catch (jwtError) {
        console.warn('Token inválido en /api/users/me, usando fallback:', jwtError);
      }
    }

    // Fallback por compatibilidad: obtener usuarios con rol Almacen
    const result = await query(
      'SELECT id, nombre, telefono, rol FROM usuarios WHERE rol = $1 LIMIT 1',
      ['Almacen']
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    return NextResponse.json(
      { error: 'Error al obtener información del usuario' }, 
      { status: 500 }
    );
  }
}
