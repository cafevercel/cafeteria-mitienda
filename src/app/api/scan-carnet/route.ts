import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

// Función para validar y extraer el Carné de Identidad de Cuba (11 dígitos con validación YYMMDD)
export function extractCubanCI(text: string): string {
  if (!text) return '';
  // Buscar secuencias de 11 dígitos numéricos
  const matches = text.match(/\b\d{11}\b/g) || [];
  for (const m of matches) {
    const month = parseInt(m.substring(2, 4), 10);
    const day = parseInt(m.substring(4, 6), 10);
    // Un carnet cubano válido tiene mes 01-12 y día 01-31
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return m;
    }
  }
  return (matches.length > 0 && matches[0]) ? matches[0] : '';
}

// Parser heurístico para texto de carnet cubano
export function parseCubanCarnetText(text: string) {
  if (!text) return { carnet: '', nombre: '', nombres: '', apellidos: '' };

  const carnet = extractCubanCI(text);
  let nombre = '';
  let apellidos = '';

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Buscar campo NOMBRE / FIRST NAME
    if (/NOMBRE/i.test(line) && !nombre) {
      const after = line.replace(/.*NOMBRE(\s*[\/\\]\s*FIRST\s*NAME)?[:\s]*/i, '').trim();
      if (after && !/FIRST\s*NAME/i.test(after) && after.length > 1) {
        nombre = after;
      } else if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (!/APELLIDO|FIRST|LAST|PADRE|MADRE|NI:|SEXO/i.test(nextLine)) {
          nombre = nextLine;
        }
      }
    }

    // Buscar campo APELLIDOS / LAST NAME
    if (/APELLIDO/i.test(line) && !apellidos) {
      const after = line.replace(/.*APELLIDOS?(\s*[\/\\]\s*LAST\s*NAME)?[:\s]*/i, '').trim();
      if (after && !/LAST\s*NAME/i.test(after) && after.length > 1) {
        apellidos = after;
      } else if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (!/NOMBRE|FIRST|LAST|PADRE|MADRE|NI:|SEXO/i.test(nextLine)) {
          apellidos = nextLine;
        }
      }
    }
  }

  // Si no se encontró por etiqueta, intentar buscar por posición
  if (!nombre && !apellidos) {
    const ignoreKeywords = [
      'REPUBLICA', 'REPÚBLICA', 'CUBA', 'CARNE', 'CARNÉ', 'IDENTIDAD', 'NI',
      'PADRE', 'MADRE', 'SEXO', 'FECHA', 'VENCIMIENTO', 'REGISTRO', 'CIVIL',
      'TOMO', 'FOLIO', 'AÑO', 'FIRST', 'LAST', 'NAME'
    ];
    const candidateLines = lines.filter(l => {
      const upper = l.toUpperCase();
      return !ignoreKeywords.some(kw => upper.includes(kw)) && !/^\d+$/.test(l) && l.length > 2;
    });

    if (candidateLines.length >= 2) {
      nombre = candidateLines[0];
      apellidos = candidateLines[1];
    } else if (candidateLines.length === 1) {
      nombre = candidateLines[0];
    }
  }

  // Limpiar caracteres no alfabéticos
  const cleanStr = (s: string) => s.replace(/^[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+|[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/g, '').trim();
  nombre = cleanStr(nombre);
  apellidos = cleanStr(apellidos);

  const nombreCompleto = [nombre, apellidos].filter(Boolean).join(' ');

  return { carnet, nombre: nombreCompleto, nombres: nombre, apellidos };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    let { imageBase64, imageMimeType = 'image/jpeg' } = body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json(
        { error: 'Debe proporcionar la imagen en formato base64 ("imageBase64").' },
        { status: 400 }
      );
    }

    // Extraer base64 limpio si viene con el prefijo "data:image/...;base64,"
    if (imageBase64.includes(';base64,')) {
      const parts = imageBase64.split(';base64,');
      const mimeMatch = parts[0].match(/data:(.*?)$/);
      if (mimeMatch && mimeMatch[1]) {
        imageMimeType = mimeMatch[1];
      }
      imageBase64 = parts[1];
    }

    // ─── ESTRATEGIA 1: Gemini AI Vision ─────────────────────────────────────────────
    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({
          model: MODEL_NAME,
          generationConfig: {
            temperature: 0.1, // Respuesta determinista y precisa
          },
        });

        const prompt = `Analiza detalladamente esta imagen de un Carné de Identidad de la República de Cuba.
Tu tarea es leer y extraer con la mayor precisión posible los datos del ciudadano:
1. "carnet": Número de Identidad (NI / Carnet de Identidad). Es un número exactamente de 11 dígitos numéricos (por ejemplo 04061765928). Devuelve SOLAMENTE los 11 dígitos, sin letras, guiones ni espacios.
2. "nombres": El o los nombres de pila del titular (campo NOMBRE / FIRST NAME, por ejemplo: GILBERTO).
3. "apellidos": Los apellidos paterno y materno del titular (campo APELLIDOS / LAST NAME, por ejemplo: HERNÁNDEZ ACOSTA).
4. "nombreCompleto": Nombre y apellidos juntos en mayúsculas (por ejemplo: GILBERTO HERNÁNDEZ ACOSTA).

IMPORTANTE: Responde ÚNICAMENTE un objeto JSON válido, sin bloques de código markdown, sin explicaciones ni texto adicional:
{
  "carnet": "04061765928",
  "nombres": "GILBERTO",
  "apellidos": "HERNÁNDEZ ACOSTA",
  "nombreCompleto": "GILBERTO HERNÁNDEZ ACOSTA"
}
Si algún dato no se puede leer, coloca "" en ese campo.`;

        const result = await model.generateContent([
          prompt,
          {
            inlineData: {
              data: imageBase64,
              mimeType: imageMimeType,
            },
          },
        ]);

        const rawResponse = result.response.text().trim();
        // Limpiar posible formato markdown ```json ... ```
        const jsonStr = rawResponse.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        
        try {
          const parsed = JSON.parse(jsonStr);
          let cleanCarnet = extractCubanCI(parsed.carnet || '') || (parsed.carnet ? String(parsed.carnet).replace(/\D/g, '') : '');
          let nombreCompleto = (parsed.nombreCompleto || `${parsed.nombres || ''} ${parsed.apellidos || ''}`).trim();

          if (cleanCarnet || nombreCompleto) {
            return NextResponse.json({
              success: true,
              carnet: cleanCarnet,
              nombre: nombreCompleto,
              nombres: parsed.nombres || '',
              apellidos: parsed.apellidos || '',
              metodo: 'gemini-vision',
            });
          }
        } catch (jsonErr) {
          console.warn('No se pudo parsear el JSON de Gemini, aplicando parser heurístico al texto plano:', rawResponse);
          const parsed = parseCubanCarnetText(rawResponse);
          if (parsed.carnet || parsed.nombre) {
            return NextResponse.json({
              success: true,
              ...parsed,
              metodo: 'gemini-text-fallback',
            });
          }
        }
      } catch (geminiError: any) {
        console.error('Error al procesar con Gemini Vision:', geminiError.message || geminiError);
      }
    }

    // ─── ESTRATEGIA 2: Fallback OCR externo (OCR.space o similar) ───────────────────
    try {
      const formData = new URLSearchParams();
      formData.append('base64Image', `data:${imageMimeType};base64,${imageBase64}`);
      formData.append('language', 'spa');
      formData.append('isOverlayRequired', 'false');
      formData.append('OCREngine', '2'); // Motor más preciso

      const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: {
          'apikey': 'helloworld', // Clave pública de prueba de OCR.space
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (ocrResponse.ok) {
        const ocrData = await ocrResponse.json();
        const extractedText = ocrData?.ParsedResults?.[0]?.ParsedText || '';
        if (extractedText) {
          const parsed = parseCubanCarnetText(extractedText);
          if (parsed.carnet || parsed.nombre) {
            return NextResponse.json({
              success: true,
              ...parsed,
              metodo: 'ocr-space',
            });
          }
        }
      }
    } catch (ocrErr: any) {
      console.warn('Fallback OCR.space no disponible:', ocrErr.message);
    }

    // Si ninguna estrategia logró extraer los datos
    return NextResponse.json(
      {
        success: false,
        error: 'No se pudieron extraer automáticamente los datos del carné de identidad.',
        sugerencia: 'Asegúrese de que el carné esté bien enfocado e iluminado, o ingrese los datos manualmente en el formulario.',
        geminiConfigured: !!apiKey,
      },
      { status: 422 }
    );
  } catch (error: any) {
    console.error('Error en /api/scan-carnet:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error interno del servidor al procesar el carné.',
      },
      { status: 500 }
    );
  }
}
