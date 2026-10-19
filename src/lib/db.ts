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
      CREATE TABLE IF NOT EXISTS registro_transferencias (
        id SERIAL PRIMARY KEY,
        vendedor_id INTEGER,
        vendedor_nombre VARCHAR(150),
        cliente_nombre VARCHAR(255) NOT NULL,
        cliente_telefono VARCHAR(50) NOT NULL,
        numero_transaccion VARCHAR(100) NOT NULL,
        banco VARCHAR(100) NOT NULL,
        monto NUMERIC(10,2) NOT NULL,
        fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        detalles JSONB DEFAULT '[]'::jsonb,
        creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_reg_transf_fecha ON registro_transferencias(fecha DESC);
      CREATE INDEX IF NOT EXISTS idx_reg_transf_vendedor ON registro_transferencias(vendedor_id);
      CREATE INDEX IF NOT EXISTS idx_reg_transf_num_transaccion ON registro_transferencias(numero_transaccion);
    `);
    schemaInitialized = true;
    console.log('✅ Esquema de base de datos verificado y actualizado.');
  } catch (err) {
    console.error('⚠️ Warning initializing schema (silent fallback):', err);
  }
}

export async function query(text: string, params?: any[]) {
  try {
    if (process.env.RUN_DB_MIGRATIONS === 'true') {
      await ensureDbSchema();
    }
    const result = await sql.query(text, params);
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}