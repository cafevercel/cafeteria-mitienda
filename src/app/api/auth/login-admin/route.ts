import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function POST(request: NextRequest) {
  try {
    const { nombre, password } = await request.json();

    if (!nombre || !password) {
      return NextResponse.json(
        { error: 'Nombre y contraseña son requeridos' },
        { status: 400 }
      );
    }

    // Buscar usuario administrador por nombre
    const result = await query(
      'SELECT * FROM usuarios WHERE nombre = $1 AND rol = $2',
      [nombre, 'Almacen']
    );
    const usuarios = result.rows;

    if (usuarios.length === 0) {
      return NextResponse.json(
        { error: 'Administrador no encontrado' },
        { status: 401 }
      );
    }

    const usuario = usuarios[0];

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, usuario.password);
    
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    // Generar token JWT
    const token = jwt.sign(
      {
        id: usuario.id,
        nombre: usuario.nombre,
        rol: usuario.rol
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: usuario.id,
        nombre: usuario.nombre,
        rol: usuario.rol
      }
    });

  } catch (error) {
    console.error('Error en login de administrador:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}