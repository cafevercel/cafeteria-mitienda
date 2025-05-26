import { sql } from '@vercel/postgres';

// Función para generar un token aleatorio para evitar caché
function generateNoCacheToken() {
  return `_nocache=${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

// Función para añadir comentario SQL que evita caché
function addNoCacheComment(query: string): string {
  // Añadir un comentario SQL con un token aleatorio para evitar caché
  return `/* ${generateNoCacheToken()} */ ${query}`;
}

export async function query(text: string, params?: any[]) {
  try {
    // Modificar la consulta para evitar caché
    const noCacheQuery = addNoCacheComment(text);
    
    console.log('Executing query:', noCacheQuery, 'with params:', params);
    
    // Forzar una nueva conexión para cada consulta
    const result = await sql.query(noCacheQuery, params);
    
    console.log('Query result:', result);
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}