# 🚀 Cafeteria & Retail Suite: La Solución Integral para Gestión de Inventario, Almacén Central y Punto de Venta Móvil

> **Tu negocio conectado en tiempo real, desde el almacén principal hasta cada punto de venta físico o móvil.**
> Diseñado para cafeterías, tiendas de retail, sucursales y franquicias que necesitan velocidad, control exacto de stock, sincronización offline y análisis financiero preciso.

---

## 🌟 Visión General del Ecosistema

Nuestra suite tecnológica resuelve el problema más crítico del comercio físico y gastronómico: **la desconexión entre almacén central y puntos de venta**. 

El ecosistema se divide en dos pilares integrados de forma nativa:
1. **Plataforma Web Administrativa (Next.js + Postgres)**: El centro de mando maestro para gerentes, administradores, moderadores y supervisores de almacén.
2. **App Móvil de Punto de Venta & Escáner (React Native / Expo + SQLite)**: Una herramienta ágil y ultrarrápida para que dependientes, cajeros y despachadores vendan, escaneen códigos de barra y despachen mercancía **con o sin conexión a internet**.

---

## 📱 1. La App Móvil (POS / Escáner de Bolsillo)
*Transforma cualquier smartphone o tablet en un Punto de Venta profesional de alta velocidad.*

### ⚡ Características Principales de la App

* **📸 Escaneo Ultrarrápido de Códigos de Barras**:
  * Utiliza la cámara del teléfono o lectores ópticos vinculados para buscar, añadir productos al carrito o consultar stock en milisegundos.
  * Capacidad de escaneo continuo con feedback sonoro y háptico.

* **📶 Modo 100% Offline (Resiliente a Caídas de Internet)**:
  * **Base de datos local con SQLite**: Los vendedores pueden seguir cobrando, abriendo tickets y registrando ventas aunque se caiga el WiFi o se queden sin cobertura móvil.
  * **Sincronización Inteligente en Lote (`Bulk Sync`)**: Cuando vuelve la conexión, con un toque se envían todas las ventas acumuladas al backend central, validando stock y evitando pérdidas de datos.

* **🛒 Carrito de Compras Ágil & Variantes Dinámicas**:
  * Manejo de productos simples y variantes (tallas, sabores, tamaños, toppings, personalizaciones).
  * Control visual de stock remanente en tiempo real para evitar vender productos agotados.

* **💳 Métodos de Pago Flexibles**:
  * Registro y desglose instantáneo: **Efectivo**, **Transferencia / Tarjeta** o **Pago Mixto** (parte en efectivo y parte en transferencia).
  * Cálculo instantáneo del cambio / vuelto.

* **📋 Historial y Auditoría de Ventas del Turno**:
  * Vista detallada de ventas del día por empleado y turno.
  * Indicadores de estado de sincronización (Ventas pendientes de subir vs. Sincronizadas).

* **🛡️ Modo Moderador en Movimiento**:
  * Pantallas especiales para supervisores de inventario: entrega de productos desde almacén a puntos de venta, transferencias entre vendedores y conteo físico rápido desde la app.

* **🌗 Soporte de Tema Oscuro y Claro (Dark/Light Mode)**:
  * Diseñado para comodidad visual tanto en mostradores iluminados como en locales nocturnos.

---

## 💻 2. Plataforma Web Centralizada (Centro de Control Administrativo)
*Todo el control financiero, logístico y operativo en una interfaz web moderna, limpia y reactiva.*

### 📦 Gestión de Almacén Central & Catálogo Multitienda
* **Catálogo Maestro de Productos**:
  * Alta de productos con fotografías optimizadas (Cloudinary / Vercel Blob).
  * Soporte multidivisa y márgenes automáticos: Costo de compra, Ganancia sugerida y Precio de venta final (tanto en moneda local como en USD).
  * Gestión de variaciones y parámetros (tallas, colores, recetas, porciones).
  * Generación e impresión de etiquetas con códigos de barra únicos (`BarcodeDisplay`).

* **Control de Stock en Cadena**:
  * Stock Central (Almacén) vs. Stock Asignado a cada Vendedor / Sucursal.
  * Registro de **Entregas** (de almacén a tienda) con trazabilidad de fechas, cantidades y lotes.
  * **Transferencias Directas entre Vendedores**: Mueve stock de una tienda con exceso a una con alta demanda en un clic.
  * Gestión de **Mermas y Bajas**: Registro justificado de productos rotos, caducados o defectuosos para no distorsionar la rentabilidad.

* **🔔 Sistema Inteligente de Alertas y Vencimientos**:
  * Alertas de stock mínimo para evitar desabastecimiento.
  * Semáforo de productos próximos a vencer o vencidos con campana de notificaciones interactiva.
  * Módulo de Recordatorios y Tareas operativas para el personal.

---

### 📊 Módulo Financiero, Contabilidad y Cierre de Caja
* **Contabilidad Automática por Vendedor y Sucursal**:
  * Métricas en vivo de: Ventas Brutas, Costo de Mercancía Vendida, Ganancia Neta y Margen Real.
  * Desglose por método de pago: Total Efectivo vs. Total Transferencias bancarias para cuadre exacto de caja.
  * Registro y deducción de **Gastos Operativos** por punto de venta (renta, electricidad, insumos, transporte).
  * Gestión de **Salarios y Nómina de Empleados**: Control de fijos y comisiones por ventas.

* **Análisis Comparativo e Histórico**:
  * Reportes por día, semana, mes y rangos de fechas personalizados.
  * Métricas por producto: Cuáles son los productos estrella (*Top Sellers*) y cuáles generan mayor margen.
  * Exportación profesional de reportes contables a **Excel (.xlsx)** con un solo clic.

---

### 🔍 Conciliación y Auditoría de Inventario (Exportación vs. Auditorías Físicas)
* **Herramienta de Comparación Inteligente**:
  * Exporta el estado del inventario a hojas de cálculo.
  * Carga conteos físicos y compáralos automáticamente con lo registrado en el sistema.
  * Detección visual de sobrantes o faltantes e impacto monetario de la diferencia.

---

### 👥 Roles, Seguridad y Control de Acceso
* **Rol Administrador / Almacén**: Control total de compras, precios, empleados, traslados y finanzas.
* **Rol Moderador**: Asistente de operaciones con permisos restringidos para despachar, mover productos y consultar movimientos sin exponer números contables confidenciales.
* **Rol Vendedor / Empleado**: Acceso enfocado exclusivamente a su stock, su catálogo y el registro de sus ventas.

---

### 🍽️ Gestión de Menú Digital y Experiencia del Cliente (Módulo Cafetería)
* **Menú Público Interactivo**:
  * Enlace web directo para clientes finales que visualizan la oferta del local (`/productos-vendedor/[id]`).
  * Organización interactiva de secciones mediante drag & drop (arrastrar y soltar).
  * Estadísticas de visitas e interés de clientes en el menú digital.

---

## 🎯 ¿Por qué tu Negocio Necesita esta Solución? (Propuesta de Valor Comercial)

| Desafío Típico de una Tienda o Cafetería | Cómo lo Soluciona Nuestra Suite |
| :--- | :--- |
| **"Se cayó el internet y no podemos cobrar"** | **Venta Offline Garantizada**: La app móvil sigue vendiendo y se sincroniza automáticamente al recuperar la señal. |
| **"No sabemos si falta mercancía o se está perdiendo dinero"** | **Trazabilidad 360°**: Cada movimiento (compra, entrega, venta, transferencia o merma) queda registrado con usuario, fecha y hora. |
| **"Cobramos en efectivo y transferencias, y el cuadre es un desastre"** | **Arqueo Exacto**: Reportes automáticos que separan cuánto dinero físico debe haber en caja y cuánto en cuentas bancarias. |
| **"Inventarios lentos con papel y lápiz"** | **Escaneo de Código de Barras**: Agiliza la venta y las auditorías de stock en un 70%. |
| **"Múltiples sucursales difíciles de supervisar"** | **Panel Multi-Vendedor**: Supervisa en tiempo real el rendimiento individual de cada punto o vendedor desde cualquier navegador. |

---

## 🚀 Planes y Modalidades de Implementación (Para Vendedores y Clientes)

1. **Plan Emprendedor (1 Punto de Venta)**:
   * 1 Usuario Web Almacén.
   * 1 App Móvil para Vendedor (Android/iOS).
   * Catálogo de productos, control de stock y arqueos diarios.
2. **Plan Sucursales & Franquicias (Multi-Punto)**:
   * Almacén Central + Múltiples Puntos de Venta y Vendedores.
   * Transferencias entre puntos y módulo de Moderadores.
   * Contabilidad avanzada, nóminas, gastos y reportes Excel.
3. **Plan Todo en Uno + Menú Digital**:
   * Todos los beneficios anteriores + Menú digital QR para clientes finales con métricas de visita.

---

## 📋 Estructura Recomendada para el Formulario de Captación (Próximo Proyecto)

Para el formulario que usarán los vendedores y prospectos en la página de presentación, se recopilarán los siguientes datos clave:
1. **Datos de Contacto**: Nombre completo, Teléfono/WhatsApp, Correo electrónico y Ciudad/País.
2. **Perfil del Negocio**: Tipo de comercio (Cafetería, Restaurante, Tienda de Abarrotes, Boutique, Múltiples Sucursales).
3. **Puntos de Venta**: Número actual de locales o cajas de cobro requeridas.
4. **Necesidades Principales**:
   - [ ] Escaneo de código de barras.
   - [ ] Cobro offline sin internet.
   - [ ] Control de almacén central y transferencias.
   - [ ] Menú digital QR para clientes.
   - [ ] Arqueos de caja y contabilidad con reportes en Excel.
5. **Horario preferido para demostración en vivo**.
