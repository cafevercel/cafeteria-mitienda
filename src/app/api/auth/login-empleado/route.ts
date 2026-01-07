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

    // Buscar empleado por nombre
    const result = await query(
      'SELECT * FROM empleados WHERE nombre = $1 AND activo = TRUE',
      [nombre]
    );
    const empleados = result.rows;

    if (empleados.length === 0) {
      return NextResponse.json(
        { error: 'Credenciales inválidas o empleado inactivo' },
        { status: 401 }
      );
    }

    const empleado = empleados[0];

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, empleado.password);
    
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    // Obtener información del punto de venta asociado
    const usuariosResult = await query(
      'SELECT id, nombre, rol FROM usuarios WHERE id = $1',
      [empleado.usuario_id]
    );
    const usuarios = usuariosResult.rows;

    if (usuarios.length === 0) {
      return NextResponse.json(
        { error: 'Punto de venta no encontrado' },
        { status: 404 }
      );
    }

    const usuario = usuarios[0];

    // Generar token JWT
    const token = jwt.sign(
      {
        empleadoId: empleado.id,
        empleadoNombre: empleado.nombre,
        usuarioId: usuario.id,
        usuarioNombre: usuario.nombre,
        rol: 'Vendedor' // Los empleados siempre tienen rol Vendedor
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
        rol: 'Vendedor',
        empleadoId: empleado.id,
        empleadoNombre: empleado.nombre
      }
    });

  } catch (error) {
    console.error('Error en login de empleado:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}