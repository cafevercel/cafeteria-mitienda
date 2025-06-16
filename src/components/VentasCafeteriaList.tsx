'use client'

import { useState } from 'react'
import { format, parseISO, isValid } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { OptimizedImage } from '@/components/OptimizedImage'
import { Venta } from '@/types'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useVentas, useInventario, useDeleteSale } from '@/hooks/useQueries'

// Interfaces (mantener las mismas que tenías)
interface InventarioProducto {
  id: string;
  nombre: string;
  precio: number;
  precio_compra?: number;
  cantidad: number;
  foto?: string | null;
  tieneParametros?: boolean;
  tiene_parametros?: boolean;
  porcentajeGanancia?: number;
  parametros?: Array<{
    nombre: string;
    cantidad: number;
  }>;
}

interface VentaExtendida extends Venta {
  vendedor_nombre?: string;
  ganancia_unitaria?: number;
  ganancia_bruta_unitaria?: number;
  ganancia_bruta_total?: number;
  ganancia_porcentaje?: number;
  ganancia_total?: number;
  porcentaje_ganancia?: number;
}

interface VentaDia {
  fecha: string
  ventas: VentaExtendida[]
  total: number
  ganancia: number
}

interface VentasCafeteriaListProps {
  searchTerm: string
}

const formatDate = (dateString: string): string => {
  try {
    const date = parseISO(dateString)
    if (!isValid(date)) {
      console.error(`Invalid date string: ${dateString}`)
      return 'Fecha inválida'
    }
    return format(date, 'dd/MM/yyyy', { locale: es })
  } catch (error) {
    console.error(`Error formatting date: ${dateString}`, error)
    return 'Error en fecha'
  }
}

const formatPrice = (price: number | string | undefined): string => {
  if (typeof price === 'undefined') {
    return '0.00';
  }
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  return isNaN(numPrice) ? '0.00' : numPrice.toFixed(2);
}

// Mover la función calcularVentasDiarias antes de usarla
const calcularVentasDiarias = (ventas: VentaExtendida[], productos: InventarioProducto[]): VentaDia[] => {
  const ventasPorDia: { [key: string]: VentaDia } = {}

  ventas.forEach(venta => {
    const fechaObj = new Date(venta.fecha)
    const fechaKey = format(fechaObj, 'yyyy-MM-dd')

    if (!ventasPorDia[fechaKey]) {
      ventasPorDia[fechaKey] = {
        fecha: fechaKey,
        ventas: [],
        total: 0,
        ganancia: 0
      }
    }

    // Buscar el producto para obtener su precio de compra y porcentaje de ganancia
    const producto = productos.find(p => p.id === venta.producto)

    // Obtener los valores necesarios para el cálculo
    const precioCompra = producto?.precio_compra || 0
    const precioVenta = parseFloat(venta.precio_unitario.toString())
    const porcentajeGanancia = producto?.porcentajeGanancia || 0

    // Calcular la ganancia bruta para esta venta (precio de venta - precio de compra)
    const gananciaBrutaUnitaria = precioVenta - precioCompra

    // Calcular la ganancia porcentual (se aplica sobre el precio de venta, no sobre la ganancia bruta)
    let gananciaPorcentaje = 0
    if (porcentajeGanancia > 0) {
      gananciaPorcentaje = (precioVenta * porcentajeGanancia) / 100
    }

    // La ganancia unitaria es la ganancia bruta menos el porcentaje
    const gananciaUnitaria = gananciaBrutaUnitaria - gananciaPorcentaje

    // La ganancia total es la ganancia unitaria multiplicada por la cantidad
    const gananciaTotal = gananciaUnitaria * venta.cantidad

    // Agregar datos a la venta para mostrarlos
    const ventaConGanancia = {
      ...venta,
      ganancia_unitaria: gananciaUnitaria,
      ganancia_bruta_unitaria: gananciaBrutaUnitaria,
      ganancia_bruta_total: gananciaBrutaUnitaria * venta.cantidad,
      ganancia_porcentaje: gananciaPorcentaje,
      ganancia_total: gananciaTotal,
      porcentaje_ganancia: porcentajeGanancia
    }

    ventasPorDia[fechaKey].ventas.push(ventaConGanancia)
    ventasPorDia[fechaKey].total += parseFloat(venta.total.toString())
    ventasPorDia[fechaKey].ganancia += gananciaTotal
  })

  return Object.values(ventasPorDia).sort((a, b) =>
    new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  )
}

export default function VentasCafeteriaList({ searchTerm }: VentasCafeteriaListProps) {
  // Usar nuestros hooks personalizados
  const { data: ventas = [], isLoading: isLoadingVentas, error: ventasError } = useVentas();
  const { data: productos = [], isLoading: isLoadingProductos } = useInventario();
  const { mutate: deleteSaleMutation, isPending: isDeleting } = useDeleteSale();
  
  const [ventaAEliminar, setVentaAEliminar] = useState<VentaExtendida | null>(null);
  
  // Calcular ventas diarias cuando los datos estén disponibles
  const ventasDiarias = calcularVentasDiarias(ventas as VentaExtendida[], productos);

  const handleDeleteSale = async (venta: VentaExtendida) => {
    setVentaAEliminar(venta);
  }

  const confirmDeleteSale = async () => {
    if (!ventaAEliminar) return;
    
    // Usar la mutación en lugar de la función directa
    deleteSaleMutation({ 
      id: ventaAEliminar.id, 
      vendedorId: ventaAEliminar.vendedor || '' 
    });
    
    setVentaAEliminar(null);
  }

  if (isLoadingVentas || isLoadingProductos) return <div className="flex justify-center items-center h-full">Cargando ventas...</div>
  if (ventasError) return <div className="text-red-500">Error al cargar las ventas</div>

  const filteredVentasDiarias = ventasDiarias.filter(venta =>
    venta.ventas.some(v =>
      v.producto_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.vendedor_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      formatDate(v.fecha).toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.total.toString().includes(searchTerm)
    )
  )

  if (filteredVentasDiarias.length === 0) {
    return <div className="text-center py-4">No se encontraron ventas que coincidan con la búsqueda</div>
  }

  return (
    <div className="space-y-4">
      {filteredVentasDiarias.map((venta) => (
        <VentaDiaCard
          key={venta.fecha}
          venta={venta}
          searchTerm={searchTerm}
          onDeleteSale={handleDeleteSale}
        />
      ))}

      <AlertDialog open={ventaAEliminar !== null} onOpenChange={(open) => !open && setVentaAEliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la venta y devolverá las cantidades al inventario. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteSale}
              className="bg-red-500 hover:bg-red-600 text-white"
              disabled={isDeleting}
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Mantener el componente VentaDiaCard igual que antes
const VentaDiaCard = ({ venta, searchTerm, onDeleteSale }: { venta: VentaDia, searchTerm: string, onDeleteSale: (venta: VentaExtendida) => void }) => {
  const [expandido, setExpandido] = useState(false)

  const calcularTotalVentasFiltradas = () => {
    const ventasFiltradas = venta.ventas.filter(v =>
      v.producto_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.vendedor_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      formatDate(v.fecha).toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.total.toString().includes(searchTerm)
    );

    if (ventasFiltradas.length === 0) return 0;

    return ventasFiltradas.reduce((sum, v) => sum + parseFloat(v.total.toString()), 0);
  }

  const calcularGananciaVentasFiltradas = () => {
    const ventasFiltradas = venta.ventas.filter(v =>
      v.producto_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.vendedor_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      formatDate(v.fecha).toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.total.toString().includes(searchTerm)
    );

    if (ventasFiltradas.length === 0) return 0;

    return ventasFiltradas.reduce((sum, v) => sum + (v.ganancia_total || 0), 0);
  }

  return (
    <Card className="mb-2">
      <CardHeader className="p-4 cursor-pointer" onClick={() => setExpandido(!expandido)}>
        <div className="flex justify-between items-center">
          <CardTitle className="text-sm font-semibold">
            {formatDate(venta.fecha)}
          </CardTitle>
          <div className="flex items-center space-x-4">
            <div className="flex flex-col items-end">
              <span className="text-sm font-semibold">
                Total: ${formatPrice(searchTerm ? calcularTotalVentasFiltradas() : venta.total)}
              </span>
              <span className="text-xs text-green-600 font-medium">
                Ganancia: ${formatPrice(searchTerm ? calcularGananciaVentasFiltradas() : venta.ganancia)}
              </span>
            </div>
            <Button variant="ghost" size="icon">
              {expandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      {expandido && (
        <CardContent className="px-4 pb-4">
          <div className="space-y-2">
            {venta.ventas
              .filter(v =>
                v.producto_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                v.vendedor_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                formatDate(v.fecha).toLowerCase().includes(searchTerm.toLowerCase()) ||
                v.total.toString().includes(searchTerm)
              )
              .map((v) => (
                <div key={v.id} className="flex items-center p-2 border rounded">
                  <div className="flex-shrink-0 mr-4">
                    <OptimizedImage
                      src={v.producto_foto || '/placeholder.svg'}
                      fallbackSrc="/placeholder.svg"
                      alt={v.producto_nombre}
                      width={40}
                      height={40}
                      className="rounded-md"
                    />
                  </div>
                  <div className="flex-grow">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{v.producto_nombre}</p>
                        <p className="text-xs text-gray-500">
                          Cantidad: {v.cantidad} × ${formatPrice(v.precio_unitario)}
                        </p>
                        {v.parametros && v.parametros.length > 0 && v.parametros[0].nombre && (
                          <div className="text-xs text-gray-500 mt-1">
                            Parámetros:
                            <ul className="list-disc list-inside">
                              {v.parametros.map((p, idx) => (
                                <li key={idx}>
                                  {p.nombre}: {p.cantidad}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="mt-1 text-xs text-blue-600 font-medium">
                          Vendedor: {v.vendedor_nombre || 'Cafetería'}
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <p className="text-sm font-semibold">${formatPrice(v.total)}</p>
                        <div className="text-xs">
                          <p className="text-green-600">
                            Ganancia: ${formatPrice(v.ganancia_total || 0)}
                          </p>
                          {(v.porcentaje_ganancia || 0) > 0 && v.ganancia_bruta_total !== undefined && (
                            <p className="text-xs text-gray-500">
                              Neta: ${formatPrice(v.ganancia_bruta_total)}
                            </p>
                          )}
                          {(v.porcentaje_ganancia || 0) > 0 && (
                            <p className="text-xs text-gray-500">
                              -{v.porcentaje_ganancia}%
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:bg-red-50 mt-1 h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSale(v);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}