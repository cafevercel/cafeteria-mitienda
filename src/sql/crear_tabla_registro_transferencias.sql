-- =========================================================================
-- MIGRACIÓN DE BASE DE DATOS: REGISTRO DE VENTAS POR TRANSFERENCIA
-- =========================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS registro_transferencias (
    id SERIAL PRIMARY KEY,
    vendedor_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    vendedor_nombre VARCHAR(150),
    cliente_nombre VARCHAR(255) NOT NULL,
    cliente_telefono VARCHAR(50) NOT NULL,
    cliente_carnet VARCHAR(50),
    numero_transaccion VARCHAR(100) NOT NULL,
    banco VARCHAR(100) NOT NULL,
    cuenta_banco_id INTEGER,
    cuenta_nombre VARCHAR(150),
    cuenta_numero VARCHAR(100),
    monto NUMERIC(10,2) NOT NULL,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    detalles JSONB DEFAULT '[]'::jsonb,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Si la tabla ya fue creada anteriormente, añadir nuevas columnas
ALTER TABLE registro_transferencias ADD COLUMN IF NOT EXISTS cliente_carnet VARCHAR(50);
ALTER TABLE registro_transferencias ADD COLUMN IF NOT EXISTS cuenta_banco_id INTEGER;
ALTER TABLE registro_transferencias ADD COLUMN IF NOT EXISTS cuenta_nombre VARCHAR(150);
ALTER TABLE registro_transferencias ADD COLUMN IF NOT EXISTS cuenta_numero VARCHAR(100);

-- Tabla de cuentas bancarias de la cafeteria/tienda
CREATE TABLE IF NOT EXISTS cuentas_banco (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    banco VARCHAR(100) NOT NULL,
    numero_cuenta VARCHAR(100) NOT NULL,
    activa BOOLEAN DEFAULT true NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Índices para búsqueda rápida y ordenamiento
CREATE INDEX IF NOT EXISTS idx_reg_transf_fecha ON registro_transferencias(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_reg_transf_vendedor ON registro_transferencias(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_reg_transf_num_transaccion ON registro_transferencias(numero_transaccion);
CREATE INDEX IF NOT EXISTS idx_reg_transf_telefono ON registro_transferencias(cliente_telefono);
CREATE INDEX IF NOT EXISTS idx_reg_transf_carnet ON registro_transferencias(cliente_carnet);
CREATE INDEX IF NOT EXISTS idx_reg_transf_banco ON registro_transferencias(banco);

COMMIT;
