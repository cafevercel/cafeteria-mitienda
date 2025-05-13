'use client'

import { useState, useEffect } from 'react'
import { format, parseISO, isValid } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { OptimizedImage } from '@/components/OptimizedImage'
import { getAllVentas, getInventario, deleteSale } from '@/app/services/api'
import { Venta } from '@/types'
import { toast } from "@/hooks/use-toast"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

// Interfaz extendida para el inventario
interface InventarioProducto {
  id: string;
  nombre: string;
  precio: number;
  precio_compra?: number;
  cantidad: number;
  foto?: string | null;
  tieneParametros?: boolean;
  tiene_parametros?: boolean;
  parametros?: Array<{
    nombre: string;
    cantidad: number;
  }>;
}

// Interfaz extendida para incluir propiedades adicionales en ventas
interface VentaExtendida extends Venta {
  vendedor_nombre?: string;
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

export default function VentasCafeteriaList({ searchTerm }: VentasCafeteriaListProps) {
  const [allVentas, setAllVentas] = useState<VentaExtendida[]>([])
  const [ventasDiarias, setVentasDiarias] = useState<VentaDia[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [productos, setProductos] = useState<InventarioProducto[]>([])
  const [ventaAEliminar, setVentaAEliminar] = useState<VentaExtendida | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const [ventas, inventario] = await Promise.all([
        getAllVentas(),
        getInventario()
      ])
      setAllVentas(ventas as VentaExtendida[])
      setProductos(inventario)
      // Agrupar por días
      const ventasPorDia = calcularVentasDiarias(ventas as VentaExtendida[], inventario)
      setVentasDiarias(ventasPorDia)
    } catch (err) {
      setError('Error al cargar las ventas')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleDeleteSale = async (venta: VentaExtendida) => {
    setVentaAEliminar(venta)
  }
  
  const confirmDeleteSale = async () => {
    if (!ventaAEliminar) return
    
    setIsDeleting(true)
    try {
      // Usamos '' como ID de vendedor para representar la cafetería
      await deleteSale(ventaAEliminar.id, ventaAEliminar.vendedor || '')
      
      // Recargamos los datos para reflejar los cambios
      await fetchData()
      
      toast({
        title: "Venta eliminada",
        description: "La venta ha sido eliminada y las cantidades devueltas al inventario",
      })
    } catch (error) {
      console.error('Error al eliminar la venta:', error)
      toast({
        title: "Error",
        description: "No se pudo eliminar la venta",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setVentaAEliminar(null)
    }
  }

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

      // Buscar el producto para obtener su precio de compra
      const producto = productos.find(p => p.id === venta.producto)
      
      // Calcular la ganancia bruta para esta venta (precio de venta - precio de compra)
      const precioCompra = producto?.precio_compra || 0
      const precioVenta = parseFloat(venta.precio_unitario.toString())
      const gananciaUnitaria = precioVenta - precioCompra
      const gananciaTotal = gananciaUnitaria * venta.cantidad
      
      // Agregar datos a la venta para mostrarlos
      const ventaConGanancia = {
        ...venta,
        ganancia_unitaria: gananciaUnitaria,
        ganancia_total: gananciaTotal
      }

      ventasPorDia[fechaKey].ventas.push(ventaConGanancia)
      ventasPorDia[fechaKey].total += parseFloat(venta.total.toString())
      ventasPorDia[fechaKey].ganancia += gananciaTotal
    })

    return Object.values(ventasPorDia).sort((a, b) => 
      new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    )
  }

  if (isLoading) return <div className="flex justify-center items-center h-full">Cargando ventas...</div>
  if (error) return <div className="text-red-500">{error}</div>

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
                        <p className="text-xs text-green-600">
                          Ganancia: ${formatPrice(v.ganancia_total)}
                        </p>
                        <p className="text-xs text-gray-500">{format(new Date(v.fecha), 'HH:mm')}</p>
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