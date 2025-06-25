'use client'

import { useState, useEffect } from 'react'
import { format, isValid } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, Trash2, Edit } from 'lucide-react'
import { OptimizedImage } from '@/components/OptimizedImage'
import { getAllVentas, getInventario, deleteSale, editarVenta } from '@/app/services/api'
import { Venta, VentaParametro } from '@/types'
import { toast } from "@/hooks/use-toast"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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
  porcentajeGanancia?: number;
  parametros?: Array<{
    nombre: string;
    cantidad: number;
  }>;
}

// Interfaz extendida para incluir propiedades adicionales en ventas
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

const parseLocalDate = (dateString: string): Date => {
  let dateOnly: string;

  if (dateString.includes('T')) {
    // Formato ISO: "2025-06-18T00:00:00.000Z"
    dateOnly = dateString.split('T')[0];
  } else if (dateString.includes(' ')) {
    // Formato con espacio: "2025-06-18 00:00:00"
    dateOnly = dateString.split(' ')[0];
  } else {
    // Solo fecha: "2025-06-18"
    dateOnly = dateString;
  }

  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatDate = (dateString: string): string => {
  try {
    const date = parseLocalDate(dateString)
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

  // Estados para edición
  const [ventaAEditar, setVentaAEditar] = useState<VentaExtendida | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    productoId: '',
    cantidad: 1,
    fecha: '',
    parametros: [] as VentaParametro[]
  })

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

  // Función para manejar la edición de ventas
  const handleEditSale = (venta: VentaExtendida) => {
    setVentaAEditar(venta)

    // Formatear la fecha para el input date
    const fechaFormateada = venta.fecha.includes('T')
      ? venta.fecha.split('T')[0]
      : venta.fecha.split(' ')[0]

    setEditForm({
      productoId: venta.producto,
      cantidad: venta.cantidad,
      fecha: fechaFormateada,
      parametros: venta.parametros || []
    })
  }

  const confirmEditSale = async () => {
    if (!ventaAEditar) return

    setIsEditing(true)
    try {
      await editarVenta(
        ventaAEditar.id,
        editForm.productoId,
        editForm.cantidad,
        editForm.fecha,
        editForm.parametros,
        ventaAEditar.vendedor || ''
      )

      // Recargamos los datos para reflejar los cambios
      await fetchData()

      toast({
        title: "Venta editada",
        description: "La venta ha sido editada exitosamente",
      })
    } catch (error) {
      console.error('Error al editar la venta:', error)
      toast({
        title: "Error",
        description: "No se pudo editar la venta",
        variant: "destructive",
      })
    } finally {
      setIsEditing(false)
      setVentaAEditar(null)
    }
  }

  // Función para actualizar parámetros cuando cambia el producto
  const handleProductoChange = (productoId: string) => {
    const producto = productos.find(p => p.id === productoId)
    const tieneParametros = producto?.tiene_parametros || producto?.tieneParametros

    if (tieneParametros) {
      const parametrosIniciales = (producto.parametros || []).map(p => ({ nombre: p.nombre, cantidad: 0 }))
      setEditForm(prev => ({
        ...prev,
        productoId,
        parametros: parametrosIniciales,
        cantidad: 0 // Inicializar en 0 cuando tiene parámetros
      }))
    } else {
      setEditForm(prev => ({
        ...prev,
        productoId,
        parametros: [],
        cantidad: 1 // Valor por defecto para productos sin parámetros
      }))
    }
  }

  // Función para actualizar un parámetro específico
  const updateParametro = (index: number, cantidad: number) => {
    const nuevosParametros = editForm.parametros.map((param, i) =>
      i === index ? { ...param, cantidad } : param
    )

    // Calcular la cantidad total sumando todos los parámetros
    const cantidadTotal = nuevosParametros.reduce((sum, param) => sum + param.cantidad, 0)

    setEditForm(prev => ({
      ...prev,
      parametros: nuevosParametros,
      cantidad: cantidadTotal
    }))
  }

  const calcularVentasDiarias = (ventas: VentaExtendida[], productos: InventarioProducto[]): VentaDia[] => {
    const ventasPorDia: { [key: string]: VentaDia } = {}

    ventas.forEach(venta => {
      const fechaObj = parseLocalDate(venta.fecha)
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
      parseLocalDate(b.fecha).getTime() - parseLocalDate(a.fecha).getTime()
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

  const productoSeleccionado = productos.find(p => p.id === editForm.productoId)

  return (
    <div className="space-y-4">
      {filteredVentasDiarias.map((venta) => (
        <VentaDiaCard
          key={venta.fecha}
          venta={venta}
          searchTerm={searchTerm}
          onDeleteSale={handleDeleteSale}
          onEditSale={handleEditSale}
        />
      ))}

      {/* Dialog para eliminar venta */}
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

      {/* Dialog para editar venta */}
      <Dialog open={ventaAEditar !== null} onOpenChange={(open) => !open && setVentaAEditar(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Venta</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Selector de producto */}
            <div>
              <Label htmlFor="producto">Producto</Label>
              <Select value={editForm.productoId} onValueChange={handleProductoChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar producto" />
                </SelectTrigger>
                <SelectContent>
                  {productos.map((producto) => (
                    <SelectItem key={producto.id} value={producto.id}>
                      {producto.nombre} - ${formatPrice(producto.precio)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cantidad */}
            <div>
              <Label htmlFor="cantidad">Cantidad</Label>
              <Input
                id="cantidad"
                type="number"
                min="1"
                value={editForm.cantidad}
                onChange={(e) => setEditForm(prev => ({ ...prev, cantidad: parseInt(e.target.value) || 1 }))}
                readOnly={productoSeleccionado?.tiene_parametros || productoSeleccionado?.tieneParametros}
                className={`${(productoSeleccionado?.tiene_parametros || productoSeleccionado?.tieneParametros) ? 'bg-gray-100' : ''}`}
              />
              {(productoSeleccionado?.tiene_parametros || productoSeleccionado?.tieneParametros) && (
                <p className="text-xs text-gray-500 mt-1">
                  La cantidad se calcula automáticamente sumando los parámetros
                </p>
              )}
            </div>


            {/* Fecha */}
            <div>
              <Label htmlFor="fecha">Fecha</Label>
              <Input
                id="fecha"
                type="date"
                value={editForm.fecha}
                onChange={(e) => setEditForm(prev => ({ ...prev, fecha: e.target.value }))}
              />
            </div>

            {/* Parámetros si el producto los tiene */}
            {(productoSeleccionado?.tiene_parametros || productoSeleccionado?.tieneParametros) &&
              productoSeleccionado?.parametros && productoSeleccionado.parametros.length > 0 && (
                <div>
                  <Label>Parámetros</Label>
                  <div className="space-y-2">
                    {editForm.parametros.map((param, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <Label className="w-20 text-sm">{param.nombre}:</Label>
                        <Input
                          type="number"
                          min="0"
                          value={param.cantidad}
                          onChange={(e) => updateParametro(index, parseInt(e.target.value) || 0)}
                          className="flex-1"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setVentaAEditar(null)}
              disabled={isEditing}
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmEditSale}
              disabled={isEditing}
            >
              {isEditing ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const VentaDiaCard = ({
  venta,
  searchTerm,
  onDeleteSale,
  onEditSale
}: {
  venta: VentaDia,
  searchTerm: string,
  onDeleteSale: (venta: VentaExtendida) => void,
  onEditSale: (venta: VentaExtendida) => void
}) => {
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
                        <div className="flex space-x-1 mt-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-blue-500 hover:bg-blue-50 h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditSale(v);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:bg-red-50 h-7 w-7"
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
                </div>
              ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
