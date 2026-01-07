-- Script para actualizar la contraseña del administrador 'almacen' con bcrypt
-- Ejecutar esto en la base de datos para que el login funcione

-- Opción 1: Actualizar con contraseña encriptada 'Mercado.25'
-- El hash bcrypt para 'Mercado.25' es: $2a$10$DAy22J/J6YoKnpEUDHUmFeMOl5vyv34FPvRg.SxteA9CvMxlA.myO

UPDATE usuarios 
SET password = '$2a$10$DAy22J/J6YoKnpEUDHUmFeMOl5vyv34FPvRg.SxteA9CvMxlA.myO'
WHERE nombre = 'almacen' AND rol = 'Almacen';

-- Opción 2: Si necesitas crear un nuevo administrador con contraseña encriptada
-- INSERT INTO usuarios (nombre, password, rol, activo) 
-- VALUES ('admin', '$2a$10$DAy22J/J6YoKnpEUDHUmFeMOl5vyv34FPvRg.SxteA9CvMxlA.myO', 'Almacen', true);

-- Verificar el resultado
SELECT id, nombre, rol, activo FROM usuarios WHERE rol = 'Almacen';