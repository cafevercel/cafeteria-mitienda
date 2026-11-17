import { NextRequest, NextResponse } from 'next/server';
import { processBusinessQueryOpenRouter, AVAILABLE_MODELS } from '@/lib/ai/openrouter';
import { processBusinessQuery } from '@/lib/ai/gemini';

export async function GET() {
  return NextResponse.json({
    modelos: AVAILABLE_MODELS,
    proveedor: process.env.OPENROUTER_API_KEY ? 'OpenRouter' : 'Gemini',
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { mensaje, modelo } = body;

    if (!mensaje || typeof mensaje !== 'string' || !mensaje.trim()) {
      return NextResponse.json(
        { error: 'El campo "mensaje" es requerido y no puede estar vacío.' },
        { status: 400 }
      );
    }

    let resultado;
    if (process.env.OPENROUTER_API_KEY) {
      resultado = await processBusinessQueryOpenRouter(mensaje.trim(), modelo);
    } else {
      resultado = await processBusinessQuery(mensaje.trim());
    }

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
