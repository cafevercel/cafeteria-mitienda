import { NextRequest, NextResponse } from 'next/server';
import { processBusinessQueryOpenRouter, AVAILABLE_MODELS } from '@/lib/ai/openrouter';
import { processBusinessQuery } from '@/lib/ai/gemini';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const proveedor = process.env.OPENROUTER_API_KEY ? 'OpenRouter' : 'Gemini';
  return NextResponse.json({
    proveedor,
    openrouterConfigurado: Boolean(process.env.OPENROUTER_API_KEY),
    geminiConfigurado: Boolean(process.env.GEMINI_API_KEY),
    modelos: AVAILABLE_MODELS,
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
    let proveedor = 'OpenRouter';

    if (process.env.OPENROUTER_API_KEY) {
      resultado = await processBusinessQueryOpenRouter(mensaje.trim(), modelo);
      proveedor = 'OpenRouter';
    } else {
      resultado = await processBusinessQuery(mensaje.trim());
      proveedor = 'Gemini';
    }

    return NextResponse.json({
      ...resultado,
      proveedor,
      modeloUsadoId: modelo || (proveedor === 'OpenRouter' ? 'nvidia/nemotron-3.5-lightning:free' : 'gemini-3.5-flash'),
    }, {
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
