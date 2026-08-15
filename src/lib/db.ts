import { sql } from '@vercel/postgres';

let schemaInitialized = false;

export async function ensureDbSchema() {
  if (schemaInitialized) return;
  try {
    await sql.query(`
      ALTER TABLE ventas ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(20) DEFAULT 'efectivo';
      ALTER TABLE ventas ADD COLUMN IF NOT EXISTS monto_efectivo NUMERIC(10,2) DEFAULT 0;
      ALTER TABLE ventas ADD COLUMN IF NOT EXISTS monto_transferencia NUMERIC(10,2) DEFAULT 0;
      ALTER TABLE gastos ADD COLUMN IF NOT EXISTS tipo_gasto VARCHAR(20) DEFAULT 'fijo';
      CREATE TABLE IF NOT EXISTS salarios_mensuales (
        id SERIAL PRIMARY KEY,
        usuario_id TEXT NOT NULL,
        mes INT NOT NULL,
        anio INT NOT NULL,
        salario NUMERIC(10,2) NOT NULL,
        UNIQUE(usuario_id, mes, anio)
      );
    `);
    schemaInitialized = true;
    console.log('✅ Esquema de base de datos verificado y actualizado.');
  } catch (err) {
    console.error('⚠️ Warning initializing schema (silent fallback):', err);
  }
}

export async function query(text: string, params?: any[]) {
  try {
    await ensureDbSchema();
    console.log('Executing query:', text, 'with params:', params);
    const result = await sql.query(text, params);
    console.log('Query result:', result);
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}