/**
 * Formatea un porcentaje como número entero sin decimales y calcula su valor monetario
 * @param porcentaje - El porcentaje a formatear
 * @param precioVenta - El precio de venta para calcular el valor del porcentaje
 * @returns String formateado con el porcentaje y su valor en pesos
 */
export function formatearPorcentajeGanancia(porcentaje: number, precioVenta: number): string {
  // Convertir a número entero
  const porcentajeEntero = Math.round(porcentaje);
  
  // Calcular el valor monetario del porcentaje
  const valorMonetario = (precioVenta * porcentajeEntero) / 100;
  
  // Formatear el valor monetario como moneda
  const valorFormateado = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(valorMonetario);
  
  // Retornar el formato "X% (valor)"
  return `${porcentajeEntero}% (${valorFormateado})`;
}