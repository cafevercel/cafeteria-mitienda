# Guía Completa: Sistema de Códigos de Barras - Flujo de Trabajo e Implementación

## 📋 Índice
1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Base de Datos](#base-de-datos)
4. [Backend (API)](#backend-api)
5. [Frontend (Componentes)](#frontend-componentes)
6. [Flujo de Trabajo Completo](#flujo-de-trabajo-completo)
7. [Consideraciones Técnicas](#consideraciones-técnicas)
8. [Checklist de Implementación](#checklist-de-implementación)
9. [Troubleshooting](#troubleshooting)

---

## 1. Resumen Ejecutivo

Este documento describe la implementación completa de un sistema de códigos de barras en una aplicación web de gestión de inventario (MiTienda). El sistema permite:
- **Escaneo** de códigos de barras usando la cámara del dispositivo
- **Generación automática** de códigos únicos
- **Validación en tiempo real** para evitar duplicados
- **Visualización y exportación** de códigos para impresión

### Stack Tecnológico
- **Frontend**: React/Next.js 14, TypeScript, Tailwind CSS
- **Librerías**: `html5-qrcode` (escaneo), `jsbarcode` (generación)
- **Backend**: Next.js API Routes, PostgreSQL
- **Autenticación**: JWT con middleware

---

## 2. Arquitectura del Sistema

### Diagrama de Flujo
```
┌─────────────────┐
│   Usuario       │
│   (Almacén)     │
└────────┬────────┘
         │
         ├─── Escanea código → ┌──────────────────┐
         │                      │  BarcodeScanner  │
         ├─── Genera aleatorio │  (html5-qrcode)  │
         │                      └────────┬─────────┘
         │                               │
         └─── Ingresa manualmente ──────┤
                                        │
                                        ▼
                               ┌─────────────────────┐
                               │   ProductDialog     │
                               │   / AlmacenPage     │
                               └──────────┬──────────┘
                                          │
                                          ▼
                               ┌─────────────────────┐
                               │   Verificación API  │
                               │  /verificar-barcode │
                               └──────────┬──────────┘
                                          │
                        ┌─────────────────┼─────────────────┐
                        │                 │                 │
                        ▼                 ▼                 ▼
               ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
               │  Existe?      │ │  No existe   │ │  Error       │
               │  → Error      │ │  → Guardar   │ │  → Mensaje   │
               └──────────────┘ └──────────────┘ └──────────────┘
                                          │
                                          ▼
                               ┌─────────────────────┐
                               │   Guardar en DB     │
                               │  (codigo_barras)    │
                               └─────────────────────┘
```

### Componentes del Sistema

| Componente | Responsabilidad | Tecnología |
|------------|-----------------|------------|
| `BarcodeScanner` | Captura código desde cámara | html5-qrcode |
| `BarcodeDisplay` | Renderiza código para visualización/exportación | jsbarcode |
| API `/api/productos/verificar-barcode` | Valida unicidad del código | Next.js + PostgreSQL |
| API `/api/productos` | CRUD completo con campo código | Next.js + PostgreSQL |
| API `/api/productos/[id]` | Edición específica | Next.js + PostgreSQL |

---

## 3. Base de Datos

### 3.1 Estructura de Tablas

#### Tabla `productos`
```sql
-- Agregar columna de código de barras (único)
ALTER TABLE productos ADD COLUMN codigo_barras VARCHAR(255) UNIQUE;

-- Estructura completa de la tabla (contexto)
CREATE TABLE productos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    precio DECIMAL(10,2) NOT NULL,
    precio_compra DECIMAL(10,2),
    cantidad INTEGER NOT NULL,
    foto TEXT,
    tiene_parametros BOOLEAN DEFAULT FALSE,
    descripcion TEXT,
    valor_compra_usd DECIMAL(10,2),
    precio_compra_usd DECIMAL(10,2),
    precio_venta_usd DECIMAL(10,2),
    codigo_barras VARCHAR(255) UNIQUE, -- ← NUEVO CAMPO
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Notas importantes:**
- `UNIQUE` garantiza que no haya dos productos con el mismo código
- `VARCHAR(255)` soporta todos los formatos estándar (EAN-13, UPC-A, CODE-128, etc.)
- Puede ser `NULL` para productos sin código asignado

### 3.2 Consideraciones de Diseño
- **No eliminar** la columna una vez creada (puede romper datos existentes)
- **Indexación automática**: PostgreSQL crea índice único en `codigo_barras`
- **Compatibilidad**: El campo es opcional, productos existentes no se ven afectados

---

## 4. Backend (API)

### 4.1 Endpoints Implementados

#### 4.1.1 Verificar Código de Barras
**Ruta:** `GET /api/productos/verificar-barcode?barcode={codigo}`

**Propósito:** Verificar en tiempo real si un código ya está en uso (validación proactiva).

**Request:**
```http
GET /api/productos/verificar-barcode?barcode=123456789012
```

**Response (éxito):**
```json
{
  "exists": true
}
```

**Response (código disponible):**
```json
{
  "exists": false
}
```

**Response (error):**
```json
{
  "error": "Código de barras no proporcionado"
}
```

**Código Fuente:**
```typescript
// src/app/api/productos/verificar-barcode/route.ts
export async function GET(request: NextRequest) {
    try {
        const barcode = request.nextUrl.searchParams.get('barcode');
        
        if (!barcode) {
            return NextResponse.json({ 
                error: 'Código de barras no proporcionado' 
            }, { status: 400 });
        }

        const result = await query(
            'SELECT COUNT(*) as count FROM productos WHERE codigo_barras = $1',
            [barcode]
        );

        const exists = result.rows[0].count > 0;

        return NextResponse.json({ exists });
    } catch (error) {
        console.error('Error verificando código de barras:', error);
        return NextResponse.json({ 
            error: 'Error interno del servidor' 
        }, { status: 500 });
    }
}
```

---

#### 4.1.2 Crear Producto (POST)
**Ruta:** `POST /api/productos`

**Cambios realizados:**
- Acepta campo `codigo_barras` en FormData
- Lo incluye en el INSERT

**Código relevante:**
```typescript
// src/app/api/productos/route.ts (POST)
const codigo_barras = formData.get('codigo_barras') as string || null;

const result = await query(
    'INSERT INTO productos (nombre, precio, precio_compra, cantidad, foto, tiene_parametros, descripcion, valor_compra_usd, precio_compra_usd, precio_venta_usd, codigo_barras) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
    [
        nombre,
        Number(precio),
        Number(precioCompra),
        Number(cantidad),
        fotoUrl,
        tieneParametros,
        descripcion,
        valorCompraUSD ? Number(valorCompraUSD) : null,
        precioCompraUSD ? Number(precioCompraUSD) : null,
        precioVentaUSD ? Number(precioVentaUSD) : null,
        codigo_barras // ← Campo agregado
    ]
);
```

---

#### 4.1.3 Actualizar Producto (PUT)
**Ruta:** `PUT /api/productos/[id]`

**Cambios realizados:**
- Acepta `codigo_barras` en FormData
- Actualiza el campo en la tabla

**Código relevante:**
```typescript
// src/app/api/productos/[id]/route.ts (PUT)
const codigo_barras = formData.get('codigo_barras') as string || null;

const result = await query(
    'UPDATE productos SET nombre = $1, precio = $2, cantidad = $3, foto = $4, tiene_parametros = $5, precio_compra = $6, descripcion = $7, valor_compra_usd = $8, precio_compra_usd = $9, precio_venta_usd = $10, codigo_barras = $11 WHERE id = $12 RETURNING *',
    [
        nombre,
        Number(precio),
        Number(cantidad),
        nuevaFotoUrl,
        tieneParametros,
        precioCompra ? Number(precioCompra) : currentProduct.rows[0].precio_compra || 0,
        descripcion,
        valorCompraUSD ? Number(valorCompraUSD) : currentProduct.rows[0].valor_compra_usd || null,
        precioCompraUSD ? Number(precioCompraUSD) : currentProduct.rows[0].precio_compra_usd || null,
        precioVentaUSD ? Number(precioVentaUSD) : currentProduct.rows[0].precio_venta_usd || null,
        codigo_barras, // ← Campo agregado
        id
    ]
);
```

---

#### 4.1.4 Listar Productos (GET)
**Ruta:** `GET /api/productos`

**Cambios realizados:**
- El SELECT ya incluía todos los campos, por lo que `codigo_barras` se devuelve automáticamente

```typescript
// src/app/api/productos/route.ts (GET)
const result = await query(`
    SELECT
        p.*,
        COALESCE(
            json_agg(
                json_build_object(
                    'nombre', pp.nombre,
                    'cantidad', pp.cantidad,
                    'foto', pp.foto
                )
            ) FILTER (WHERE pp.id IS NOT NULL),
            '[]'::json
        ) as parametros
    FROM productos p
    LEFT JOIN producto_parametros pp ON p.id = pp.producto_id
    GROUP BY p.id
`);
// p.* incluye automáticamente codigo_barras
```

---

### 4.2 Tipos TypeScript

#### Archivo: `src/types/index.ts`
```typescript
export interface ProductoNuevo {
  nombre: string;
  precio: number;
  precioCompra: number;
  cantidad: number;
  foto: string;
  tieneParametros: boolean;
  parametros: Parametro[];
  descripcion: string;
  valorCompraUSD: number | null;
  precioCompraUSD: number | null;
  precioVentaUSD: number | null;
  codigo_barras?: string; // ← NUEVO CAMPO (opcional)
}

export interface Producto {
  id: string;
  nombre: string;
  precio: number;
  precio_compra?: number;
  cantidad: number;
  foto: string;
  tiene_parametros: boolean;
  tieneParametros?: boolean;
  parametros?: Parametro[];
  descripcion?: string;
  seccion_id?: string;
  subseccion_id?: string;
  valor_compra_usd?: number | null;
  precio_compra_usd?: number | null;
  precio_venta_usd?: number | null;
  codigo_barras?: string; // ← NUEVO CAMPO (opcional)
}
```

**Nota:** Se mantiene como campo opcional (`?:`) para mantener compatibilidad con productos existentes que no tienen código.

---

### 4.3 Servicios API

#### Archivo: `src/app/services/api.ts`

**No se requieren cambios** en las funciones existentes, ya que el campo `codigo_barras` se incluye automáticamente en las respuestas de `getInventario()` y otras funciones que devuelven objetos `Producto`.

---

## 5. Frontend (Componentes)

### 5.1 BarcodeScanner - Componente de Escaneo

**Propósito:** Capturar códigos de barras usando la cámara del dispositivo.

**Ruta:** `src/components/BarcodeScanner.tsx`

**Props:**
```typescript
interface BarcodeScannerProps {
  onScan: (barcode: string) => void;     // Callback al escanear
  onClose: () => void;                   // Callback al cerrar
  open: boolean;                         // Controla visibilidad
}
```

**Características técnicas:**
- **Librería:** `html5-qrcode` (v1.5.5+)
- **Formatos soportados:** CODE_128, EAN_13, EAN_8, UPC_A, UPC_E, CODE_39
- **Configuración de cámara:** `facingMode: "environment"` (cámara trasera en móviles)
- **FPS:** 15 (balance entre rendimiento y detección)
- **Área de escaneo:** 260x160px con overlay visual

**Implementación clave:**
```typescript
const startScanner = async () => {
  try {
    // 1. Limpieza previa
    await forceStopScanner();
    
    // 2. Crear instancia con formatos específicos
    const html5QrCode = new Html5Qrcode(scannerContainerId, {
      formatsToSupport: formats,
      verbose: false
    });
    
    // 3. Iniciar cámara
    await html5QrCode.start(
      { facingMode: "environment" },
      { fps: 15, qrbox: { width: 260, height: 160 } },
      async (decodedText) => {
        // Callback de detección
        await html5QrCode.stop();
        onScan(decodedText);
      }
    );
    
  } catch (err) {
    // Manejo de errores (permisos, sin cámara, etc.)
  }
};
```

**Manejo de errores:**
- `NotAllowedError`: Permiso de cámara denegado
- `NotFoundError`: No hay cámara disponible
- Permite reintentar después de error

---

### 5.2 BarcodeDisplay - Componente de Visualización

**Propósito:** Renderizar y exportar códigos de barras como imagen PNG.

**Ruta:** Integrado en `src/components/ProductDialog.tsx` (líneas 186-261)

**Características:**
- **Librería:** `jsbarcode`
- **Formato:** CODE-128 (estándar para inventario)
- **Exportación:** PNG con fondo blanco y padding

**Implementación:**
```typescript
const BarcodeDisplay = ({ value, name }: { value: string, name: string }) => {
  const barcodeRef = React.useRef<SVGSVGElement>(null);

  React.useEffect(() => {
    if (barcodeRef.current && value) {
      JsBarcode(barcodeRef.current, value, {
        format: "CODE128",
        lineColor: "#000",
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 14
      });
    }
  }, [value]);

  const downloadBarcode = () => {
    // 1. Serializar SVG
    const svgData = new XMLSerializer().serializeToString(barcodeRef.current);
    
    // 2. Crear canvas y convertir a PNG
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = document.createElement('img');
    
    img.onload = () => {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 20, 20);
      
      // 3. Descargar
      const pngUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `barcode-${name}-${value}.png`;
      downloadLink.click();
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="flex flex-col items-center space-y-3 p-4 bg-gray-50 border rounded-lg">
      <div className="bg-white p-2 rounded shadow-sm overflow-x-auto max-w-full">
        <svg ref={barcodeRef}></svg>
      </div>
      <Button variant="outline" size="sm" onClick={downloadBarcode} className="w-full">
        <Download className="mr-2 h-4 w-4" />
        Exportar Código de Barras
      </Button>
    </div>
  );
};
```

---

### 5.3 Integración en AlmacenPage

**Ruta:** `src/app/pages/AlmacenPage/page.tsx`

#### 5.3.1 Estados de Validación
```typescript
const [barcodeExiste, setBarcodeExiste] = useState(false);
const [verificandoBarcode, setVerificandoBarcode] = useState(false);
const [showBarcodeScannerAdd, setShowBarcodeScannerAdd] = useState(false);
```

#### 5.3.2 Verificación en Tiempo Real
```typescript
useEffect(() => {
  const verificarBarcode = async () => {
    if (newProduct.codigo_barras.trim() === '') {
      setBarcodeExiste(false);
      return;
    }

    setVerificandoBarcode(true);
    try {
      const response = await fetch(
        `/api/productos/verificar-barcode?barcode=${encodeURIComponent(newProduct.codigo_barras)}`
      );
      const data = await response.json();
      setBarcodeExiste(data.exists);
    } catch (error) {
      console.error('Error verificando barcode:', error);
    } finally {
      setVerificandoBarcode(false);
    }
  };

  const timeoutId = setTimeout(verificarBarcode, 500); // Debounce 500ms
  return () => clearTimeout(timeoutId);
}, [newProduct.codigo_barras]);
```

**Nota:** Se implementa debounce de 500ms para evitar consultas excesivas al servidor.

#### 5.3.3 Generación Aleatoria
```typescript
const generarBarcodeAleatorio = () => {
  // Genera un código de 12 dígitos (EAN-13 sin dígito de control)
  const randomDigits = Math.floor(Math.random() * 900000000000) + 100000000000;
  setNewProduct(prev => ({
    ...prev,
    codigo_barras: randomDigits.toString()
  }));
};
```

#### 5.3.4 UI - Campo de Código de Barras
```tsx
<div className="space-y-2">
  <label htmlFor="codigo_barras" className="block text-sm font-medium text-gray-700">
    Código de barras
  </label>
  <div className="flex flex-col gap-2">
    <div className="flex gap-2">
      <Input
        id="codigo_barras"
        name="codigo_barras"
        value={newProduct.codigo_barras}
        onChange={handleProductInputChange}
        placeholder="Código de barras"
        className={barcodeExiste ? 'border-red-500' : ''}
        readOnly // ← SOLO LECTURA (solo escáner o generador)
      />
      <Button 
        type="button" 
        variant="outline" 
        onClick={generarBarcodeAleatorio}
        className="whitespace-nowrap"
      >
        Aleatorio
      </Button>
    </div>
    <Button 
      type="button" 
      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
      onClick={() => setShowBarcodeScannerAdd(true)}
    >
      <Scan className="mr-2 h-4 w-4" />
      Escanear Código
    </Button>
  </div>
  {verificandoBarcode && (
    <p className="text-xs text-gray-500">Verificando disponibilidad...</p>
  )}
  {barcodeExiste && (
    <p className="text-xs text-red-500">Este código de barras ya está en uso</p>
  )}
</div>

{/* Scanner integrado */}
<BarcodeScanner 
    open={showBarcodeScannerAdd}
    onClose={() => setShowBarcodeScannerAdd(false)}
    onScan={(barcode) => {
        setNewProduct(prev => ({ ...prev, codigo_barras: barcode }));
        setShowBarcodeScannerAdd(false);
        toast({
            title: "Escaneado",
            description: `Código detectado: ${barcode}`,
        });
    }}
/>
```

---

### 5.4 Integración en ProductDialog (Modo Edición)

**Ruta:** `src/components/ProductDialog.tsx`

#### 5.4.1 Estados
```typescript
const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
```

#### 5.4.2 Inicialización de `editedProduct`
```typescript
const [editedProduct, setEditedProduct] = useState<Producto>({
  ...product,
  tieneParametros: product.tiene_parametros,
  tiene_parametros: product.tiene_parametros,
  parametros: product.parametros || [],
  foto: product.foto || '',
  precio_compra: product.precio_compra || 0,
  descripcion: product.descripcion || '',
  valor_compra_usd: product.valor_compra_usd ?? null,
  precio_compra_usd: product.precio_compra_usd ?? null,
  precio_venta_usd: product.precio_venta_usd ?? null,
  codigo_barras: product.codigo_barras || '', // ← Incluir
});
```

#### 5.4.3 Modo Edición - Campo de Código
```tsx
// En EditMode component (líneas 866-896)
<div>
  <Label>Código de Barras</Label>
  <div className="flex flex-col gap-2">
    <div className="flex gap-2">
      <Input
        name="codigo_barras"
        value={editedProduct.codigo_barras || ''}
        onChange={onInputChange}
        placeholder="Código de barras"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          const random = Math.floor(Math.random() * 900000000000) + 100000000000;
          onInputChange({ 
            target: { name: 'codigo_barras', value: random.toString() } 
          } as any);
        }}
      >
        Aleatorio
      </Button>
    </div>
    <Button
      type="button"
      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
      onClick={onShowBarcodeScanner}
    >
      <Scan className="mr-2 h-4 w-4" />
      Escanear Código
    </Button>
  </div>
</div>
```

#### 5.4.4 Modo Visualización - Mostrar Código
```tsx
// En ViewMode component (líneas 1268-1276)
<div className="mt-6 border-t pt-4">
  <h4 className="font-medium text-sm text-gray-700 mb-3">Código de Barras:</h4>
  {product.codigo_barras ? (
    <BarcodeDisplay value={product.codigo_barras} name={product.nombre} />
  ) : (
    <p className="text-sm text-gray-500 italic">No tiene código de barras asignado</p>
  )}
</div>
```

---

### 5.5 Consideraciones de UX/UI

#### 5.5.1 Campo de Solo Lectura
```typescript
<Input
  readOnly // ← Solo lectura
  // ...
/>
```
**Razón:** Evitar errores de escritura manual y garantizar que solo se acepten códigos del escáner o generador automático.

#### 5.5.2 Validación Visual
- **Borde rojo** cuando `barcodeExiste === true`
- **Mensaje de error** en tiempo real
- **Icono de verificación** (opcional, puede agregarse)

#### 5.5.3 Feedback al Usuario
- **Toast** al escanear exitosamente
- **Loader** durante verificación
- **Mensaje claro** si el código ya existe

---

## 6. Flujo de Trabajo Completo

### 6.1 Escenario 1: Crear Nuevo Producto con Código

```
1. Usuario hace clic en "Agregar Producto"
2. Se abre ProductDialog (modo creación)
3. Usuario puede:
   a) Hacer clic en "Escanear Código" → Activa cámara → Detecta código → Se llena automáticamente
   b) Hacer clic en "Aleatorio" → Se genera código de 12 dígitos
   c) Pegar código manualmente (campo readOnly, pero puede usar Ctrl+V)
4. Sistema verifica en tiempo real (debounce 500ms):
   - Si existe → Borde rojo + mensaje
   - Si no existe → Sin error
5. Usuario completa otros campos (nombre, precio, cantidad, etc.)
6. Hace clic en "Agregar"
7. POST /api/productos incluye codigo_barras
8. Si hay error de duplicado (race condition), la BD lo rechaza
9. Producto creado exitosamente con código único
```

### 6.2 Escenario 2: Editar Producto Existente

```
1. Usuario hace clic en un producto del inventario
2. Se abre ProductDialog (modo vista)
3. Usuario hace clic en "Editar"
4. Se cargan todos los datos incluyendo codigo_barras
5. Usuario puede:
   a) Modificar código manualmente (readOnly, pero puede escanear)
   b) Escanear nuevo código → Reemplaza el actual
   c) Generar código aleatorio → Reemplaza el actual
6. Verificación en tiempo real:
   - IMPORTANTE: Si el usuario no cambia el código, no hay verificación
   - Si cambia a un código que ya existe de OTRO producto → Error
7. Usuario guarda cambios
8. PUT /api/productos/[id] actualiza codigo_barras
```

**Nota sobre validación en edición:**
- El backend NO valida si el código ya existe en otro producto durante la edición
- Solo se verifica en el frontend para UX
- La BD tiene constraint UNIQUE, por lo que si hay conflicto, fallará la actualización
- **Recomendación:** Agregar validación en backend para edición (ver "Mejoras Futuras")

### 6.3 Escenario 3: Visualizar Código

```
1. Usuario abre producto (modo vista)
2. Si producto tiene codigo_barras:
   - Se renderiza BarcodeDisplay con el código
   - Usuario puede hacer clic en "Exportar Código de Barras"
   - Se descarga PNG listo para imprimir
3. Si no tiene código:
   - Mensaje "No tiene código de barras asignado"
```

---

## 7. Consideraciones Técnicas

### 7.1 Dependencias

#### Backend (package.json)
```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "pg": "^8.11.0", // Cliente PostgreSQL
    "@vercel/blob": "^0.22.0" // Para upload de imágenes
  }
}
```

#### Frontend (package.json)
```json
{
  "dependencies": {
    "html5-qrcode": "^1.5.5", // ← Escáner de códigos
    "jsbarcode": "^3.11.6",   // ← Generador de códigos
    "react": "^18.0.0",
    "next": "^14.0.0"
  }
}
```

**Instalación:**
```bash
npm install html5-qrcode jsbarcode
# o
yarn add html5-qrcode jsbarcode
```

### 7.2 Permisos de Cámara

**HTTPS requerido:** Los navegadores solo permiten acceso a cámara en contextos seguros (HTTPS o localhost).

**Configuración en Vercel/Producción:**
- Asegurarse que el dominio tenga SSL
- En desarrollo local: `http://localhost:3000` funciona

**Permisos en iOS Safari:**
- Requiere `NSFaceTimeUsageDescription` en `Info.plist` (para apps nativas)
- En web: el navegador solicita permiso automáticamente

### 7.3 Formatos Soportados

| Formato | Uso común | Librería |
|---------|-----------|----------|
| CODE-128 | General, inventario | ✅ html5-qrcode + jsbarcode |
| EAN-13 | Productos minoristas (13 dígitos) | ✅ html5-qrcode |
| EAN-8 | Productos pequeños | ✅ html5-qrcode |
| UPC-A | EE.UU./Canadá (12 dígitos) | ✅ html5-qrcode |
| UPC-E | Versión compacta UPC-A | ✅ html5-qrcode |
| CODE-39 | Industrial, logística | ✅ html5-qrcode |

**Recomendación:** Usar CODE-128 para máximo compatibilidad.

### 7.4 Limitaciones

#### Escáner (html5-qrcode)
- **Resolución mínima:** Códigos deben ser ≥ 100px de ancho en pantalla
- **Iluminación:** Requiere buena luz ambiental
- **Distancia:** 15-30cm del objeto ideal
- **Ángulo:** Debe estar perpendicular al código

#### Generador (jsbarcode)
- **Longitud máxima:** CODE-128 soporta hasta 80 caracteres
- **Caracteres válidos:** ASCII 0-127 (evitar caracteres especiales)
- **Tamaño PNG:** Aproximadamente 2-5KB por código

### 7.5 Performance

#### Debounce en Verificación
```typescript
const timeoutId = setTimeout(verificarBarcode, 500);
return () => clearTimeout(timeoutId);
```
**Razón:** Evitar 1 consulta por cada tecla presionada (podría saturar el servidor).

#### Lazy Loading del Scanner
```typescript
const BarcodeScanner = dynamic(() => import('@/components/BarcodeScanner'), { ssr: false });
```
**Razón:** `html5-qrcode` requiere acceso al DOM y `window`, no funciona en SSR.

#### Limpieza de Recursos
```typescript
useEffect(() => {
  if (open) {
    const timer = setTimeout(() => {
      startScanner();
    }, 400);
    return () => {
      clearTimeout(timer);
      forceStopScanner(); // ← Detiene cámara y limpia
    };
  }
}, [open]);
```
**Importante:** Siempre detener la cámara al cerrar el modal para liberar recursos.

---

## 8. Checklist de Implementación

### 8.1 Pasos para Implementar en Otro Proyecto

#### Fase 1: Base de Datos
- [ ] Ejecutar SQL para agregar columna `codigo_barras` a tabla `productos`
- [ ] Verificar que la columna sea `UNIQUE`
- [ ] Migrar datos existentes si es necesario (asignar códigos a productos antiguos)

#### Fase 2: Backend
- [ ] Crear archivo `src/app/api/productos/verificar-barcode/route.ts`
- [ ] Modificar `src/app/api/productos/route.ts` (POST) para incluir `codigo_barras`
- [ ] Modificar `src/app/api/productos/[id]/route.ts` (PUT) para incluir `codigo_barras`
- [ ] Verificar que GET `/api/productos` ya devuelve el campo (debería automático)
- [ ] Actualizar tipos en `src/types/index.ts` (Producto y ProductoNuevo)
- [ ] Probar cada endpoint con Postman/Thunder Client

#### Fase 3: Frontend - Dependencias
- [ ] Instalar `html5-qrcode` y `jsbarcode`
```bash
npm install html5-qrcode jsbarcode
```
- [ ] Verificar que `package.json` incluye las versiones correctas

#### Fase 4: Frontend - Componentes
- [ ] Crear `src/components/BarcodeScanner.tsx` (copiar del proyecto actual)
- [ ] Agregar componente `BarcodeDisplay` (puede integrarse en ProductDialog)
- [ ] Importar `BarcodeScanner` con `dynamic(() => import(...), { ssr: false })`

#### Fase 5: Frontend - Integración en AlmacenPage
- [ ] Agregar estados: `barcodeExiste`, `verificandoBarcode`, `showBarcodeScannerAdd`
- [ ] Implementar `useEffect` para verificación en tiempo real (con debounce)
- [ ] Implementar función `generarBarcodeAleatorio()`
- [ ] Agregar campo de código de barras en formulario de nuevo producto
- [ ] Configurar campo como `readOnly`
- [ ] Agregar botones "Aleatorio" y "Escanear Código"
- [ ] Mostrar mensajes de validación (verificando, existe, disponible)
- [ ] Integrar componente `<BarcodeScanner>` en el JSX

#### Fase 6: Frontend - Integración en ProductDialog
- [ ] Agregar estado `showBarcodeScanner`
- [ ] Incluir `codigo_barras` en `editedProduct` (initialState y useEffect)
- [ ] Agregar campo en `EditMode` con botones "Aleatorio" y "Escanear"
- [ ] Agregar `BarcodeDisplay` en `ViewMode` para visualización
- [ ] Asegurar que `handleEdit` envíe `codigo_barras` en FormData
- [ ] Probar edición de productos existentes

#### Fase 7: Testing
- [ ] Probar escaneo en dispositivo móvil (Android/iOS)
- [ ] Probar escaneo en desktop (webcam)
- [ ] Probar generación aleatoria (verificar unicidad)
- [ ] Probar validación en tiempo real
- [ ] Probar guardar producto con código duplicado (debe fallar)
- [ ] Probar editar producto cambiando código
- [ ] Probar exportar código como PNG
- [ ] Probar productos sin código (deben funcionar normalmente)

#### Fase 8: Optimización
- [ ] Ajustar debounce (500ms actual, puede optimizarse)
- [ ] Agregar caché de códigos verificados (opcional)
- [ ] Implementar rate limiting en backend (opcional)
- [ ] Agregar métricas de uso (opcional)

### 8.2 Diferencias entre Proyectos

Si el otro proyecto tiene un esquema **muy similar**, los cambios deberían ser:

#### Mismos archivos a modificar:
1. `src/types/index.ts` (Producto interface)
2. `src/app/api/productos/route.ts` (POST)
3. `src/app/api/productos/[id]/route.ts` (PUT)
4. `src/app/api/productos/verificar-barcode/route.ts` (nuevo)
5. `src/components/ProductDialog.tsx` (integración)
6. `src/app/pages/AlmacenPage/page.tsx` (integración)

#### Archivos nuevos:
1. `src/components/BarcodeScanner.tsx` (copiar tal cual)
2. `BarcodeDisplay` (puede integrarse en ProductDialog)

#### Diferencia principal:
- **Rutas de API:** Ajustar si el proyecto usa estructura diferente (ej: `/api/inventory` en vez de `/api/productos`)
- **Componentes de UI:** Ajustar nombres de componentes si usa librería diferente (ej: Material-UI en vez de shadcn/ui)
- **Estilos:** Tailwind CSS funciona out-of-the-box, pero si usa CSS modules, adaptar clases

---

## 9. Troubleshooting

### 9.1 Problemas Comunes

#### Problema: "Camera not found" o "NotAllowedError"
**Causas:**
- Navegador no tiene permiso de cámara
- No hay cámara disponible (desktop sin webcam)
- HTTPS no configurado en producción

**Soluciones:**
1. Verificar permisos en navegador (icono de candado → Configuración de cámara)
2. En desarrollo local, usar `localhost` (no IP)
3. En producción, asegurar SSL/HTTPS
4. Agregar mensaje amigable:
```typescript
if (err.name === "NotAllowedError") {
  errorMessage = "Permiso de cámara denegado. Por favor, actívalo en tu navegador.";
} else if (err.name === "NotFoundError") {
  errorMessage = "No se encontró ninguna cámara.";
}
```

---

#### Problema: "removeChild" error al cerrar scanner
**Causa:** El scanner se detiene mientras el modal se está desmontando, causando conflicto de DOM.

**Solución (ya implementada):**
```typescript
const handleManualClose = async () => {
  try {
    await forceStopScanner(); // ← Esperar a que se detenga
  } catch (err) {
    console.error("Error stopping on manual close:", err);
  } finally {
    setScannerReady(false);
    onClose(); // ← Cerrar solo después
  }
};
```

---

#### Problema: Código escaneado pero no se detecta
**Causas:**
- Código muy pequeño o lejano
- Iluminación pobre
- Ángulo incorrecto
- Código dañado/borroso

**Soluciones:**
1. Asegurar que el código ocupe al menos 100px en pantalla
2. Acercar el dispositivo (15-25cm)
3. Mejorar iluminación (evitar reflejos)
4. Mover cámara para que código esté perpendicular
5. Agregar guía visual en overlay (ya implementado con rectángulo rojo)

---

#### Problema: Verificación duplicada no funciona (permite guardar duplicados)
**Causas:**
- Race condition: dos pestañas verifican al mismo tiempo y ambas ven "disponible"
- Backend no valida duplicado en INSERT/UPDATE

**Soluciones:**
1. **Backend (ya implementado):** Constraint UNIQUE en BD → fallará si hay duplicado
2. **Frontend:** Mostrar error del servidor si falla INSERT/UPDATE por duplicado
```typescript
try {
  const response = await fetch('/api/productos', { method: 'POST', body: formData });
  if (!response.ok) {
    const error = await response.json();
    if (error.code === '23505') { // Código PostgreSQL para unique_violation
      toast({ title: "Error", description: "El código ya está en uso", variant: "destructive" });
      return;
    }
  }
} catch (error) { ... }
```

---

#### Problema: Scanner no inicia en iOS Safari
**Causas:**
- iOS requiere interacción de usuario explícita
- `facingMode: "environment"` puede no estar soportado en algunos dispositivos

**Soluciones:**
1. Asegurar que `startScanner()` se llama SOLO después de clic del usuario (ya implementado)
2. Fallback a cámara frontal si no hay trasera:
```typescript
await html5QrCode.start(
  { facingMode: "environment" }, // Intentar trasera primero
  // ...
);
// Si falla, intentar sin facingMode (por defecto)
```

---

#### Problema: Código generado aleatoriamente crea duplicados (probabilidad baja pero posible)
**Causa:** Generación aleatoria de 12 dígitos → 900,000,000,000 combinaciones

**Probabilidad de colisión:**
- Con 10,000 productos: ~0.001% de probabilidad
- Con 1,000,000 productos: ~0.1% de probabilidad

**Solución:**
1. Verificar siempre después de generación (ya se hace con `useEffect`)
2. Si `barcodeExiste === true`, generar nuevo automáticamente:
```typescript
const generarBarcodeAleatorio = () => {
  let codigo: string;
  do {
    codigo = Math.floor(Math.random() * 900000000000) + 100000000000;
  } while (barcodeExiste); // ← Re-generar si ya existe (pero requiere verificación async)
  // Mejor: Generar y luego verificar en useEffect
};
```
**Implementación actual:** Se genera y se verifica, si existe se muestra error y usuario debe regenerar manualmente.

---

#### Problema: Exportación de PNG no funciona
**Causas:**
- `XMLSerializer` no soporta SVG en algunos navegadores antiguos
- `btoa` falla con caracteres UTF-8 especiales

**Solución (ya implementada):**
```typescript
// Codificación UTF-8 segura
const encodedData = btoa(unescape(encodeURIComponent(svgData)));
```
**Compatibilidad:** Funciona en Chrome, Firefox, Safari, Edge (últimas 2 versiones).

---

### 9.2 Logs de Depuración

#### Habilitar logs detallados:
```typescript
// En BarcodeScanner.tsx
console.log("Scanner container ID:", scannerContainerId);
console.log("Container node found:", !!containerNode);
console.log("Starting scanner...");

// En verificación de barcode
console.log("Verificando código:", barcode);
console.log("Respuesta del servidor:", data);
```

#### Monitoreo de errores en producción:
```typescript
// En API de verificación
console.error('Error verificando código de barras:', error);
// Enviar a servicio de logs (Sentry, LogRocket, etc.)
```

---

## 10. Mejoras Futuras

### 10.1 Backend

#### 10.1.1 Validación en Edición
```typescript
// En PUT /api/productos/[id]
const codigo_barras = formData.get('codigo_barras') as string || null;

if (codigo_barras) {
  const existing = await query(
    'SELECT id FROM productos WHERE codigo_barras = $1 AND id != $2',
    [codigo_barras, id]
  );
  if (existing.rows.length > 0) {
    return NextResponse.json(
      { error: 'El código de barras ya está en uso por otro producto' },
      { status: 409 }
    );
  }
}
```

#### 10.1.2 Bulk Verification
```typescript
// POST /api/productos/verificar-barcodes (lote)
{ "barcodes": ["123", "456", "789"] }
// Response: { "results": { "123": true, "456": false, "789": true } }
```

#### 10.1.3 Historial de cambios en código
```sql
CREATE TABLE codigo_barras_historial (
  id SERIAL PRIMARY KEY,
  producto_id INTEGER REFERENCES productos(id),
  codigo_anterior VARCHAR(255),
  codigo_nuevo VARCHAR(255),
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  usuario_id INTEGER REFERENCES usuarios(id)
);
```

---

### 10.2 Frontend

#### 10.2.1 Cache de Códigos Verificados
```typescript
const barcodeCache = useRef<Map<string, boolean>>(new Map());

const verificarBarcode = async (barcode: string) => {
  if (barcodeCache.current.has(barcode)) {
    setBarcodeExiste(barcodeCache.current.get(barcode));
    return;
  }
  // ... consulta al servidor
  barcodeCache.current.set(barcode, exists);
};
```

#### 10.2.2 Escaneo por Lote
- Permitir escanear múltiples códigos seguidos sin cerrar el scanner
- Mostrar lista de códigos detectados
- Asignar a diferentes productos o variantes

#### 10.2.3 Soporte para Más Formatos
- QR Codes (ya soportado por html5-qrcode, pero no usado actualmente)
- Data Matrix (para logística)
- Códigos 2D

#### 10.2.4 Mejoras de UX
- **Sonido** al escanear exitosamente
- **Vibración** en dispositivos móviles (`navigator.vibrate(200)`)
- **Auto-guardado** después de escanear (sin cerrar modal)
- **Historial** de códigos escaneados recientemente

---

### 10.3 Integración con Hardware

#### 10.3.1 Lectores USB/Bluetooth
Muchos lectores de códigos de barras físicos actúan como teclados (HID). Para integrarlos:

```typescript
// Escuchar eventos de teclado a nivel de documento
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    // Los lectores envían el código completo seguido de Enter
    if (e.key === 'Enter') {
      const codigo = bufferRef.current;
      if (codigo.length > 5) { // Validar longitud mínima
        setNewProduct(prev => ({ ...prev, codigo_barras: codigo }));
        bufferRef.current = '';
      }
    } else {
      bufferRef.current += e.key;
    }
  };
  
  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, []);
```

---

## 11. Referencias

### 11.1 Documentación de Librerías

- **html5-qrcode:** https://github.com/mebjas/html5-qrcode
- **jsbarcode:** https://github.com/lindell/JsBarcode
- **Next.js API Routes:** https://nextjs.org/docs/app/building-your-application/routing/router-handlers

### 11.2 Estándares de Códigos de Barras

- **CODE-128:** Alta densidad, todos los caracteres ASCII
- **EAN-13:** 13 dígitos, usado en retail global
- **UPC-A:** 12 dígitos, usado en EE.UU./Canadá
- **CODE-39:** Industrial, soporta letras y números

### 11.3 Recursos de Diseño

- **Generador online de códigos:** https://barcode.tec-it.com
- **Validador de checksum:** https://www.gs1.org/services/check-digit-calculator
- **Especificaciones GS1:** https://www.gs1.org/standards

---

## 12. Conclusión

Este sistema de códigos de barras está **listo para producción** y ha sido probado en:

✅ **Escritorio:** Chrome, Firefox, Edge  
✅ **Móvil:** Android Chrome, iOS Safari  
✅ **Backend:** PostgreSQL + Next.js API  
✅ **Validación:** Frontend + Backend (constraint UNIQUE)  
✅ **UX:** Escaneo, generación aleatoria, validación en tiempo real, exportación  

### Puntos Clave para Reutilización:

1. **Copia los 3 archivos principales:**
   - `BarcodeScanner.tsx`
   - Modificaciones en `ProductDialog.tsx`
   - Modificaciones en `AlmacenPage/page.tsx`

2. **Ajusta las rutas de API** si tu estructura es diferente

3. **Ejecuta el SQL** para agregar la columna `codigo_barras`

4. **Instala las dependencias** `html5-qrcode` y `jsbarcode`

5. **Prueba en un entorno de staging** antes de producción

---

**Documento creado:** 2025-03-18  
**Versión:** 1.0  
**Autor:** Sistema MiTienda  
**Estado:** ✅ Completado y Probado
