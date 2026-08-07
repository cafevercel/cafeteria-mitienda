-- Crear tabla para almacenar recordatorios del almacén en PostgreSQL
CREATE TABLE IF NOT EXISTS recordatorios (
    id SERIAL PRIMARY KEY,
    texto TEXT NOT NULL,
    fecha DATE NOT NULL,
    completado BOOLEAN DEFAULT FALSE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_recordatorios_fecha ON recordatorios(fecha);
CREATE INDEX IF NOT EXISTS idx_recordatorios_completado ON recordatorios(completado);
