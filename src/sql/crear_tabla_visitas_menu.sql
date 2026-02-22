-- Crear tabla para registrar visitas del menú online (PostgreSQL)
-- Esta tabla almacena las visitas que recibe el menú en https://menu-mercado.vercel.app/

CREATE TABLE IF NOT EXISTS visitas_menu (
    id SERIAL PRIMARY KEY,
    url VARCHAR(500) NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    referrer VARCHAR(500)
);

-- Índices para mejorar el rendimiento de las consultas
CREATE INDEX IF NOT EXISTS idx_url ON visitas_menu(url);
CREATE INDEX IF NOT EXISTS idx_fecha ON visitas_menu(fecha);
CREATE INDEX IF NOT EXISTS idx_fecha_url ON visitas_menu(fecha, url);

-- Tabla opcional para estadísticas diarias (materialized view alternativa)
CREATE TABLE IF NOT EXISTS visitas_menu_diarias (
    id SERIAL PRIMARY KEY,
    fecha DATE NOT NULL,
    url VARCHAR(500) NOT NULL,
    visitas INT DEFAULT 0,
    CONSTRAINT unique_fecha_url UNIQUE (fecha, url)
);

CREATE INDEX IF NOT EXISTS idx_fecha_diaria ON visitas_menu_diarias(fecha);