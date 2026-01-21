import React, { useState, useCallback, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
import Image from 'next/image'
import { Vendedor, Producto, Venta, Transaccion, TransaccionParametro } from '@/types'
import { Minus, DollarSign, ArrowLeftRight, Search, ChevronDown, ChevronUp, Loader2, ArrowUpDown, FileDown, X, Edit2 } from 'lucide-react'
import { format, parseISO, startOfWeek, endOfWeek, isValid, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import * as XLSX from 'xlsx'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { editarVenta } from '@/app/services/api'

interface VendorDialogProps {
  almacen: Producto[]// Añadir esta prop
  vendor: Vendedor
  onClose: () => void
  onEdit: (editedVendor: Vendedor) => Promise<void>
  productos: Producto[]
  transacciones: Transaccion[]
  ventas: Venta[]
  ventasSemanales: VentaSemana[]
  ventasDiarias: VentaDia[]
  initialMode?: 'view' | 'edit' | 'ventas' | 'productos' | 'transacciones'
  onProductReduce: (
    productId: string,
    vendorId: string,
    cantidad: number,
    parametros?: { nombre: string; cantidad: number }[]
  ) => Promise<void>
  onDeleteSale: (saleId: string, vendedorId: string) => Promise<void>
  onProductMerma: (
    productId: string,
    vendorId: string,
    cantidad: number,
    parametros?: { nombre: string; cantidad: number }[]
  ) => Promise<void>
  vendedores: Vendedor[]
  onProductTransfer: (
    productId: string,
    fromVendorId: string,
    toVendorId: string,
    cantidad: number,
    parametros?: Array<{ nombre: string; cantidad: number }>
  ) => Promise<void>;
  onDeleteVendorData: (vendorId: string) => Promise<void>;
  onUpdateProductQuantity?: (
    vendorId: string,
    productId: string,
    newQuantity: number,
    parametros?: Array<{ nombre: string; cantidad: number }>
  ) => Promise<void>;
}

interface ComparativeData {
  id: string;
  nombre: string;
  cantidadVendedor: number;
  cantidadAlmacen: number;
  precio: number;
  parametrosVendedor?: Array<{ nombre: string; cantidad: number }>;
  parametrosAlmacen?: Array<{ nombre: string; cantidad: number }>;
  tieneParametros: boolean;
}

interface InconsistenciaData {
  id: string;
  nombre: string;
  cantidadActual: number;
  cantidadCalculada: number;
  diferencia: number;
  entregas: number;
  bajas: number;
  ventas: number;
  parametros?: Array<{
    nombre: string;
    cantidadActual: number;
    cantidadCalculada: number;
    diferencia: number;
    entregas: number;
    bajas: number;
    ventas: number;
  }>;
  tieneParametros: boolean;
}

interface VentaSemana {
  fechaInicio: string
  fechaFin: string
  ventas: Venta[]
  total: number
  ganancia: number
}

interface VentaDia {
  fecha: string
  ventas: Venta[]
  total: number
}

interface VentaDiaDesplegableProps {
  venta: VentaDia;
  onDeleteSale: (saleId: string) => Promise<void>; // Agregar esta prop
  onEditSale: (sale: Venta) => void; // ← AGREGAR
}

const VentaDiaDesplegable: React.FC<VentaDiaDesplegableProps> = ({ venta, onDeleteSale, onEditSale }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [deletingSaleId, setDeletingSaleId] = useState<string | null>(null);
  const [expandedSales, setExpandedSales] = useState<Record<string, boolean>>({});

  const handleDelete = async (saleId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('¿Estás seguro de eliminar esta venta? La cantidad se devolverá al inventario del vendedor.')) {
      return;
    }

    setDeletingSaleId(saleId);
    try {
      await onDeleteSale(saleId);
    } finally {
      setDeletingSaleId(null);
    }
  };

  return (
    <Card>
      <CardHeader
        className="cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex justify-between items-center">
          <CardTitle className="text-base flex items-center gap-2">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            {format(parseISO(venta.fecha), 'dd/MM/yyyy', { locale: es })}
          </CardTitle>
          <span className="font-bold">${venta.total.toFixed(2)}</span>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          <div className="space-y-2">
            {venta.ventas.map((v) => {
              const tieneParametros = v.parametros && Array.isArray(v.parametros) && v.parametros.length > 0;
              const isVentaExpanded = expandedSales[v.id] || false;

              return (
                <div key={v.id} className="border rounded overflow-hidden">
                  <div
                    className={`flex justify-between items-center p-2 ${tieneParametros ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                    onClick={() => {
                      if (tieneParametros) {
                        setExpandedSales(prev => ({
                          ...prev,
                          [v.id]: !prev[v.id]
                        }));
                      }
                    }}
                  >
                    <div className="flex-grow">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{v.producto_nombre}</p>
                        {tieneParametros && (
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${isVentaExpanded ? 'rotate-180' : ''}`}
                          />
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        Cantidad: {v.cantidad} - Precio unitario: ${v.precio_unitario}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">${parseFloat(v.total.toString()).toFixed(2)}</span>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => handleDelete(v.id, e)}
                        disabled={deletingSaleId === v.id}
                      >
                        {deletingSaleId === v.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditSale(v);
                        }}
                        disabled={deletingSaleId === v.id}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>

                    </div>
                  </div>

                  {/* Mostrar parámetros si existen y está expandido */}
                  {tieneParametros && isVentaExpanded && (
                    <div className="bg-gray-50 px-4 py-2 border-t">
                      <p className="text-xs font-semibold text-gray-600 mb-2">Detalles:</p>
                      <div className="space-y-1">
                        {v.parametros!.map((param, index) => (
                          <div key={index} className="flex justify-between items-center text-sm">
                            <span className="text-gray-700">{param.nombre}</span>
                            <span className="font-medium">Cantidad: {param.cantidad}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
};



interface VentaSemanaDesplegableProps {
  venta: VentaSemana;
  onDeleteSale: (saleId: string) => Promise<void>; // Agregar esta prop
  onEditSale: (sale: Venta) => void; // ← AGREGAR
}

const VentaSemanaDesplegable: React.FC<VentaSemanaDesplegableProps> = ({ venta, onDeleteSale, onEditSale }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [deletingSaleId, setDeletingSaleId] = useState<string | null>(null);
  const [expandedSales, setExpandedSales] = useState<Record<string, boolean>>({});

  const handleDelete = async (saleId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('¿Estás seguro de eliminar esta venta? La cantidad se devolverá al inventario del vendedor.')) {
      return;
    }

    setDeletingSaleId(saleId);
    try {
      await onDeleteSale(saleId);
    } finally {
      setDeletingSaleId(null);
    }
  };

  return (
    <Card>
      <CardHeader
        className="cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex justify-between items-center">
          <CardTitle className="text-base flex items-center gap-2">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            {format(parseISO(venta.fechaInicio), 'dd/MM/yyyy', { locale: es })} - {format(parseISO(venta.fechaFin), 'dd/MM/yyyy', { locale: es })}
          </CardTitle>
          <div className="text-right">
            <p className="font-bold">${venta.total.toFixed(2)}</p>
            <p className="text-sm text-gray-500">Ganancia: ${venta.ganancia.toFixed(2)}</p>
          </div>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          <div className="space-y-2">
            {venta.ventas.map((v) => {
              const tieneParametros = v.parametros && Array.isArray(v.parametros) && v.parametros.length > 0;
              const isVentaExpanded = expandedSales[v.id] || false;

              return (
                <div key={v.id} className="border rounded overflow-hidden">
                  <div
                    className={`flex justify-between items-center p-2 ${tieneParametros ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                    onClick={() => {
                      if (tieneParametros) {
                        setExpandedSales(prev => ({
                          ...prev,
                          [v.id]: !prev[v.id]
                        }));
                      }
                    }}
                  >
                    <div className="flex-grow">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{v.producto_nombre}</p>
                        {tieneParametros && (
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${isVentaExpanded ? 'rotate-180' : ''}`}
                          />
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {format(parseISO(v.fecha), 'dd/MM/yyyy', { locale: es })} - Cantidad: {v.cantidad}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">${parseFloat(v.total.toString()).toFixed(2)}</span>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => handleDelete(v.id, e)}
                        disabled={deletingSaleId === v.id}
                      >
                        {deletingSaleId === v.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditSale(v);
                        }}
                        disabled={deletingSaleId === v.id}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>


                    </div>
                  </div>

                  {/* Mostrar parámetros si existen y está expandido */}
                  {tieneParametros && isVentaExpanded && (
                    <div className="bg-gray-50 px-4 py-2 border-t">
                      <p className="text-xs font-semibold text-gray-600 mb-2">Detalles:</p>
                      <div className="space-y-1">
                        {v.parametros!.map((param, index) => (
                          <div key={index} className="flex justify-between items-center text-sm">
                            <span className="text-gray-700">{param.nombre}</span>
                            <span className="font-medium">Cantidad: {param.cantidad}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
};


export default function VendorDialog({
  vendor,
  almacen,
  onClose,
  onEdit,
  productos,
  transacciones,
  ventas,
  ventasSemanales,
  ventasDiarias,
  onProductReduce,
  onDeleteSale,
  onProductMerma,
  vendedores,
  onProductTransfer,
  onDeleteVendorData,
  onUpdateProductQuantity,
  initialMode = 'view'
}: VendorDialogProps) {

  console.log('=== VENDOR DIALOG - Props recibidas ===')
  console.log('Productos completos:', productos)
  console.log('Cantidad de productos:', productos.length)
  const [mode, setMode] = useState<'view' | 'edit' | 'ventas' | 'productos' | 'transacciones'>(initialMode)
  const [editedVendor, setEditedVendor] = useState(vendor)
  const [searchTerm, setSearchTerm] = useState('')
  const [ventasLocales, setVentasLocales] = useState<Venta[]>(ventas)
  const [reduceDialogOpen, setReduceDialogOpen] = useState(false)
  const [productToReduce, setProductToReduce] = useState<Producto | null>(null)
  const [quantityToReduce, setQuantityToReduce] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [ventasSemanalesState, setVentasSemanales] = useState<VentaSemana[]>([])
  const [sortBy, setSortBy] = useState<'nombre' | 'cantidad'>('nombre')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [ventasEspecificas, setVentasEspecificas] = useState<{ producto: string; cantidad: number }[]>([])
  const [sortByVentas, setSortByVentas] = useState<'asc' | 'desc'>('desc')
  const [ventasDiariasLocales, setVentasDiariasLocales] = useState<VentaDia[]>(ventasDiarias)
  const [showDestinationDialog, setShowDestinationDialog] = useState(false)
  const [selectedDestination, setSelectedDestination] = useState<'almacen' | 'merma' | 'vendedor' | null>(null)
  const [showVendorSelectDialog, setShowVendorSelectDialog] = useState(false)
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null)
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({})
  const [parameterQuantities, setParameterQuantities] = useState<Record<string, number>>({})
  const [expandedTransactions, setExpandedTransactions] = useState<Record<string, boolean>>({});
  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showComparativeTable, setShowComparativeTable] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'lessThan5' | 'outOfStock' | 'notInVendor'>('all');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
  const [sortField, setSortField] = useState<keyof Pick<ComparativeData, 'cantidadVendedor' | 'cantidadAlmacen' | 'precio'> | null>(null);
  const [expandedComparativeProducts, setExpandedComparativeProducts] = useState<Record<string, boolean>>({});
  const [showInconsistenciasTable, setShowInconsistenciasTable] = useState(false);
  const [expandedInconsistencias, setExpandedInconsistencias] = useState<Record<string, boolean>>({});
  const [showEditQuantityDialog, setShowEditQuantityDialog] = useState(false);
  const [productToEdit, setProductToEdit] = useState<InconsistenciaData | null>(null);
  const [newQuantities, setNewQuantities] = useState<Record<string, number>>({});
  const [isUpdatingQuantity, setIsUpdatingQuantity] = useState(false);
  const [showEditSaleDialog, setShowEditSaleDialog] = useState(false);
  const [saleToEdit, setSaleToEdit] = useState<Venta | null>(null);
  const [editSaleQuantity, setEditSaleQuantity] = useState(0);
  const [editSaleParametros, setEditSaleParametros] = useState<Record<string, number>>({});




  const getComparativeData = useCallback((): ComparativeData[] => {
    // Función de utilidad para validar parámetros
    const validarParametro = (parametro: any) => {
      // Verificar que el parámetro sea un objeto válido
      if (!parametro || typeof parametro !== 'object') return false;

      // Verificar que tenga un nombre válido (no solo números)
      if (!parametro.nombre || typeof parametro.nombre !== 'string') return false;
      if (/^\d+$/.test(parametro.nombre)) return false;

      // Verificar que la cantidad sea un número
      if (isNaN(parametro.cantidad)) return false;

      return true;
    };

    // Crear un array con todos los IDs únicos (con validación)
    const uniqueIds = Array.from(
      new Set([
        ...productos.filter(p => p && p.id).map(p => p.id),
        ...almacen.filter(p => p && p.id).map(p => p.id)
      ])
    );

    // Mapear los IDs únicos a los datos de productos
    const allProducts = uniqueIds.map(productId => {
      const productoVendedor = productos.find(p => p.id === productId);
      const productoAlmacen = almacen.find(p => p.id === productId);

      // Filtrar y validar parámetros del vendedor
      const parametrosVendedor = productoVendedor?.parametros
        ? productoVendedor.parametros
          .filter(validarParametro)
          .map(param => ({ ...param }))
        : [];

      // Filtrar y validar parámetros del almacén
      const parametrosAlmacen = productoAlmacen?.parametros
        ? productoAlmacen.parametros
          .filter(validarParametro)
          .map(param => ({ ...param }))
        : [];

      const getCantidadTotal = (producto: Producto | undefined, parametros: Array<{ nombre: string; cantidad: number }>) => {
        if (!producto) return 0;
        if (parametros && parametros.length > 0) {
          return parametros
            .filter(param => param.cantidad > 0)
            .reduce((total, param) => total + (param.cantidad || 0), 0);
        }
        return producto.cantidad;
      };

      const cantidadVendedor = getCantidadTotal(productoVendedor, parametrosVendedor);
      const cantidadAlmacen = getCantidadTotal(productoAlmacen, parametrosAlmacen);

      // Verificar si tiene parámetros válidos
      const tieneParametros = parametrosVendedor.length > 0 || parametrosAlmacen.length > 0;

      return {
        id: productId,
        nombre: productoAlmacen?.nombre || productoVendedor?.nombre || '',
        cantidadVendedor,
        cantidadAlmacen,
        precio: productoAlmacen?.precio || productoVendedor?.precio || 0,
        parametrosVendedor,
        parametrosAlmacen,
        tieneParametros
      };
    });

    // Aplicar filtros
    const filteredData = allProducts
      .filter(item =>
        item.nombre.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .filter(item => {
        switch (filterType) {
          case 'lessThan5':
            return item.cantidadVendedor < 5 && item.cantidadVendedor > 0;
          case 'outOfStock':
            return item.cantidadVendedor === 0;
          case 'notInVendor':
            return item.cantidadVendedor === 0 && item.cantidadAlmacen > 0;
          default:
            return true;
        }
      });

    // Ordenamiento
    if (sortField && sortDirection) {
      filteredData.sort((a, b) => {
        const compareValue = a[sortField] - b[sortField];
        return sortDirection === 'asc' ? compareValue : -compareValue;
      });
    }

    return filteredData;
  }, [productos, almacen, searchTerm, filterType, sortField, sortDirection]);



  const handleComparativeSort = (field: 'cantidadVendedor' | 'cantidadAlmacen' | 'precio') => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortField(null);
        setSortDirection(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };



  const handleDeleteVendorData = async () => {
    try {
      setIsDeleting(true);
      await onDeleteVendorData(vendor.id);
      toast({
        title: "Éxito",
        description: "Los datos del vendedor han sido eliminados correctamente.",
      });
      setDeleteConfirmDialogOpen(false);
      onClose(); // Cerrar el diálogo principal
    } catch (error) {
      console.error('Error al eliminar los datos:', error);
      toast({
        title: "Error",
        description: "No se pudieron eliminar los datos del vendedor. Por favor, inténtelo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleExpand = (transactionId: string) => {
    setExpandedTransactions(prev => ({
      ...prev,
      [transactionId]: !prev[transactionId]
    }));
  };


  // En el componente VendorDialog
  const handleDeleteSale = async (saleId: string) => {
    try {
      await onDeleteSale(saleId, vendor.id)

      // Actualizar ventasLocales
      setVentasLocales(prevVentas => prevVentas.filter(v => v.id !== saleId))

      // Actualizar ventasDiariasLocales
      setVentasDiariasLocales(prevVentasDiarias =>
        prevVentasDiarias.map(ventaDia => ({
          ...ventaDia,
          ventas: ventaDia.ventas.filter(v => v.id !== saleId),
          total: ventaDia.ventas
            .filter(v => v.id !== saleId)
            .reduce((sum, v) => sum + parseFloat(v.total.toString()), 0)
        })).filter(ventaDia => ventaDia.ventas.length > 0)
      )

      // Recalcular ventas semanales
      const nuevasVentasLocales = ventasLocales.filter(v => v.id !== saleId)
      const nuevasVentasSemanales = agruparVentasPorSemana(nuevasVentasLocales)
      setVentasSemanales(nuevasVentasSemanales)

      // Recalcular ventas específicas
      calcularVentasEspecificas()

      toast({
        title: "Éxito",
        description: "La venta se ha eliminado correctamente.",
      })
    } catch (error) {
      console.error('Error al eliminar la venta:', error)
      toast({
        title: "Error",
        description: "No se pudo eliminar la venta. Por favor, inténtelo de nuevo.",
        variant: "destructive",
      })
    }
  }

  const handleEditSale = async () => {
    if (!saleToEdit) return;

    try {
      setIsLoading(true);

      const parametrosEdicion = saleToEdit.parametros && saleToEdit.parametros.length > 0
        ? Object.entries(editSaleParametros)
          .filter(([_, cantidad]) => cantidad > 0)
          .map(([nombre, cantidad]) => ({ nombre, cantidad }))
        : undefined;

      await editarVenta(
        saleToEdit.id,
        saleToEdit.producto,
        saleToEdit.parametros && saleToEdit.parametros.length > 0 ? 0 : editSaleQuantity,
        saleToEdit.fecha,
        parametrosEdicion,
        vendor.id
      );

      // Actualizar estados locales
      setVentasLocales(prevVentas =>
        prevVentas.map(v => v.id === saleToEdit.id ? { ...v, cantidad: editSaleQuantity } : v)
      );

      setVentasDiariasLocales(prevVentasDiarias =>
        prevVentasDiarias.map(ventaDia => ({
          ...ventaDia,
          ventas: ventaDia.ventas.map(v => v.id === saleToEdit.id ? { ...v, cantidad: editSaleQuantity } : v)
        }))
      );

      // Recalcular ventas semanales y específicas
      const nuevasVentasLocales = ventasLocales.map(v =>
        v.id === saleToEdit.id ? { ...v, cantidad: editSaleQuantity } : v
      );
      setVentasSemanales(agruparVentasPorSemana(nuevasVentasLocales));
      calcularVentasEspecificas();

      toast({
        title: "Éxito",
        description: "La venta se ha editado correctamente.",
      });

      setShowEditSaleDialog(false);
      setSaleToEdit(null);
    } catch (error) {
      console.error('Error al editar la venta:', error);
      toast({
        title: "Error",
        description: "No se pudo editar la venta. Por favor, inténtelo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenEditSale = (sale: Venta) => {
    setSaleToEdit(sale);
    setEditSaleQuantity(sale.cantidad);
    if (sale.parametros && sale.parametros.length > 0) {
      const initialParams: Record<string, number> = {};
      sale.parametros.forEach(p => {
        initialParams[p.nombre] = p.cantidad;
      });
      setEditSaleParametros(initialParams);
    } else {
      setEditSaleParametros({});
    }
    setShowEditSaleDialog(true);
  };



  const calcularVentasEspecificas = useCallback(() => {
    const ventasPorProducto = ventasLocales.reduce((acc, venta) => {
      if (!acc[venta.producto_nombre]) {
        acc[venta.producto_nombre] = 0
      }
      acc[venta.producto_nombre] += venta.cantidad
      return acc
    }, {} as Record<string, number>)

    const ventasEspecificasArray = Object.entries(ventasPorProducto).map(([producto, cantidad]) => ({
      producto,
      cantidad
    }))

    setVentasEspecificas(ventasEspecificasArray)
  }, [ventasLocales])

  useEffect(() => {
    calcularVentasEspecificas()
  }, [ventas, calcularVentasEspecificas])

  const sortVentasEspecificas = () => {
    setSortByVentas(prev => prev === 'asc' ? 'desc' : 'asc')
    setVentasEspecificas(prev =>
      [...prev].sort((a, b) =>
        sortByVentas === 'asc' ? a.cantidad - b.cantidad : b.cantidad - a.cantidad
      )
    )
  }

  const renderVentasEspecificas = () => {
    return (
      <div className="space-y-4">
        <Button onClick={sortVentasEspecificas} className="mb-4">
          Ordenar por cantidad de ventas
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Cantidad Vendida</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ventasEspecificas.map((venta) => (
              <TableRow key={venta.producto}>
                <TableCell>{venta.producto}</TableCell>
                <TableCell>{venta.cantidad}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  const exportToExcel = useCallback(() => {
    let dataToExport: any[] = [];
    let fileName = '';

    if (mode === 'productos') {
      dataToExport = productos.map(producto => ({
        Nombre: producto.nombre,
        Precio: producto.precio,
        Cantidad: producto.cantidad
      }));
      fileName = `productos_${vendor.nombre}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    } else if (mode === 'ventas') {
      dataToExport = ventas.map(venta => ({
        Fecha: format(parseISO(venta.fecha), 'dd/MM/yyyy'),
        Producto: venta.producto_nombre,
        Cantidad: venta.cantidad,
        'Precio Unitario': venta.precio_unitario,
        Total: venta.total
      }));
      fileName = `ventas_${vendor.nombre}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    } else if (mode === 'transacciones') {
      dataToExport = transacciones.map(transaccion => ({
        Fecha: format(parseISO(transaccion.fecha), 'dd/MM/yyyy'),
        Producto: transaccion.producto,
        Cantidad: transaccion.cantidad,
        Tipo: transaccion.tipo || 'Normal',
        Precio: transaccion.precio
      }));
      fileName = `transacciones_${vendor.nombre}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    }

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, fileName);
  }, [mode, productos, ventas, transacciones, vendor.nombre]);

  const handleSort = (key: 'nombre' | 'cantidad') => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortOrder('asc')
    }
  }

  const sortAndFilterProducts = useCallback((products: Producto[]) => {
    const calcularCantidadTotal = (producto: Producto) => {
      if (producto.parametros && producto.parametros.length > 0) {


        console.log('Parámetros del producto:', producto.nombre, producto.parametros); // Log temporal
        return producto.parametros
          .filter(param => param.cantidad > 0) // Solo contar parámetros con cantidad > 0
          .reduce((total, param) => total + (param.cantidad || 0), 0)
      }
      return producto.cantidad
    }

    return products
      .filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === 'nombre') {
          return sortOrder === 'asc'
            ? a.nombre.localeCompare(b.nombre)
            : b.nombre.localeCompare(a.nombre)
        } else {
          const cantidadA = calcularCantidadTotal(a)
          const cantidadB = calcularCantidadTotal(b)
          return sortOrder === 'asc'
            ? cantidadA - cantidadB
            : cantidadB - cantidadA
        }
      })
  }, [searchTerm, sortBy, sortOrder])


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

  const formatPrice = (price: number | string): string => {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price
    return numPrice.toFixed(2)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setEditedVendor(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleEdit = async () => {
    try {
      setIsLoading(true)
      await onEdit(editedVendor)
      setMode('view')
      toast({
        title: "Éxito",
        description: "Los datos del vendedor se han actualizado correctamente.",
      })
    } catch (error) {
      console.error('Error al editar el vendedor:', error)
      toast({
        title: "Error",
        description: "No se pudo actualizar los datos del vendedor. Por favor, inténtelo de nuevo.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleReduceProduct = async (destination: 'almacen' | 'merma' | 'vendedor') => {
    console.log('🔵 handleReduceProduct llamado con destino:', destination);
    console.log('🔵 productToReduce:', productToReduce);

    if (!productToReduce) {
      console.log('❌ No hay producto para reducir');
      return;
    }

    // Verificar dinámicamente si tiene parámetros válidos
    const parametrosValidos = productToReduce.parametros?.filter(param =>
      param.cantidad > 0 &&
      param.nombre.trim() !== '' &&
      isNaN(Number(param.nombre))
    ) || [];

    const tieneParametrosValidos = parametrosValidos.length > 0;

    // Validar que hay cantidad a reducir
    const totalAReducir = tieneParametrosValidos
      ? Object.values(parameterQuantities).reduce((sum, val) => sum + val, 0)
      : quantityToReduce;

    console.log('🔵 Total a reducir:', totalAReducir);
    console.log('🔵 tieneParametrosValidos:', tieneParametrosValidos);
    console.log('🔵 parametrosValidos:', parametrosValidos);
    console.log('🔵 parameterQuantities:', parameterQuantities);
    console.log('🔵 quantityToReduce:', quantityToReduce);

    if (totalAReducir === 0) {
      console.log('❌ Total a reducir es 0');
      toast({
        title: "Error",
        description: "Debes especificar una cantidad mayor a 0",
        variant: "destructive",
      });
      return;
    }

    console.log('🔵 Iniciando proceso...');
    setIsLoading(true);

    try {
      const parametrosReduccion = tieneParametrosValidos
        ? Object.entries(parameterQuantities)
          .filter(([_, cantidad]) => cantidad > 0)
          .map(([nombre, cantidad]) => ({
            nombre,
            cantidad
          }))
        : undefined;

      console.log('🔵 parametrosReduccion:', parametrosReduccion);

      if (destination === 'merma') {
        console.log('🟡 Llamando a onProductMerma...');

        await onProductMerma(
          productToReduce.id,
          vendor.id,
          tieneParametrosValidos ? 0 : quantityToReduce,
          parametrosReduccion
        );

        console.log('✅ onProductMerma completado');

        toast({
          title: "Éxito",
          description: "Producto enviado a merma correctamente.",
        });

        setReduceDialogOpen(false);
        setProductToReduce(null);
        setQuantityToReduce(0);
        setParameterQuantities({});

        console.log('✅ Estados reseteados');

      } else if (destination === 'almacen') {
        console.log('🟡 Llamando a onProductReduce...');

        await onProductReduce(
          productToReduce.id,
          vendor.id,
          tieneParametrosValidos ? 0 : quantityToReduce,
          parametrosReduccion
        );

        console.log('✅ onProductReduce completado');

        toast({
          title: "Éxito",
          description: "Producto devuelto al almacén correctamente.",
        });

        setReduceDialogOpen(false);
        setProductToReduce(null);
        setQuantityToReduce(0);
        setParameterQuantities({});

        console.log('✅ Estados reseteados');
      }

    } catch (error) {
      console.error('❌ Error en handleReduceProduct:', error);
      toast({
        title: "Error",
        description: `No se pudo ${destination === 'merma' ? 'enviar a merma' : 'devolver al almacén'} el producto. ${error instanceof Error ? error.message : ''}`,
        variant: "destructive",
      });
    } finally {
      console.log('🔵 Finally - setIsLoading(false)');
      setIsLoading(false);
    }
  };





  const filterItems = useCallback((items: any[], term: string) => {
    return items.filter(item =>
      Object.values(item).some(value =>
        value && value.toString().toLowerCase().includes(term.toLowerCase())
      )
    )
  }, [])

  const toggleExpandProd = useCallback((productId: string) => {
    setExpandedProducts(prev => ({
      ...prev,
      [productId]: !prev[productId]
    }))
  }, [])

  const renderProductList = useCallback((products: Producto[]) => {

    const filteredAndSortedProducts = sortAndFilterProducts(products)

    const calcularCantidadTotal = (producto: Producto) => {
      if (producto.parametros && producto.parametros.length > 0) {
        // Filtrar parámetros válidos (no numéricos y cantidad > 0)
        const parametrosValidos = producto.parametros.filter(param =>
          param.cantidad > 0 &&
          isNaN(Number(param.nombre)) && // Excluir nombres que son solo números
          param.nombre.trim() !== '' // Excluir nombres vacíos
        );

        return parametrosValidos.reduce((total, param) => total + param.cantidad, 0);
      }
      return producto.cantidad;
    }

    return (
      <div className="space-y-2">
        {filteredAndSortedProducts.map(producto => {
          // Filtrar parámetros válidos
          const parametrosValidos = producto.parametros?.filter(param =>
            param.cantidad > 0 &&
            isNaN(Number(param.nombre)) && // Excluir nombres que son solo números
            param.nombre.trim() !== '' // Excluir nombres vacíos
          ) || [];

          const hasParameters = parametrosValidos.length > 0;
          const isExpanded = expandedProducts[producto.id] || false;
          const cantidadTotal = calcularCantidadTotal(producto);

          // Si el producto tiene parámetros pero ninguno es válido, lo mostramos como agotado
          if (producto.parametros && producto.parametros.length > 0 && !hasParameters) {
            return (
              <div
                key={producto.id}
                className="bg-white rounded-lg shadow overflow-hidden"
              >
                <div className="flex items-center p-4">
                  <div className="w-[50px] h-[50px] relative mr-4">
                    <Image
                      src={producto.foto || '/placeholder.svg'}
                      alt={producto.nombre}
                      fill
                      className="object-cover rounded"
                    />
                  </div>
                  <div className="flex-grow">
                    <div className="flex items-center">
                      <h3 className="font-bold">{producto.nombre}</h3>
                    </div>
                    <p className="text-sm text-gray-600">
                      ${formatPrice(producto.precio)} - Agotado
                    </p>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={producto.id}
              className={`bg-white rounded-lg shadow overflow-hidden ${hasParameters ? 'cursor-pointer hover:bg-gray-50' : ''}`}
              onClick={() => hasParameters && toggleExpandProd(producto.id)}
            >
              <div className="flex items-center p-4">
                <Image
                  src={producto.foto || '/placeholder.svg'}
                  alt={producto.nombre}
                  width={50}
                  height={50}
                  className="object-cover rounded mr-4"
                />
                <div className="flex-grow">
                  <div className="flex items-center">
                    <h3 className="font-bold">{producto.nombre}</h3>
                    {hasParameters && (
                      <ChevronDown
                        className={`ml-2 h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    ${formatPrice(producto.precio)} - Cantidad total: {cantidadTotal}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setProductToReduce(producto)
                    setReduceDialogOpen(true)
                  }}
                  disabled={isLoading || cantidadTotal === 0}
                >
                  <Minus className="h-4 w-4" />
                </Button>
              </div>
              {isExpanded && hasParameters && (
                <div className="px-4 pb-4 bg-gray-50 border-t">
                  <div className="space-y-2 mt-2">
                    {parametrosValidos.map((parametro, index) => (
                      <div key={index} className="flex justify-between items-center space-x-4 p-2 border rounded-lg">
                        <p className="font-medium">{parametro.nombre}</p>
                        <p className="text-sm text-gray-500">Disponible: {parametro.cantidad}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }, [expandedProducts, isLoading, toggleExpandProd, setProductToReduce, setReduceDialogOpen, formatPrice])

  const renderVentasList = () => {
    const filtrarVentas = (ventas: VentaDia[]) => {
      if (!searchTerm) return ventas;

      return ventas.map(ventaDia => ({
        ...ventaDia,
        ventas: ventaDia.ventas.filter(venta =>
          venta.producto_nombre.toLowerCase().includes(searchTerm.toLowerCase())
        ),
        total: ventaDia.ventas
          .filter(venta => venta.producto_nombre.toLowerCase().includes(searchTerm.toLowerCase()))
          .reduce((sum, venta) => sum + parseFloat(venta.total.toString()), 0)
      })).filter(ventaDia => ventaDia.ventas.length > 0);
    };

    const filtrarVentasSemanales = (ventas: VentaSemana[]) => {
      if (!searchTerm) return ventas;

      return ventas.map(ventaSemana => ({
        ...ventaSemana,
        ventas: ventaSemana.ventas.filter(venta =>
          venta.producto_nombre.toLowerCase().includes(searchTerm.toLowerCase())
        ),
        total: ventaSemana.ventas
          .filter(venta => venta.producto_nombre.toLowerCase().includes(searchTerm.toLowerCase()))
          .reduce((sum, venta) => sum + parseFloat(venta.total.toString()), 0),
        ganancia: ventaSemana.ventas
          .filter(venta => venta.producto_nombre.toLowerCase().includes(searchTerm.toLowerCase()))
          .reduce((sum, venta) => sum + parseFloat(venta.total.toString()), 0) * 0.08
      })).filter(ventaSemana => ventaSemana.ventas.length > 0);
    };

    return (
      <Tabs defaultValue="por-dia">
        <TabsList className="w-full overflow-x-auto justify-start sm:justify-center">
          <TabsTrigger value="por-dia">Por día</TabsTrigger>
          <TabsTrigger value="por-semana">Por semana</TabsTrigger>
          <TabsTrigger value="especificas">
            <span className="sm:hidden">Específicas</span>
            <span className="hidden sm:inline">Ventas Específicas</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="por-dia">
          <div className="space-y-4">
            <div className="relative mb-4">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Buscar ventas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {ventasDiariasLocales.length > 0 ? (
              filtrarVentas(ventasDiariasLocales).map((venta) => (
                <VentaDiaDesplegable
                  key={venta.fecha}
                  venta={venta}
                  onDeleteSale={handleDeleteSale}
                  onEditSale={handleOpenEditSale} // ← AGREGAR // Pasar la función aquí
                />
              ))
            ) : (
              <div className="text-center py-4">No hay ventas registradas</div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="por-semana">
          <div className="space-y-4">
            <div className="relative mb-4">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Buscar ventas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {ventasSemanalesState.length > 0 ? (
              filtrarVentasSemanales(ventasSemanalesState).map((venta) => (
                <VentaSemanaDesplegable
                  key={`${venta.fechaInicio}-${venta.fechaFin}`}
                  venta={venta}
                  onDeleteSale={handleDeleteSale}
                  onEditSale={handleOpenEditSale} // ← AGREGAR// Pasar la función aquí
                />
              ))
            ) : (
              <div className="text-center py-4">No hay ventas registradas</div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="especificas">
          {renderVentasEspecificas()}
        </TabsContent>
      </Tabs>
    )
  }


  const renderTransaccionesList = () => {
    const vendorNombre = vendor.nombre;

    console.log('=== FILTRADO DE TRANSACCIONES ===');
    console.log('Vendedor actual:', vendorNombre);
    console.log('Total transacciones:', transacciones.length);

    const filteredTransacciones = filterItems(transacciones, searchTerm).filter(transaccion => {
      const transaccionDesde = transaccion.desde?.toString();
      const transaccionHacia = transaccion.hacia?.toString();

      console.log('---');
      console.log('Producto:', transaccion.producto);
      console.log('Tipo:', transaccion.tipo);
      console.log('Desde:', transaccionDesde);
      console.log('Hacia:', transaccionHacia);
      console.log('¿Desde === vendorNombre?', transaccionDesde === vendorNombre);
      console.log('¿Hacia === vendorNombre?', transaccionHacia === vendorNombre);

      if (transaccionDesde === vendorNombre && transaccion.tipo === 'Baja') {
        console.log('✅ INCLUIDA: Baja desde este vendedor');
        return true;
      }
      if (transaccionHacia === vendorNombre && transaccion.tipo === 'Entrega') {
        console.log('✅ INCLUIDA: Entrega hacia este vendedor');
        return true;
      }
      console.log('❌ EXCLUIDA');
      return false;
    });

    console.log('Transacciones filtradas:', filteredTransacciones.length);
    console.log('=================================');

    const calcularCantidadTotal = (transaccion: Transaccion): number => {
      if (transaccion.parametros && Array.isArray(transaccion.parametros) && transaccion.parametros.length > 0) {
        return transaccion.parametros.reduce((total, param) => total + (param.cantidad || 0), 0);
      }
      return transaccion.cantidad || 0;
    };

    return (
      <div className="space-y-2">
        {filteredTransacciones.length === 0 ? (
          <div className="text-center text-gray-500 py-4">
            No hay transacciones para mostrar
          </div>
        ) : (
          filteredTransacciones.map((transaccion: Transaccion) => {
            const transactionType = transaccion.tipo || 'Normal';
            const borderColor =
              transactionType === 'Baja' ? 'border-red-500' :
                transactionType === 'Entrega' ? 'border-green-500' :
                  'border-blue-500';

            const precioFormateado = parseFloat(transaccion.precio?.toString() || '0').toFixed(2);
            const cantidadTotal = calcularCantidadTotal(transaccion);
            const hasParameters = Boolean(
              transaccion.parametros &&
              Array.isArray(transaccion.parametros) &&
              transaccion.parametros.length > 0
            );
            const isExpanded = expandedTransactions[transaccion.id];

            return (
              <div
                key={transaccion.id}
                className={`bg-white rounded-lg shadow border-l-4 ${borderColor} overflow-hidden`}
              >
                <div
                  className={`p-4 ${hasParameters ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                  onClick={() => hasParameters && toggleExpand(transaccion.id)}
                >
                  <div className="flex items-center">
                    <ArrowLeftRight className="w-6 h-6 text-blue-500 mr-2 flex-shrink-0" />
                    <div className="flex-grow overflow-hidden">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                          <p className="font-bold text-sm truncate">{transaccion.producto}</p>
                          {hasParameters && (
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            />
                          )}
                        </div>
                        <p className="text-sm font-semibold text-green-600">
                          ${precioFormateado}
                        </p>
                      </div>
                      <div className="flex justify-between items-center text-xs text-gray-600">
                        <span>{format(parseISO(transaccion.fecha), 'dd/MM/yyyy')}</span>
                        <span>Cantidad: {cantidadTotal}</span>
                      </div>
                      <p className="text-xs font-semibold">{transactionType}</p>
                    </div>
                  </div>
                </div>

                {/* Panel expandible para parámetros */}
                {hasParameters && isExpanded && transaccion.parametros && (
                  <div className="bg-gray-50 px-4 py-2 border-t">
                    <div className="space-y-2">
                      {transaccion.parametros
                        .filter((param: TransaccionParametro) => param.cantidad > 0) // Añadimos este filtro
                        .map((param: TransaccionParametro, index: number) => (
                          <div
                            key={`${transaccion.id}-param-${index}`}
                            className="flex justify-between items-center p-2 bg-white rounded-md"
                          >
                            <span className="text-sm font-medium">{param.nombre}</span>
                            <span className="text-sm">{param.cantidad}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

              </div>
            );
          })
        )}
      </div>
    );
  };






  const agruparVentasPorSemana = useCallback((ventas: Venta[]) => {
    const weekMap = new Map<string, VentaSemana>()

    const getWeekKey = (date: Date) => {
      const mondayOfWeek = startOfWeek(date, { weekStartsOn: 1 })
      const sundayOfWeek = endOfWeek(date, { weekStartsOn: 1 })
      return `${format(mondayOfWeek, 'yyyy-MM-dd')}_${format(sundayOfWeek, 'yyyy-MM-dd')}`
    }

    ventas.forEach((venta) => {
      const ventaDate = parseISO(venta.fecha)
      if (!isValid(ventaDate)) {
        console.error(`Invalid date in venta: ${venta.fecha}`)
        return
      }
      const weekKey = getWeekKey(ventaDate)

      if (!weekMap.has(weekKey)) {
        const mondayOfWeek = startOfWeek(ventaDate, { weekStartsOn: 1 })
        const sundayOfWeek = endOfWeek(ventaDate, { weekStartsOn: 1 })
        weekMap.set(weekKey, {
          fechaInicio: format(mondayOfWeek, 'yyyy-MM-dd'),
          fechaFin: format(sundayOfWeek, 'yyyy-MM-dd'),
          ventas: [],
          total: 0,
          ganancia: 0
        })
      }

      const currentWeek = weekMap.get(weekKey)!
      currentWeek.ventas.push(venta)
      currentWeek.total += typeof venta.total === 'number' ? venta.total : parseFloat(venta.total) || 0
      currentWeek.ganancia = parseFloat((currentWeek.total * 0.08).toFixed(2))
    })

    const ventasSemanales = Array.from(weekMap.values())

    return ventasSemanales.sort((a, b) => {
      const dateA = parseISO(a.fechaInicio)
      const dateB = parseISO(b.fechaInicio)
      return isValid(dateB) && isValid(dateA) ? dateB.getTime() - dateA.getTime() : 0
    })
  }, [])

  useEffect(() => {
    setVentasSemanales(agruparVentasPorSemana(ventasLocales))
  }, [ventasLocales, agruparVentasPorSemana])

  const calcularInconsistencias = useCallback((): InconsistenciaData[] => {
    const calcularCantidadPorTransacciones = (productoId: string, parametroNombre?: string) => {
      let entregas = 0;
      let bajas = 0;
      let ventasTotal = 0;
      const vendorId = vendor.id.toString();

      // Obtener el producto
      const producto = productos.find(p => p.id === productoId);
      if (!producto) return { entregas: 0, bajas: 0, ventasTotal: 0, cantidad: 0 };

      // Filtrar transacciones
      const transaccionesVendedor = transacciones.filter(transaccion => {
        const transaccionDesde = transaccion.desde?.toString();
        const transaccionHacia = transaccion.hacia?.toString();
        const productoTransaccion = productos.find(p => p.nombre === transaccion.producto);

        if (!productoTransaccion) return false;

        if (transaccionDesde === vendorId && transaccion.tipo === 'Baja' && productoTransaccion.id === productoId) {
          return true;
        }
        if (transaccionHacia === vendorId && transaccion.tipo === 'Entrega' && productoTransaccion.id === productoId) {
          return true;
        }
        return false;
      });

      // Procesar las transacciones filtradas
      transaccionesVendedor.forEach(transaccion => {
        const productoTransaccion = productos.find(p => p.nombre === transaccion.producto);
        if (productoTransaccion && productoTransaccion.id === productoId) {
          if (parametroNombre && transaccion.parametros) {
            const parametro = transaccion.parametros.find(p => p.nombre === parametroNombre);
            if (parametro) {
              if (transaccion.tipo === 'Entrega') {
                entregas += parametro.cantidad;
              } else if (transaccion.tipo === 'Baja') {
                bajas += parametro.cantidad;
              }
            }
          } else if (!parametroNombre) {
            if (transaccion.tipo === 'Entrega') {
              entregas += transaccion.cantidad;
            } else if (transaccion.tipo === 'Baja') {
              bajas += transaccion.cantidad;
            }
          }
        }
      });

      // Calcular ventas
      ventas.forEach(venta => {
        const productoVenta = productos.find(p => p.nombre === venta.producto_nombre);
        if (productoVenta && productoVenta.id === productoId) {
          if (parametroNombre && venta.parametros) {
            const parametro = venta.parametros.find(p => p.nombre === parametroNombre);
            if (parametro) {
              ventasTotal += parametro.cantidad;
            }
          } else if (!parametroNombre) {
            ventasTotal += venta.cantidad;
          }
        }
      });

      return { entregas, bajas, ventasTotal, cantidad: entregas - bajas - ventasTotal };
    };

    return productos
      .map(producto => {
        let inconsistenciaData: InconsistenciaData;

        if (producto.parametros && producto.parametros.length > 0) {
          // Calcular inconsistencias para productos con parámetros
          const parametrosInconsistentes = producto.parametros
            .filter(parametro => parametro.cantidad > 0 || parametro.nombre.trim() !== '')
            .map(parametro => {
              const resultado = calcularCantidadPorTransacciones(producto.id, parametro.nombre);
              return {
                nombre: parametro.nombre,
                cantidadActual: parametro.cantidad,
                cantidadCalculada: resultado.cantidad,
                diferencia: parametro.cantidad - resultado.cantidad,
                entregas: resultado.entregas,
                bajas: resultado.bajas,
                ventas: resultado.ventasTotal
              };
            });

          const totales = parametrosInconsistentes.reduce((acc, param) => ({
            entregas: acc.entregas + param.entregas,
            bajas: acc.bajas + param.bajas,
            ventas: acc.ventas + param.ventas,
            cantidadActual: acc.cantidadActual + param.cantidadActual,
            cantidadCalculada: acc.cantidadCalculada + param.cantidadCalculada
          }), { entregas: 0, bajas: 0, ventas: 0, cantidadActual: 0, cantidadCalculada: 0 });

          inconsistenciaData = {
            id: producto.id,
            nombre: producto.nombre,
            cantidadActual: totales.cantidadActual,
            cantidadCalculada: totales.cantidadCalculada,
            diferencia: totales.cantidadActual - totales.cantidadCalculada,
            entregas: totales.entregas,
            bajas: totales.bajas,
            ventas: totales.ventas,
            parametros: parametrosInconsistentes,
            tieneParametros: true
          };
        } else {
          // Calcular inconsistencias para productos sin parámetros
          const resultado = calcularCantidadPorTransacciones(producto.id);
          inconsistenciaData = {
            id: producto.id,
            nombre: producto.nombre,
            cantidadActual: producto.cantidad,
            cantidadCalculada: resultado.cantidad,
            diferencia: producto.cantidad - resultado.cantidad,
            entregas: resultado.entregas,
            bajas: resultado.bajas,
            ventas: resultado.ventasTotal,
            tieneParametros: false
          };
        }

        return inconsistenciaData;
      })
      .filter(item =>
        item.diferencia !== 0 ||
        (item.parametros && item.parametros.some(p => p.diferencia !== 0))
      );
  }, [productos, transacciones, ventas, vendor.id]);

  const renderInconsistenciasTable = () => {
    const inconsistencias = calcularInconsistencias();
    const inconsistenciasFiltradas = inconsistencias.filter(item =>
      item.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="w-full">
        <div className="relative mb-4">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Input
            type="search"
            placeholder="Buscar productos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="w-full overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="inline-block min-w-full border rounded-md">
            <div className="max-h-[350px] overflow-y-auto">
              <table className="min-w-full border-collapse table-fixed">
                <thead className="sticky top-0 bg-white">
                  <tr>
                    <th className="text-left p-2 border-b w-[120px] min-w-[120px] text-sm">Producto</th>
                    <th className="text-right p-2 border-b w-[60px] min-w-[60px] text-sm">Actual</th>
                    <th className="text-right p-2 border-b w-[70px] min-w-[70px] text-sm">Calculada</th>
                    <th className="text-right p-2 border-b w-[70px] min-w-[70px] text-sm">Diferencia</th>
                    <th className="text-right p-2 border-b w-[60px] min-w-[60px] text-sm">Entregas</th>
                    <th className="text-right p-2 border-b w-[60px] min-w-[60px] text-sm">Bajas</th>
                    <th className="text-right p-2 border-b w-[60px] min-w-[60px] text-sm">Ventas</th>
                    <th className="text-center p-2 border-b w-[50px] min-w-[50px] text-sm">Editar</th>
                  </tr>
                </thead>
                <tbody>
                  {inconsistenciasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-4 text-gray-500 text-sm">
                        {searchTerm
                          ? 'No se encontraron productos que coincidan con la búsqueda.'
                          : 'No se encontraron inconsistencias en el inventario.'}
                      </td>
                    </tr>
                  ) : (
                    inconsistenciasFiltradas.map((item) => (
                      <React.Fragment key={item.id}>
                        <tr
                          className={`border-b hover:bg-gray-50 ${item.tieneParametros ? 'cursor-pointer' : ''}`}
                          onClick={() => {
                            if (item.tieneParametros) {
                              setExpandedInconsistencias(prev => ({
                                ...prev,
                                [item.id]: !prev[item.id]
                              }));
                            }
                          }}
                        >
                          <td className="p-2 text-sm break-words">
                            <div className="flex items-center">
                              {item.nombre}
                              {item.tieneParametros && (
                                <ChevronDown
                                  className={`ml-2 h-4 w-4 transition-transform ${expandedInconsistencias[item.id] ? 'rotate-180' : ''
                                    }`}
                                />
                              )}
                            </div>
                          </td>
                          <td className="p-2 text-right text-sm whitespace-nowrap">{item.cantidadActual}</td>
                          <td className="p-2 text-right text-sm whitespace-nowrap">{item.cantidadCalculada}</td>
                          <td className={`p-2 text-right text-sm whitespace-nowrap ${item.diferencia > 0 ? 'text-green-600' :
                            item.diferencia < 0 ? 'text-red-600' : ''
                            }`}>
                            {item.diferencia}
                          </td>
                          <td className="p-2 text-right text-sm whitespace-nowrap text-green-600">{item.entregas}</td>
                          <td className="p-2 text-right text-sm whitespace-nowrap text-red-600">{item.bajas}</td>
                          <td className="p-2 text-right text-sm whitespace-nowrap text-blue-600">{item.ventas}</td>
                          <td className="p-2 text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setProductToEdit(item);
                                setShowEditQuantityDialog(true);
                                if (item.tieneParametros && item.parametros) {
                                  const initialQuantities: Record<string, number> = {};
                                  item.parametros.forEach(param => {
                                    initialQuantities[param.nombre] = param.cantidadActual;
                                  });
                                  setNewQuantities(initialQuantities);
                                } else {
                                  setNewQuantities({ total: item.cantidadActual });
                                }
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>

                        {item.tieneParametros && expandedInconsistencias[item.id] && item.parametros && (
                          <tr className="bg-gray-50">
                            <td colSpan={8} className="p-0">
                              <div className="p-2 pl-6">
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs border-separate border-spacing-0">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="p-1 text-left min-w-[100px]">Parámetro</th>
                                        <th className="p-1 text-right min-w-[50px]">Actual</th>
                                        <th className="p-1 text-right min-w-[60px]">Calculada</th>
                                        <th className="p-1 text-right min-w-[60px]">Diferencia</th>
                                        <th className="p-1 text-right min-w-[50px]">Entregas</th>
                                        <th className="p-1 text-right min-w-[50px]">Bajas</th>
                                        <th className="p-1 text-right min-w-[50px]">Ventas</th>
                                        <th className="p-1 text-right min-w-[50px]"></th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {item.parametros.map((param, idx) => (
                                        <tr key={idx} className="hover:bg-gray-100">
                                          <td className="p-1">{param.nombre}</td>
                                          <td className="p-1 text-right whitespace-nowrap">{param.cantidadActual}</td>
                                          <td className="p-1 text-right whitespace-nowrap">{param.cantidadCalculada}</td>
                                          <td className={`p-1 text-right whitespace-nowrap ${param.diferencia > 0 ? 'text-green-600' :
                                            param.diferencia < 0 ? 'text-red-600' : ''
                                            }`}>
                                            {param.diferencia}
                                          </td>
                                          <td className="p-1 text-right whitespace-nowrap text-green-600">{param.entregas}</td>
                                          <td className="p-1 text-right whitespace-nowrap text-red-600">{param.bajas}</td>
                                          <td className="p-1 text-right whitespace-nowrap text-blue-600">{param.ventas}</td>
                                          <td className="p-1"></td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="p-4">
          <DialogTitle>{vendor.nombre}</DialogTitle>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto p-4">
          {mode === 'edit' ? (
            <div className="space-y-4">
              <Input
                name="nombre"
                value={editedVendor.nombre}
                onChange={handleInputChange}
                placeholder="Nombre del vendedor"
              />
              <Input
                name="telefono"
                value={editedVendor.telefono}
                onChange={handleInputChange}
                placeholder="Teléfono"
              />
              <Button onClick={handleEdit} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar cambios'
                )}
              </Button>

              {/* Nuevo botón para eliminar datos */}
              <div className="pt-4 border-t mt-4">
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => setDeleteConfirmDialogOpen(true)}
                >
                  Eliminar datos del vendedor
                </Button>
              </div>
            </div>
          ) : mode === 'ventas' ? (
            <div className="max-h-[600px] overflow-y-auto">
              <div>
                <h2 className="text-lg font-bold mb-4">Ventas</h2>
                {renderVentasList()}
              </div>
            </div>
          ) : mode === 'productos' ? (
            <div className="max-h-[600px] overflow-y-auto">
              <Tabs defaultValue="disponibles" className="w-full">
                <div className="flex justify-center mb-4">
                  <Button onClick={exportToExcel} className="bg-green-500 hover:bg-green-600 text-white">
                    <FileDown className="mr-2 h-4 w-4" />
                    Exportar
                  </Button>
                </div>
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="disponibles">Disponibles</TabsTrigger>
                  <TabsTrigger value="agotados">Agotados</TabsTrigger>
                </TabsList>
                <div className="space-y-4 mb-4">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <Input
                      type="search"
                      placeholder="Buscar productos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex justify-start space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSort('nombre')}
                      className="flex items-center"
                    >
                      Nombre
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSort('cantidad')}
                      className="flex items-center"
                    >
                      Cantidad
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <TabsContent value="disponibles">
                  {renderProductList(productos.filter(p => {
                    const cantidadTotal = p.parametros && p.parametros.length > 0
                      ? p.parametros.reduce((total, param) => total + (param.cantidad || 0), 0)
                      : p.cantidad
                    return cantidadTotal > 0
                  }))}
                </TabsContent>
                <TabsContent value="agotados">
                  {renderProductList(productos.filter(p => {
                    const cantidadTotal = p.parametros && p.parametros.length > 0
                      ? p.parametros.reduce((total, param) => total + (param.cantidad || 0), 0)
                      : p.cantidad
                    return cantidadTotal === 0
                  }))}
                </TabsContent>
              </Tabs>
            </div>
          ) : mode === 'transacciones' ? (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">Historial de Transacciones</h2>
              <div className="relative mb-4">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Buscar transacciones..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-600" />
                    <p className="text-gray-500">Cargando transacciones...</p>
                  </div>
                </div>
              ) : (
                renderTransaccionesList()
              )}
            </div>
          ) : (
            <div className="flex flex-col space-y-2">
              <Button onClick={() => setMode('edit')}>Editar</Button>
              <Button onClick={() => setMode('ventas')}>Ventas</Button>
            </div>
          )}
        </div>

      </DialogContent>

      {/* Diálogo para confirmar eliminación de datos */}
      <AlertDialog open={deleteConfirmDialogOpen} onOpenChange={setDeleteConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará todas las ventas y transacciones asociadas a este vendedor.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteVendorData}
              className="bg-red-500 hover:bg-red-600"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={reduceDialogOpen} onOpenChange={setReduceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reducir producto</DialogTitle>
            <DialogDescription>
              {productToReduce?.nombre}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {(() => {
              // Verificar dinámicamente si tiene parámetros válidos
              const parametrosValidos = productToReduce?.parametros?.filter(param =>
                param.cantidad > 0 &&
                param.nombre.trim() !== '' &&
                isNaN(Number(param.nombre))
              ) || [];

              const tieneParametrosValidos = parametrosValidos.length > 0;

              console.log('🔍 Verificación de parámetros:', {
                producto: productToReduce?.nombre,
                tiene_parametros: productToReduce?.tiene_parametros,
                parametros: productToReduce?.parametros,
                parametrosValidos,
                tieneParametrosValidos
              });

              return (
                <>
                  {/* Productos SIN parámetros válidos */}
                  {productToReduce && !tieneParametrosValidos && (
                    <div>
                      <label className="text-sm font-medium">Cantidad a reducir</label>
                      <Input
                        type="number"
                        min="0"
                        max={productToReduce.cantidad || 0}
                        value={quantityToReduce}
                        onChange={(e) => setQuantityToReduce(parseInt(e.target.value) || 0)}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Disponible: {productToReduce.cantidad}
                      </p>
                    </div>
                  )}

                  {/* Productos CON parámetros válidos */}
                  {productToReduce && tieneParametrosValidos && (
                    <div className="space-y-3">
                      <label className="text-sm font-medium block">Cantidades por parámetro</label>
                      <div className="max-h-[300px] overflow-y-auto space-y-2">
                        {parametrosValidos.map((parametro) => (
                          <div
                            key={parametro.nombre}
                            className="flex items-center justify-between gap-2 p-2 border rounded-lg bg-gray-50"
                          >
                            <span className="text-sm font-medium flex-shrink-0">
                              {parametro.nombre}
                            </span>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="0"
                                max={parametro.cantidad}
                                value={parameterQuantities[parametro.nombre] || 0}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 0;
                                  const maxValue = parametro.cantidad;
                                  setParameterQuantities(prev => ({
                                    ...prev,
                                    [parametro.nombre]: Math.min(value, maxValue)
                                  }));
                                }}
                                className="w-20 text-center"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="text-sm text-gray-500 flex-shrink-0">
                                / {parametro.cantidad}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Mostrar total a reducir */}
                      <div className="pt-2 border-t">
                        <p className="text-sm font-medium">
                          Total a reducir: {Object.values(parameterQuantities).reduce((sum, val) => sum + val, 0)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Botones de destino */}
                  <div className="space-y-2 pt-2">
                    <p className="text-sm font-medium">Selecciona el destino:</p>
                    <Button
                      className="w-full"
                      onClick={() => handleReduceProduct('almacen')}
                      disabled={isLoading || (
                        tieneParametrosValidos
                          ? Object.values(parameterQuantities).reduce((sum, val) => sum + val, 0) === 0
                          : quantityToReduce === 0
                      )}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        <>
                          <ArrowLeftRight className="mr-2 h-4 w-4" />
                          Devolver al Almacén
                        </>
                      )}
                    </Button>

                    <Button
                      className="w-full"
                      variant="destructive"
                      onClick={() => {
                        console.log('🔴 Botón "Enviar a Merma" clickeado');
                        handleReduceProduct('merma');
                      }}
                      disabled={isLoading || (
                        tieneParametrosValidos
                          ? Object.values(parameterQuantities).reduce((sum, val) => sum + val, 0) === 0
                          : quantityToReduce === 0
                      )}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        <>
                          <X className="mr-2 h-4 w-4" />
                          Enviar a Merma
                        </>
                      )}
                    </Button>

                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => {
                        setReduceDialogOpen(false);
                        setShowVendorSelectDialog(true);
                      }}
                      disabled={isLoading || (
                        tieneParametrosValidos
                          ? Object.values(parameterQuantities).reduce((sum, val) => sum + val, 0) === 0
                          : quantityToReduce === 0
                      )}
                    >
                      <ArrowLeftRight className="mr-2 h-4 w-4" />
                      Transferir a otro Vendedor
                    </Button>
                  </div>
                </>
              );
            })()}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReduceDialogOpen(false);
                setProductToReduce(null);
                setQuantityToReduce(0);
                setParameterQuantities({});
              }}
              disabled={isLoading}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {/* Diálogo de selección de vendedor */}
      <Dialog open={showVendorSelectDialog} onOpenChange={setShowVendorSelectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seleccionar vendedor destino</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {vendedores
              .filter(v => v.id !== vendor.id)
              .map(v => (
                <Button
                  key={v.id}
                  className="w-full"
                  variant="outline"
                  disabled={isLoading}
                  onClick={async (e) => {
                    console.log('🔵 Vendedor seleccionado:', v.nombre);
                    console.log('🔵 Producto a transferir:', productToReduce);
                    console.log('🔵 Cantidad:', quantityToReduce);
                    console.log('🔵 Parámetros:', parameterQuantities);

                    e.preventDefault();
                    e.stopPropagation();

                    if (!productToReduce || isLoading) {
                      console.log('❌ Validación falló');
                      return;
                    }

                    setIsLoading(true);
                    console.log('🟡 Iniciando transferencia...');

                    try {
                      const parametrosTransferencia = productToReduce.tiene_parametros
                        ? Object.entries(parameterQuantities)
                          .filter(([_, cantidad]) => cantidad > 0)
                          .map(([nombre, cantidad]) => ({ nombre, cantidad }))
                        : undefined;

                      console.log('🟡 Parámetros de transferencia:', parametrosTransferencia);

                      await onProductTransfer(
                        productToReduce.id,
                        vendor.id,
                        v.id,
                        productToReduce.tiene_parametros ? 0 : quantityToReduce,
                        parametrosTransferencia
                      );

                      console.log('✅ Transferencia exitosa');

                      toast({
                        title: "Éxito",
                        description: `Producto transferido a ${v.nombre}`,
                      });

                      setShowVendorSelectDialog(false);
                      setReduceDialogOpen(false);
                      setProductToReduce(null);
                      setQuantityToReduce(0);
                      setParameterQuantities({});

                    } catch (error) {
                      console.error('❌ Error completo:', error);
                      toast({
                        title: "Error",
                        description: `No se pudo transferir: ${error instanceof Error ? error.message : 'Error desconocido'}`,
                        variant: "destructive",
                      });
                    } finally {
                      console.log('🔵 Finally ejecutado');
                      setIsLoading(false);
                    }
                  }}


                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Transfiriendo...
                    </>
                  ) : (
                    v.nombre
                  )}
                </Button>
              ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowVendorSelectDialog(false);
                setReduceDialogOpen(true);
              }}
              disabled={isLoading}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de edición de venta */}
      <Dialog open={showEditSaleDialog} onOpenChange={setShowEditSaleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar venta</DialogTitle>
            <DialogDescription>
              {saleToEdit?.producto_nombre}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {saleToEdit && saleToEdit.parametros && saleToEdit.parametros.length > 0 ? (
              <div className="space-y-3">
                <label className="text-sm font-medium block">Cantidades por parámetro</label>
                <div className="max-h-[300px] overflow-y-auto space-y-2">
                  {saleToEdit.parametros.map((parametro) => (
                    <div
                      key={parametro.nombre}
                      className="flex items-center justify-between gap-2 p-2 border rounded-lg bg-gray-50"
                    >
                      <span className="text-sm font-medium">{parametro.nombre}</span>
                      <Input
                        type="number"
                        min="0"
                        value={editSaleParametros[parametro.nombre] || 0}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          setEditSaleParametros(prev => ({
                            ...prev,
                            [parametro.nombre]: value
                          }));
                        }}
                        className="w-20 text-center"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium">Nueva cantidad</label>
                <Input
                  type="number"
                  min="0"
                  value={editSaleQuantity}
                  onChange={(e) => setEditSaleQuantity(parseInt(e.target.value) || 0)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditSaleDialog(false);
                setSaleToEdit(null);
              }}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEditSale}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar cambios'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



    </Dialog>
  );
}