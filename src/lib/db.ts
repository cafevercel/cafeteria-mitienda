import { sql } from '@vercel/postgres';

export async function query(text: string, params?: any[]) {
  try {
    console.log('Executing query:', text, 'with params:', params);
    const result = await sql.query(text, params);
    console.log('Query result:', result);
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}