-- Actualizar contraseña del administrador 'almacen' con hash correcto para 'Mercado.25'
-- El hash correcto para 'Mercado.25' es: $2b$10$ItGYdyqTLOTxVzd.KBPlFeYnNSo63dxcq0xWtAiNmBBW0ANfFtnpy

UPDATE usuarios 
SET password = '$2b$10$ItGYdyqTLOTxVzd.KBPlFeYnNSo63dxcq0xWtAiNmBBW0ANfFtnpy'
WHERE nombre = 'almacen' AND rol = 'Almacen';

-- Verificar la actualización
SELECT id, nombre, password, rol FROM usuarios WHERE nombre = 'almacen' AND rol = 'Almacen';