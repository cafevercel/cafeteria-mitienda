import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { cloudinary } from '@/lib/cloudinary';

// Constantes de validación
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB para el archivo inicial
const TARGET_FILE_SIZE = 1 * 1024 * 1024; // 1MB objetivo
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_DIMENSION = 2000;
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

async function compressImage(buffer: Buffer, targetSize: number = TARGET_FILE_SIZE): Promise<Buffer> {
  let quality = 80;
  let processedBuffer = await sharp(buffer)
    .webp({ quality })
    .toBuffer();
  
  // Si el tamaño sigue siendo mayor a 1MB, reducir la calidad gradualmente
  while (processedBuffer.length > targetSize && quality > 10) {
    quality -= 5;
    processedBuffer = await sharp(buffer)
      .webp({ quality })
      .toBuffer();
  }

  return processedBuffer;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    // Validaciones iniciales
    if (!file) {
      return NextResponse.json(
        { error: 'No se proporcionó ningún archivo' },
        { status: 400 }
      );
    }

    // Validar tipo de archivo
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de archivo no permitido' },
        { status: 400 }
      );
    }

    // Validar tamaño inicial
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'El archivo excede el tamaño máximo permitido' },
        { status: 400 }
      );
    }

    // Convertir a buffer
    const buffer = await file.arrayBuffer();
    const imageBuffer = Buffer.from(buffer);

    // Obtener metadata de la imagen
    const metadata = await sharp(imageBuffer).metadata();

    // Calcular dimensiones optimizadas
    let targetWidth = DEFAULT_WIDTH;
    let targetHeight = DEFAULT_HEIGHT;

    if (metadata.width && metadata.height) {
      // Si la imagen es más grande que MAX_DIMENSION, la redimensionamos proporcionalmente
      if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
        const aspectRatio = metadata.width / metadata.height;
        if (metadata.width > metadata.height) {
          targetWidth = MAX_DIMENSION;
          targetHeight = Math.round(MAX_DIMENSION / aspectRatio);
        } else {
          targetHeight = MAX_DIMENSION;
          targetWidth = Math.round(MAX_DIMENSION * aspectRatio);
        }
      } else {
        // Si la imagen es más pequeña que DEFAULT_WIDTH, mantenemos sus dimensiones originales
        targetWidth = Math.min(metadata.width, DEFAULT_WIDTH);
        targetHeight = Math.round((targetWidth * metadata.height) / metadata.width);
      }
    }

    // Primero redimensionar
    let processedImageBuffer = await sharp(imageBuffer)
      .resize(targetWidth, targetHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .toBuffer();

    // Luego comprimir si es necesario
    if (processedImageBuffer.length > TARGET_FILE_SIZE) {
      processedImageBuffer = await compressImage(processedImageBuffer);
    }

    // Generar nombre único
    const uniqueFilename = `${Date.now()}-${file.name.replace(/\.[^/.]+$/, "")}`;

    // Subir a Cloudinary con tipado
    interface CloudinaryUploadResult {
      secure_url: string;
      public_id: string;
      width: number;
      height: number;
      format: string;
      resource_type: string;
      bytes: number;
      created_at: string;
    }

    const uploadResult = await new Promise<CloudinaryUploadResult>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            resource_type: 'image',
            folder: 'mi-aplicacion',
            public_id: uniqueFilename,
            format: 'webp',
            transformation: [
              { quality: 'auto:good' },
              { fetch_format: 'auto' },
              { flags: 'sanitize' },
            ],
            tags: ['web-upload'],
          },
          (error, result) => {
            if (error) reject(error);
            if (!result) reject(new Error('No se recibió resultado de Cloudinary'));
            resolve(result as CloudinaryUploadResult);
          }
        )
        .end(processedImageBuffer);
    });

    // Preparar respuesta
    const response = {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      width: uploadResult.width,
      height: uploadResult.height,
      format: uploadResult.format,
      resourceType: uploadResult.resource_type,
      size: uploadResult.bytes,
      createdAt: uploadResult.created_at,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error en el proceso de upload:', error);
    return NextResponse.json(
      { 
        error: 'Error al procesar o subir el archivo',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}
