# Documentación del Backend para la App Móvil de Ventas

Este documento proporciona la información necesaria para conectar la nueva aplicación móvil con el backend existente, detallando las tablas relevantes y los endpoints específicos para la operativa de un vendedor en su dispositivo.

---

## 📊 Tablas de la Base de Datos Involucradas

Para el funcionamiento de la aplicación móvil (login, visualización de catálogo y registro de ventas), el sistema interactúa principalmente con las siguientes tablas:

### 1. `empleados` (Autenticación)
Es la tabla donde se almacenan las credenciales de los trabajadores que inician sesión en la app.
- `id`: Varchar (UUID, PK)
- `nombre`: Varchar (Usuario para el login)
- `password`: Varchar (Contraseña encriptada con bcrypt)
- `usuario_id`: Integer (Clave foránea hacia `usuarios.id`, representa el punto de venta o local asignado)
- `activo`: Boolean (Debe ser `TRUE` para permitir el login)

### 2. `usuarios` (Punto de Venta)
Almacena la información del local o punto de venta. La app interactúa en representación de un `usuario` (vendedor) a través de un `empleado`.
- `id`: Integer (PK)
- `nombre`: Varchar (Nombre del punto de venta)
- `rol`: Varchar (Generalmente 'Vendedor')

### 3. Información del Catálogo e Inventario
- **`productos`**: Catálogo base. Contiene el nombre, foto, precio de venta, identificador de variantes (`tiene_parametros`).
- **`usuario_productos`**: Inventario específico del vendedor. Define cuántas unidades de cada producto (`cantidad`) tiene disponibles el `usuario_id` en su local.
- **`usuario_producto_parametros`**: Si el producto cuenta con variaciones (ej. tallas, colores), indica la `cantidad` disponible de cada variación (`nombre`) para ese `usuario_id`.

### 4. Registro de Ventas
- **`ventas`**: Tabla histórica. Registra el `vendedor` (usuario_id), `producto` (ID del producto), `cantidad`, `precio_unitario`, `precio_compra` y `fecha`. 
- **`venta_parametros`**: Detalle de las ventas de productos que tienen variaciones (indica qué variante específica y la cantidad vendida en una transacción).

---

## 🛣️ Endpoints de la API para la App Móvil

A continuación, se describen los _endpoints_ que la app debe consumir para su operativa normal. 

### 1. Autenticación (Login)
**Endpoint:** `POST /api/auth/login-empleado`

**Propósito:** Validar las credenciales del trabajador y obtener la información de sesión junto con el punto de venta al que pertenece.
**Body Requerido:**
```json
{
  "nombre": "nombre_empleado",
  "password": "contraseña123"
}
```
**Respuesta Exitosa (200 OK):**
```json
{
  "success": true,
  "token": "eyJh... (JWT string)", 
  "user": {
    "id": 2,                           // ID del Punto de Venta (usuario_id) indispensable para otras peticiones
    "nombre": "Punto de Venta X",      // Nombre del local al que pertenece el empleado
    "rol": "Vendedor",
    "empleadoId": "uuid-del-empleado", 
    "empleadoNombre": "nombre_empleado"
  }
}
```
> **Nota:** La app debe almacenar tanto el `token` (para posibles futuras peticiones autenticadas de manera global) como el `user.id` (`vendedorId`), ya que este último es clave para obtener el inventario y sincronizar ventas.

### 2. Obtener el Catálogo del Vendedor
**Endpoint:** `GET /api/users/productos/[vendedorId]`

**Propósito:** Descargar todo el inventario de productos asignado al punto de venta específico. Este es el endpoint principal que la app debe consumir al iniciar (o al presionar un botón de refrescar) para guardar localmente y poder operar offline.
**Respuesta Exitosa (200 OK):**
Devuelve un arreglo de objetos con los datos de los productos. Ejemplo:
```json
[
  {
    "id": 15,
    "nombre": "Café Americano",
    "precio": 2.50,
    "cantidad": 50,                         // Stock genérico disponible para el vendedor
    "foto": "url_imagen.jpg",
    "tiene_parametros": true,               // Indica si el producto tiene opciones (variantes)
    "tieneParametros": true,                // Alias incluido en la respuesta
    "precio_compra": 1.00,
    "seccion": "Bebidas Calientes",
    "parametros": [                         // Si 'tiene_parametros' es true, incluye el detalle y stock de variantes
      { "nombre": "Pequeño", "cantidad": 20 },
      { "nombre": "Grande", "cantidad": 30 }
    ]
  }
]
```

### 3. Sincronizar Ventas Offline (Bulk Registration)
**Endpoint:** `POST /api/ventas/bulk`

**Propósito:** Enviar un lote de ventas registradas (ya sean transacciones hechas sin conexión a Internet o en tiempo real) hacia el servidor en un solo viaje. El backend valida el stock, registra la venta y descuenta la cantidad de existencias.

**Body Requerido:**
```json
{
  "vendedorId": 2,                    // Extraído del login (user.id)
  "sales": [
    {
      "id_local": "uuid-interno-de-la-app", // ID temporal usado en SQLite local para reconciliación
      "productoId": 15,
      "cantidad": 1,
      "fecha": "2026-03-18T10:00:00Z",
      "parametros": [                     // Opcional, requerido solo si el producto 'tiene_parametros'
        { "nombre": "Pequeño", "cantidad": 1 }
      ]
    }
  ]
}
```

**Respuesta Exitosa (200 OK):**
```json
{
  "success": true,                    // 'false' si hubo algún error en alguna venta del lote
  "synced": [                         // Lista de ventas procesadas con éxito
    { 
      "id_local": "uuid-interno-de-la-app", 
      "server_id": 1024,              // ID definitivo de la tabla ventas en el backend 
      "status": "synced" 
    }
  ],
  "errors": [                         // Lista de ventas fallidas por validaciones (ej. falta de stock)
    { 
      "id_local": "uuid-interno-de-la-app-2", 
      "error": "Stock insuficiente para Pequeño" 
    }
  ]
}
```
> **Flujo recomendado en la App:** 
> 1. Iterar sobre la lista de `synced` y, en la base de datos local (SQLite), marcar estas ventas como sincrónizadas y actualizar el registro quitándolo de la lista pendiente.
> 2. Iterar sobre la lista de `errors` y notificar al empleado que hubo errores específicos (ej. por stock excedido), deteniendo la venta de este registro y marcándolo pendiente de revisión.
