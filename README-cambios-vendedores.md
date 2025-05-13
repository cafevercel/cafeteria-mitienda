# Cambios en la sección de Vendedores

## Descripción de cambios implementados

1. **Modificación de la interacción con vendedores**:
   - Los vendedores ya no pueden ser seleccionados haciendo clic en toda la tarjeta.
   - Se agregó un botón de 3 puntos al final de cada vendedor que despliega un menú para ver detalles.

2. **Implementación de control de acceso**:
   - Se agregó un checkbox al lado izquierdo de cada vendedor para activar/desactivar su acceso.
   - Si un vendedor está desactivado, no podrá iniciar sesión en el sistema.
   - Al intentar acceder, se mostrará el mensaje: "Acceso denegado. Por favor, póngase en contacto con el administrador."

3. **Cambios en la base de datos**:
   - Se agregó el campo `activo` (boolean) a la tabla de usuarios.
   - Por defecto, todos los usuarios se crean con este campo en `true`.
   - Se implementó una migración para añadir este campo a los usuarios existentes.

## Cómo ejecutar la migración

1. Accede a la página de migración de administración: `/pages/AdminMigration`
2. Haz clic en el botón "Ejecutar migración" para añadir el campo activo.
3. Los vendedores existentes serán marcados como activos por defecto.

## Archivos modificados

- `src/app/api/migration/add-active-field/route.ts` (nuevo)
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/register/route.ts`
- `src/app/api/users/vendedores/route.ts`
- `src/app/pages/AlmacenPage/page.tsx`
- `src/app/pages/AdminMigration/page.tsx` (nuevo)
- `src/app/services/api.ts`
- `src/types/index.ts` 