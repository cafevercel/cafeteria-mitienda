import { NextRequest, NextResponse } from 'next/server';
import { processBusinessQuery } from '@/lib/ai/gemini';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { mensaje } = body;

    if (!mensaje || typeof mensaje !== 'string' || !mensaje.trim()) {
      return NextResponse.json(
        { error: 'El campo "mensaje" es requerido y no puede estar vacío.' },
        { status: 400 }
      );
    }

    const resultado = await processBusinessQuery(mensaje.trim());

    return NextResponse.json(resultado, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    console.error('Error en API /api/ai/chat:', error);
    return NextResponse.json(
      {
        error: error.message || 'Error interno al procesar la solicitud con IA.',
        respuesta: 'Ocurrió un error inesperado al procesar tu consulta. Por favor, intenta de nuevo.',
      },
      { status: 500 }
    );
  }
}
