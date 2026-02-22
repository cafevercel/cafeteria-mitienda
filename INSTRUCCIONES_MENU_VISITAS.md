# Guía de Integración: Monitoreo de Visitas del Menú

## 📋 Resumen de Cambios Realizados en "cafeteria-mitienda"

Este proyecto ya cuenta con toda la infraestructura backend para registrar y monitorear las visitas del menú online. A continuación se detallan los cambios realizados y lo que necesitas implementar en el **proyecto del menú** (https://menu-mercado.vercel.app/).

---

## ✅ Cambios Ya Implementados

### 1. Base de Datos
- **Archivo**: `src/sql/crear_tabla_visitas_menu.sql`
- **Tabla creada**: `visitas_menu`
  - `id` (INT, AUTO_INCREMENT, PRIMARY KEY)
  - `url` (VARCHAR 500)
  - `fecha` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
  - `ip_address` (VARCHAR 45, opcional)
  - `user_agent` (TEXT, opcional)
  - `referrer` (VARCHAR 500, opcional)
- **Tabla auxiliar**: `visitas_menu_diarias` (para caché de estadísticas)

### 2. API Endpoints
- **Ruta**: `src/app/api/menu/visitas/route.ts`
- **Métodos**:
  - `POST /api/menu/visitas` - Registrar una nueva visita
  - `GET /api/menu/visitas` - Obtener estadísticas de visitas

**Parámetros GET**:
- `fecha_inicio` (YYYY-MM-DD) - Filtro fecha inicio
- `fecha_fin` (YYYY-MM-DD) - Filtro fecha fin
- `url` (string) - Filtrar por URL específica
- `agrupacion` ('dia' | 'mes' | 'total') - Cómo agrupar los datos

### 3. Tipos TypeScript
- **Archivo**: `src/types/index.ts`
- **Interfaz**: `VisitaMenu`
  ```typescript
  export interface VisitaMenu {
    id?: number;
    url: string;
    fecha: string;
    ip_address?: string;
    user_agent?: string;
    referrer?: string;
  }
  ```

### 4. Funciones de Servicio
- **Archivo**: `src/app/services/api.ts`
- **Funciones agregadas**:
  - `registrarVisitaMenu(data: {url, ip_address?, user_agent?, referrer?})`
  - `getVisitasMenu(params?)`

### 5. Interfaz de Administrador
- **Archivo**: `src/components/MenuSection.tsx`
- **Nueva pestaña**: "Visitas del Menú" (junto a "Orden de Secciones" y "Productos")
- **Características**:
  - Filtros por fecha
  - Agrupación por día/mes/total
  - Tabla de estadísticas
  - Tarjetas de resumen
  - Actualización manual

---

## 🔧 Cambios Requeridos en el Proyecto del Menú

### Paso 1: Agregar Script de Registro de Visitas

En el proyecto del menú (menu-mercado.vercel.app), necesitas agregar el siguiente código para registrar cada visita:

#### Opción A: Usando JavaScript (en el frontend)

```javascript
// En el componente principal del menú (ej: App.jsx o Menu.jsx)
// Agregar este useEffect al montar el componente

import { useEffect } from 'react';

const MENU_URL = 'https://menu-mercado.vercel.app/'; // URL de tu menú
const API_URL = 'https://cafeteria-mitienda.vercel.app'; // URL del backend

const registrarVisita = async () => {
  try {
    await fetch(`${API_URL}/api/menu/visitas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: MENU_URL,
        ip_address: undefined, // Se captura en el servidor
        user_agent: navigator.userAgent,
        referrer: document.referrer || undefined
      }),
    });
  } catch (error) {
    console.error('Error registrando visita:', error);
    // No mostrar error al usuario, es solo para estadísticas
  }
};

// Llamar al montar el componente
useEffect(() => {
  registrarVisita();
}, []);
```

#### Opción B: Usando un Hook Personalizado (Recomendado)

```javascript
// hooks/useRegistrarVisita.js
import { useEffect } from 'react';

const MENU_URL = 'https://menu-mercado.vercel.app/';
const API_URL = 'https://cafeteria-mitienda.vercel.app';

export const useRegistrarVisita = () => {
  useEffect(() => {
    const registrar = async () => {
      try {
        await fetch(`${API_URL}/api/menu/visitas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: MENU_URL,
            user_agent: navigator.userAgent,
            referrer: document.referrer || undefined
          }),
        });
      } catch (error) {
        console.error('Error registrando visita:', error);
      }
    };

    registrar();
  }, []);
};

// En tu componente principal:
// import { useRegistrarVisita } from './hooks/useRegistrarVisita';
// useRegistrarVisita();
```

### Paso 2: Configurar Variables de Entorno (Opcional)

Si el backend está en otra URL, crea un archivo `.env.local` en el proyecto del menú:

```env
NEXT_PUBLIC_API_URL_VISITAS=https://cafeteria-mitienda.vercel.app
```

Y modifica el código para usar esta variable:

```javascript
const API_URL = process.env.NEXT_PUBLIC_API_URL_VISITAS || 'https://cafeteria-mitienda.vercel.app';
```

### Paso 3: Probar la Integración

1. **Ejecutar el backend** (cafeteria-mitienda):
   ```bash
   npm run dev
   ```

2. **Abrir el menú** (menu-mercado.vercel.app) en el navegador

3. **Verificar registro**:
   - En la base de datos, ejecutar:
     ```sql
     SELECT * FROM visitas_menu ORDER BY fecha DESC LIMIT 10;
     ```
   - Deberías ver una nueva entrada cada vez que recargues el menú

4. **Ver estadísticas**:
   - Ir a AlmacenPage → Menú → Pestaña "Visitas del Menú"
   - Deberían aparecer los datos registrados

---

## 📊 Cómo Funciona el Sistema

### 1. Registro de Visitas
- Cada vez que un usuario carga la página del menú, se envía una petición POST a `/api/menu/visitas`
- El backend registra: URL, fecha/hora, user agent, referrer
- La IP se captura automáticamente en el servidor

### 2. Estadísticas
- **Por día**: Agrupa visitas por fecha (últimos 30 días por defecto)
- **Por mes**: Agrupa por mes/año
- **Total**: Totales acumulados con primera y última visita

### 3. Caché de Rendimiento
- Se usa la tabla `visitas_menu_diarias` para consultas rápidas
- Se actualiza automáticamente con cada nueva visita

---

## 🐛 Troubleshooting

### Error: "Failed to fetch"
- Verifica que el backend esté corriendo
- Revisa que la URL del API sea correcta
- Chequea CORS (el backend ya incluye headers apropiados)

### No aparecen datos en la pestaña de visitas
- Verifica que la tabla `visitas_menu` exista en la base de datos
- Ejecuta el script SQL: `src/sql/crear_tabla_visitas_menu.sql`
- Revisa la consola del navegador para errores de fetch

### La pestaña no se muestra
- Asegúrate de haber actualizado el componente `MenuSection.tsx`
- Verifica que el navegador no tenga caché (Ctrl+F5)

---

## 📁 Archivos Modificados/Creados en Este Proyecto

### Nuevos Archivos
- `src/sql/crear_tabla_visitas_menu.sql`
- `src/app/api/menu/visitas/route.ts`

### Archivos Modificados
- `src/types/index.ts` (agregada interfaz VisitaMenu)
- `src/app/services/api.ts` (agregadas funciones registrarVisitaMenu y getVisitasMenu)
- `src/components/MenuSection.tsx` (agregada pestaña de visitas)

---

## 🎯 Próximos Pasos Sugeridos

1. **Mejorar el tracking**:
   - Agregar unique visitors (por IP o cookie)
   - Tiempo promedio en página
   - Páginas más visitadas dentro del menú

2. **Dashboard avanzado**:
   - Gráficos con Chart.js o Recharts
   - Exportación a Excel/PDF
   - Alertas de tráfico inusual

3. **Optimizaciones**:
   - Implementar rate limiting para evitar spam
   - Agregar botón "No rastrear" para cumplir con GDPR
   - Cache de consultas con Redis

---

## 📞 Soporte

Si tienes problemas con la implementación:
1. Revisa los logs del servidor (console.log en los endpoints)
2. Verifica la conexión entre ambos proyectos
3. Asegúrate de que la base de datos esté accesible

---

**Fecha de creación**: 2025-02-22
**Versión**: 1.0.0
**Autor**: Sistema de Gestión Cafetería Mitienda
