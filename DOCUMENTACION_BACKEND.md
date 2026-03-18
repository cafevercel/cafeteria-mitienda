# Documentación del Backend - Mi Tienda

Este documento proporciona una visión detallada de la arquitectura del backend, la estructura de la base de datos y los endpoints de la API de la aplicación **Mi Tienda**.

---

## 🚀 Tecnologías y Arquitectura

- **Framework:** [Next.js](https://nextjs.org/) (App Router).
- **Base de Datos:** [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres) (Motor PostgreSQL).
- **Lenguaje:** TypeScript.
- **Autenticación:** JWT (JSON Web Tokens) gestionados mediante cookies.
- **Almacenamiento de Imágenes:** Vercel Blob y Cloudinary.

---

## 📊 Base de Datos

La base de datos está compuesta por las siguientes tablas principales:

### 1. `usuarios` (Puntos de Venta / Almacén)
Almacena la información de los locales o puntos principales del sistema.
- `id`: Serial/Varchar (PK)
- `nombre`: Varchar (Nombre de tienda/almacén)
- `password`: Varchar (Contraseña encriptada) - *Nota: ya no se usa para login de vendedores, solo almacén*
- `telefono`: Varchar
- `rol`: Varchar ('Almacen', 'Vendedor')

### 1.A `empleados`
Gestiona los empleados o trabajadores asignados a cada punto de venta. Esta es la tabla que se usa para el **login** en la app para los vendedores.
- `id`: Varchar (PK, UUID)
- `nombre`: Varchar (Nombre para el login)
- `usuario_id`: Varchar (FK -> usuarios.id, el punto de venta)
- `password`: Varchar (Contraseña encriptada)
- `activo`: Boolean

### 1.B `salarios`
Almacena el registro de salarios de los empleados, separando esta entidad de los usuarios puros.
- `id`: Varchar (PK, UUID)
- `usuario_id`: Varchar (FK -> usuarios.id)
- `empleado_id`: Varchar (FK -> empleados.id)
- `salario`: Numeric (Sueldo base del empleado)
- `activo`: Boolean

### 2. `productos`
Catálogo general de productos.
- `id`: Serial (PK)
- `nombre`: Varchar
- `precio`: Numeric (Precio de venta)
- `precio_compra`: Numeric (Costo de adquisición)
- `cantidad`: Integer (Stock total en almacén)
- `foto`: Varchar (URL de la imagen)
- `tiene_parametros`: Boolean (Indica si tiene tallas/colores)
- `descripcion`: Text
- `valor_compra_usd`: Numeric
- `precio_compra_usd`: Numeric
- `precio_venta_usd`: Numeric

### 3. `producto_parametros`
Variaciones específicas de un producto (ej. Talla XL, Color Rojo).
- `id`: Serial (PK)
- `producto_id`: Integer (FK -> productos.id)
- `nombre`: Varchar (Nombre del parámetro)
- `cantidad`: Integer (Stock por parámetro)
- `foto`: Varchar

### 4. `usuario_productos`
Inventario asignado a cada vendedor (Stock en tienda).
- `usuario_id`: Integer (FK -> usuarios.id)
- `producto_id`: Integer (FK -> productos.id)
- `cantidad`: Integer (Stock disponible para el vendedor)
- `precio`: Numeric

### 5. `usuario_producto_parametros`
Variaciones de productos asignadas a cada vendedor.
- `usuario_id`: Integer (FK -> usuarios.id)
- `producto_id`: Integer (FK -> productos.id)
- `nombre`: Varchar (Nombre del parámetro)
- `cantidad`: Integer

### 6. `ventas`
Registro histórico de ventas realizadas.
- `id`: Serial (PK)
- `producto`: Integer (FK -> productos.id)
- `cantidad`: Integer
- `precio_unitario`: Numeric
- `precio_compra`: Numeric (Para cálculo de ganancias históricas)
- `total`: Numeric
- `vendedor`: Integer (FK -> usuarios.id)
- `fecha`: Timestamp

### 7. `venta_parametros`
Detalle de parámetros específicos de una venta.
- `venta_id`: Integer (FK -> ventas.id)
- `parametro`: Varchar
- `cantidad`: Integer

### 8. `transacciones`
Movimientos de mercancía (Entregas de almacén a vendedor o bajas).
- `id`: Serial (PK)
- `producto`: Integer (FK -> productos.id)
- `cantidad`: Integer
- `tipo`: Varchar ('Entrega', 'Baja', 'Transferencia')
- `desde`: Integer (ID del origen: 1 para Almacén Central)
- `hacia`: Integer (ID del destino o 'MERMA')
- `fecha`: Timestamp
- `precio`: Numeric

### 9. `gastos_vendedores`
Gastos fijos o variables asociados a un vendedor (ej. Alquiler, Luz).
- `vendedor_id`: Integer (FK -> usuarios.id)
- `nombre`: Varchar
- `valor`: Numeric
- `mes`: Integer
- `anio`: Integer

### 10. `merma`
Productos dañados o perdidos.
- `id`: Serial (PK)
- `producto_id`: Integer
- `producto_nombre`: Varchar
- `cantidad`: Integer
- `fecha`: Timestamp
- `usuario_id`: Integer
- `usuario_nombre`: Varchar

### 11. `notificaciones`
Alertas para los usuarios (ej. stock bajo).
- `id`: Serial (PK)
- `texto`: Text
- `fecha`: Timestamp
- `leida`: Boolean
- `usuario_id`: Integer (FK -> usuarios.id)

### 12. `secciones` y `subsecciones`
Organización categórica del catálogo.
- `id`: Serial (PK)
- `nombre`: Varchar
- `foto`: Varchar

### 13. `promociones`
Descuentos aplicables a productos.
- `id`: Serial (PK)
- `nombre`: Varchar
- `valor_descuento`: Numeric
- `fecha_inicio` / `fecha_fin`: Timestamp
- `activa`: Boolean

### 14. `carrusel_imagenes`
Imágenes publicitarias de la página principal.
- `id`: Serial (PK)
- `url`: Varchar
- `orden`: Integer

---

## 🛣️ Endpoints de la API

Todos los endpoints están bajo el prefijo `/api/`.

### Autenticación (`/api/auth/`)
- `POST /login`: *Obsoleto para vendedores*. Valida credenciales e inicia sesión para cuentas de 'Almacen'.
- `POST /login-empleado`: **Principal**. Valida credenciales del empleado (tabla `empleados`) y devuelve el JWT y la info de su punto de venta.
- `POST /logout`: Cierra la sesión (elimina cookie).
- `POST /register`: Registra un nuevo usuario/punto de venta.

### Productos (`/api/productos/`)
- `GET /`: Lista todos los productos con sus parámetros.
- `POST /`: Crea un nuevo producto.
- `GET /[id]`: Obtiene detalles de un producto específico.
- `PUT /[id]`: Actualiza información del producto.
- `DELETE /[id]`: Elimina un producto.
- `GET /destacados`: Lista productos marcados como destacados.

### Ventas (`/api/ventas/`)
- `POST /`: Registra una nueva venta y descuenta stock del vendedor.
- `GET /?vendedorId=X`: Obtiene el historial de ventas de un vendedor.
- `GET /?id=X`: Obtiene detalles de una venta específica.

### Transacciones e Inventario (`/api/transacciones/`)
- `POST /`: Registra la entrega de productos de almacén a vendedor.
- `GET /?vendedorId=X`: Historial de entregas/transacciones para un vendedor.
- `POST /transfer`: Transfiere productos entre dos vendedores.

### Usuarios, Empleados y Salarios (`/api/users/`, `/api/empleados/`, `/api/salarios/`)
- `GET /api/users/me`: Obtiene la información del usuario/empleado autenticado.
- `GET /api/users/vendedores`: Lista todos los puntos de venta (rol de vendedor).
- `GET /api/users/productos/[id]`: Obtiene el inventario específico asignado a un vendedor/punto de venta.
- `GET / POST /api/empleados`: Lista los empleados de un punto de venta o crea uno nuevo.
- `PUT / DELETE /api/empleados/[id]`: Edita o marca inactivo un empleado.
- `GET / POST /api/salarios`: Gestiona la historia y asignación de salarios a empleados.

### Contabilidad y Reportes (`/api/contabilidad-vendedores/`, `/api/ventas-diarias/`)
- `GET /api/contabilidad-vendedores`: Calcula ventas totales, ganancias brutas, gastos prorrateados y resultado final por vendedor.
- `GET /api/ventas-diarias`: Resumen de ventas del día actual.
- `GET /api/ventas-semanales`: Reporte de ventas agrupado por semanas.

### Notificaciones y Categorías
- `GET /api/notificaciones`: Obtiene las alertas del usuario actual.
- `POST /api/secciones`: Crea nuevas categorías de productos.
- `GET /api/promociones`: Lista las promociones activas.
- `GET /api/carrusel`: Obtiene las imágenes del carrusel principal.

### Otros
- `GET /api/valor-usd/current`: Obtiene el precio del dólar configurado.
- `POST /api/valor-usd/update`: Actualiza el precio del dólar para todos los productos.
- `POST /api/merma`: Registra una baja de producto por pérdida o daño.

---

## ⚙️ Configuración (Variables de Entorno)

Para que el backend funcione, se requieren las siguientes variables en el archivo `.env`:

- `POSTGRES_URL`: URL de conexión a la base de datos de Vercel.
- `JWT_SECRET`: Llave para firmar los tokens de autenticación.
- `BLOB_READ_WRITE_TOKEN`: Token para la gestión de imágenes con Vercel Blob.
- `CLOUDINARY_URL`: Configuración para almacenamiento alternativo en Cloudinary.

---

## 🔐 Seguridad y Middleware

La aplicación utiliza un archivo `middleware.ts` que intercepta las peticiones para:
1. Verificar la validez del JWT en las cookies.
2. Proteger rutas sensibles como `/almacen` o `/vendedor`, redirigiendo al `/login` si no hay sesión activa.
3. Validar roles de usuario para restringir acceso a funciones administrativas.






************************************************

Plan de Implementación: App de Ventas Offline con React Native Expo
Descripción General
Crear una aplicación móvil con React Native y Expo que permita a los vendedores registrar ventas de manera offline mediante escaneo de códigos de barras. Las ventas se almacenarán localmente y se sincronizarán con el backend cuando haya conexión a internet.

User Review Required
IMPORTANT

Decisiones de Diseño Clave

Almacenamiento Offline: Usaré SQLite (expo-sqlite) para almacenar datos localmente
Códigos de Barras: Los productos necesitarán tener un campo de código de barras en la base de datos. ¿Ya existe este campo o necesito agregarlo?
Sincronización: La app descargará el catálogo de productos del punto de venta al que está asignado el empleado al iniciar sesión y sincronizará ventas manualmente con un botón
Autenticación: Usaré JWT igual que la web, almacenado en AsyncStorage (el login lo hace el empleado, no el usuario vendedor directamente).
WARNING

Cambios Necesarios en el Backend

Necesitaremos agregar un campo codigo_barras a la tabla productos si no existe
El endpoint /api/ventas/ debe aceptar múltiples ventas en batch para la sincronización
Necesitaremos un endpoint para obtener el catálogo completo de productos asignados a un vendedor
Proposed Changes
Estructura del Proyecto
[NEW] Inicialización del Proyecto Expo
bash
npx create-expo-app@latest sales-app --template blank-typescript
Dependencias principales:

expo-sqlite - Base de datos local
expo-barcode-scanner - Escaneo de códigos de barras
expo-camera - Acceso a la cámara
@react-navigation/native - Navegación
@react-navigation/native-stack - Stack navigator
axios - Peticiones HTTP
@react-native-async-storage/async-storage - Almacenamiento persistente
expo-network - Detección de conectividad
Core - Configuración y Utilidades
[NEW] 
app.json
Configuración de Expo con permisos para cámara y nombre de la app.

[NEW] 
src/config/api.ts
Configuración de la URL base del API (tu web en producción).

typescript
export const API_BASE_URL = 'https://tu-web.vercel.app/api';
[NEW] 
src/types/index.ts
Definiciones de TypeScript para:

Usuario (punto de venta)
Empleado (vendedor logueado)
Producto (con parámetros opcionales)
Venta (con estado de sincronización)
VentaParametro
Database - Almacenamiento Local
[NEW] 
src/database/schema.ts
Esquema SQLite con tablas:

productos - Catálogo local del vendedor
producto_parametros - Variaciones de productos
ventas_pendientes - Ventas no sincronizadas
venta_parametros_pendientes - Detalles de parámetros
[NEW] 
src/database/db.ts
Funciones para:

Inicializar la base de datos
CRUD de productos locales
CRUD de ventas pendientes
Consultas por código de barras
Services - Lógica de Negocio
[NEW] 
src/services/authService.ts
Manejo de autenticación:

login(nombre, password) - Llama a /api/auth/login-empleado
logout() - Limpia datos locales
getStoredUser() - Recupera empleado y su punto de venta de AsyncStorage
saveToken(token) - Guarda JWT
[NEW] 
src/services/productService.ts
Gestión de productos:

syncProducts(vendedorId) - Descarga productos del vendedor desde /api/users/productos/[id]
getProductByBarcode(barcode) - Busca en SQLite local
getAllProducts() - Lista productos locales
[NEW] 
src/services/salesService.ts
Gestión de ventas:

createSaleOffline(venta) - Guarda en SQLite
getPendingSales() - Lista ventas no sincronizadas
syncSales() - Envía ventas pendientes a /api/ventas/ en batch
getSalesHistory(vendedorId) - Obtiene historial desde el servidor
[NEW] 
src/services/networkService.ts
Utilidades de red:

isOnline() - Verifica conectividad
checkServerConnection() - Ping al servidor
Screens - Interfaz de Usuario
[NEW] 
src/screens/LoginScreen.tsx
Pantalla de login con:

Campos de usuario y contraseña
Validación de credenciales contra el backend
Navegación a SalesListScreen tras login exitoso
Descarga automática del catálogo de productos
[NEW] 
src/screens/SalesListScreen.tsx
Pantalla principal con:

Lista de ventas del vendedor (sincronizadas + pendientes)
Indicador visual de ventas pendientes de sincronizar
Botón "+" para nueva venta
Botón "Sincronizar" (solo visible si hay ventas pendientes y hay conexión)
Contador de ventas pendientes
Botón de logout
[NEW] 
src/screens/NewSaleScreen.tsx
Formulario de nueva venta:

Botón "Escanear Código de Barras"
Información del producto escaneado (nombre, precio, foto)
Selector de parámetros si el producto los tiene
Input de cantidad
Botón "Confirmar Venta"
Funciona 100% offline
[NEW] 
src/screens/BarcodeScannerScreen.tsx
Escáner de códigos de barras:

Vista de cámara con overlay
Detección automática de códigos
Búsqueda del producto en la base de datos local
Retorno a NewSaleScreen con el producto seleccionado
Components - Componentes Reutilizables
[NEW] 
src/components/ProductCard.tsx
Tarjeta para mostrar información del producto escaneado.

[NEW] 
src/components/SaleItem.tsx
Item de lista para cada venta, con badge si está pendiente de sincronizar.

[NEW] 
src/components/SyncButton.tsx
Botón de sincronización con estados de carga y contador de pendientes.

Navigation - Navegación
[NEW] 
src/navigation/AppNavigator.tsx
Stack Navigator con:

LoginScreen (inicial)
SalesListScreen
NewSaleScreen
BarcodeScannerScreen
Root - Punto de Entrada
[NEW] 
App.tsx
Componente raíz que:

Inicializa la base de datos SQLite
Verifica si hay sesión guardada
Renderiza el navegador
Verification Plan
Automated Tests
bash
# Instalar dependencias
npm install
# Ejecutar en desarrollo
npx expo start
Manual Verification
Test de Login

Probar credenciales válidas e inválidas
Verificar que se descarguen los productos del vendedor
Test de Escaneo Offline

Activar modo avión
Escanear código de barras
Verificar que se muestre el producto
Registrar venta
Confirmar que se guarde en SQLite
Test de Sincronización

Registrar varias ventas offline
Restaurar conexión
Presionar botón de sincronizar
Verificar que las ventas aparezcan en la web
Test de Parámetros

Escanear producto con tallas/colores
Seleccionar parámetro específico
Confirmar que se registre correctamente
Próximos Pasos
¿Confirmas que los productos tienen o necesitan un campo codigo_barras?
¿La URL de tu web en producción es https://evento-simbiosis.vercel.app?
¿Quieres que proceda con la implementación?