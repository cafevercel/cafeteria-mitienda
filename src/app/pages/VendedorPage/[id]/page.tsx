'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { MenuIcon, Search, X, ChevronDown, ChevronUp, ArrowLeftRight, Minus, Plus, DollarSign, ArrowUpDown } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { format, parseISO, isValid, startOfWeek, endOfWeek, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { OptimizedImage } from '@/components/OptimizedImage';
import {
  realizarVenta,
  getVentasMes,
  getTransaccionesProducto,
  getVentasProducto,
  getProductosCompartidos,
  getTransaccionesVendedor
} from '../../../services/api'
import { WeekPicker } from '@/components/Weekpicker'

interface Producto {
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
  foto: string | null;
  tiene_parametros: boolean;
  parametros?: ProductoParametro[];
  porcentajeGanancia?: number; // Nuevo campo
}

interface ProductoParametro {
  nombre: string;
  cantidad: number;
}


interface ProductoVenta extends Producto {
  cantidadVendida: number;
  parametrosVenta?: ProductoParametro[];
}


export interface TransaccionParametro {
  id: string;
  transaccion_id: string;
  nombre: string;
  cantidad: number;
}

// Actualizar la interface Transaccion para incluir los parámetros
export interface Transaccion {
  id: string;
  tipo: 'Baja' | 'Entrega';
  producto: string;
  cantidad: number;
  desde: string;
  hacia: string;
  fecha: string;
  precio: number;
  parametro_nombre?: string;
  parametros?: TransaccionParametro[]; // Agregar esta línea
}

interface VentaParametro {
  nombre: string;
  cantidad: number;
}

interface Venta {
  id: string;
  producto: string;
  producto_nombre: string;
  producto_foto: string;
  cantidad: number;
  precio_unitario: number;
  total: number | string;
  vendedor: string;
  vendedor_nombre?: string;
  fecha: string;
  parametros?: ProductoParametro[];
  porcentajeGanancia?: string;
  porcentaje_ganancia?: string;
}

interface VentaDia {
  fecha: string;
  ventas: Venta[];
  total: number;
}

interface VentaSemana {
  fechaInicio: string;
  fechaFin: string;
  ventas: Venta[];
  total: number;
  ganancia: number;
}

interface VentaAgrupada {
  fecha: string;
  ventas: Venta[];
  total: number | string;
}

interface VentaDia {
  fecha: string;
  ventas: Venta[];
  total: number;
}

interface ParametrosDialogProps {
  producto: Producto | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (parametros: ProductoParametro[]) => void;
}

const calcularCantidadTotal = (producto: Producto): number => {
  if (producto.tiene_parametros && producto.parametros) {
    return producto.parametros.reduce((total, param) => total + param.cantidad, 0);
  }
  return producto.cantidad;
};

const useVendedorData = (vendedorId: string) => {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [productosDisponibles, setProductosDisponibles] = useState<Producto[]>([])
  const [productosAgotados, setProductosAgotados] = useState<Producto[]>([])
  const [ventasRegistro, setVentasRegistro] = useState<Venta[]>([])
  const [transacciones, setTransacciones] = useState<Transaccion[]>([])
  const [ventasDia, setVentasDia] = useState<Venta[]>([])
  const [ventasAgrupadas, setVentasAgrupadas] = useState<VentaAgrupada[]>([])
  const [ventasSemanales, setVentasSemanales] = useState<VentaSemana[]>([])
  const [ventasDiarias, setVentasDiarias] = useState<VentaDia[]>([]);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [sortBy, setSortBy] = useState<'nombre' | 'cantidad'>('nombre')
  const [productosSeleccionados, setProductosSeleccionados] = useState<ProductoVenta[]>([]);
  const [fecha, setFecha] = useState('');

  const handleEnviarVenta = async () => {
    if (productosSeleccionados.length === 0) {
      alert('Por favor, seleccione al menos un producto.');
      return;
    }
    if (!fecha) {
      alert('Por favor, seleccione una fecha.');
      return;
    }
    if (!vendedorId) {
      alert('No se pudo identificar el vendedor.');
      return;
    }

    try {
      console.log('Iniciando proceso de venta');

      await Promise.all(productosSeleccionados.map(async producto => {
        try {
          // Calcular la cantidad total sumando los parámetros
          const cantidadTotal = producto.parametrosVenta
            ? producto.parametrosVenta.reduce((sum, param) => sum + param.cantidad, 0)
            : producto.cantidadVendida;

          const response = await realizarVenta(
            producto.id,
            cantidadTotal, // Usar la cantidad total calculada
            fecha,
            producto.parametrosVenta,
            vendedorId
          );

          console.log(`Venta realizada para producto ${producto.id}:`, response);
          return response;
        } catch (error) {
          console.error(`Error en venta de producto ${producto.id}:`, error);
          throw error;
        }
      }));

      setProductosSeleccionados([]);
      setFecha('');
      await fetchProductos();
      await fetchVentasRegistro();
      alert('Venta realizada con éxito');
    } catch (error) {
      console.error('Error al realizar la venta:', error);
      setError(error instanceof Error ? error.message : 'Error al realizar la venta');
    }
  };



  const agruparVentasPorDia = useCallback((ventas: Venta[]) => {
    const ventasDiarias: VentaDia[] = [];
    ventas.forEach((venta) => {
      const fecha = parseISO(venta.fecha);
      if (!isValid(fecha)) {
        console.error(`Invalid date in venta: ${venta.fecha}`);
        return;
      }
      const fechaStr = format(fecha, 'yyyy-MM-dd');
      const diaExistente = ventasDiarias.find((d) => d.fecha === fechaStr);
      if (diaExistente) {
        diaExistente.ventas.push(venta);
        diaExistente.total += typeof venta.total === 'number' ? venta.total : parseFloat(venta.total) || 0;
      } else {
        ventasDiarias.push({
          fecha: fechaStr,
          ventas: [venta],
          total: typeof venta.total === 'number' ? venta.total : parseFloat(venta.total) || 0,
        });
      }
    });
    return ventasDiarias.sort((a, b) => {
      const dateA = parseISO(a.fecha);
      const dateB = parseISO(b.fecha);
      return isValid(dateB) && isValid(dateA) ? dateB.getTime() - dateA.getTime() : 0;
    });
  }, []);

  const agruparVentas = useCallback((ventas: Venta[]) => {
    const ventasAgrupadas = ventas.reduce((acc: VentaAgrupada[], venta) => {
      const fecha = new Date(venta.fecha).toLocaleDateString()
      const ventaExistente = acc.find(v => v.fecha === fecha)
      if (ventaExistente) {
        ventaExistente.ventas.push(venta)
        ventaExistente.total = (parseFloat(ventaExistente.total as string) || 0) + (parseFloat(venta.total as string) || 0)
      } else {
        acc.push({ fecha, ventas: [venta], total: venta.total })
      }
      return acc
    }, [])
    return ventasAgrupadas.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
  }, [])

  const agruparVentasPorSemana = useCallback((ventas: Venta[]) => {
    const weekMap = new Map<string, VentaSemana>();

    const getWeekKey = (date: Date) => {
      const mondayOfWeek = startOfWeek(date, { weekStartsOn: 1 });
      const sundayOfWeek = endOfWeek(date, { weekStartsOn: 1 });
      return `${format(mondayOfWeek, 'yyyy-MM-dd')}_${format(sundayOfWeek, 'yyyy-MM-dd')}`;
    };

    ventas.forEach((venta) => {
      const ventaDate = parseISO(venta.fecha);
      if (!isValid(ventaDate)) {
        console.error(`Invalid date in venta: ${venta.fecha}`);
        return;
      }
      const weekKey = getWeekKey(ventaDate);

      if (!weekMap.has(weekKey)) {
        const mondayOfWeek = startOfWeek(ventaDate, { weekStartsOn: 1 });
        const sundayOfWeek = endOfWeek(ventaDate, { weekStartsOn: 1 });
        weekMap.set(weekKey, {
          fechaInicio: format(mondayOfWeek, 'yyyy-MM-dd'),
          fechaFin: format(sundayOfWeek, 'yyyy-MM-dd'),
          ventas: [],
          total: 0,
          ganancia: 0,
        });
      }

      const currentWeek = weekMap.get(weekKey)!;
      currentWeek.ventas.push(venta);
      currentWeek.total += typeof venta.total === 'number' ? venta.total : parseFloat(venta.total) || 0;
      currentWeek.ganancia = parseFloat((currentWeek.total * 0.08).toFixed(2));
    });

    const ventasSemanales = Array.from(weekMap.values());

    return ventasSemanales.sort((a, b) => {
      const dateA = parseISO(a.fechaInicio);
      const dateB = parseISO(b.fechaInicio);
      return isValid(dateB) && isValid(dateA) ? dateB.getTime() - dateA.getTime() : 0;
    });
  }, []);

  const fetchProductos = useCallback(async () => {
    try {
      const data = await getProductosCompartidos();
      console.log('Raw data from getProductosCompartidos:', data);

      // Modificamos el filtrado considerando los parámetros
      setProductosDisponibles(data.filter((producto: Producto) => {
        const cantidadTotal = calcularCantidadTotal(producto);
        return cantidadTotal > 0;
      }));

      setProductosAgotados(data.filter((producto: Producto) => {
        const cantidadTotal = calcularCantidadTotal(producto);
        return cantidadTotal === 0;
      }));

      console.log('Productos disponibles:', productosDisponibles);
      console.log('Productos agotados:', productosAgotados);
    } catch (error) {
      console.error('Error al obtener productos:', error)
      setError('No se pudieron cargar los productos. Por favor, intenta de nuevo.')
    }
  }, [])

  const fetchVentasRegistro = useCallback(async () => {
    try {
      // Obtener todos los productos para tener acceso a los porcentajes de ganancia
      const productos = await getProductosCompartidos();
      const productosMap = new Map<string, Producto>();
      
      // Crear un mapa de productos por ID para búsqueda rápida
      productos.forEach((producto: Producto) => {
        productosMap.set(producto.id, producto);
      });
      
      // Llamar a getVentasMes para obtener todas las ventas
      const ventasMesData: Venta[] = await getVentasMes(vendedorId);
      
      // Enriquecer las ventas con los porcentajes de ganancia de los productos
      const ventasEnriquecidas = ventasMesData.map(venta => {
        const producto = productosMap.get(venta.producto);
        if (producto) {
          // Usar el porcentaje de ganancia del producto
          return {
            ...venta,
            porcentajeGanancia: producto.porcentajeGanancia !== undefined ? String(producto.porcentajeGanancia) : undefined,
            porcentaje_ganancia: producto.porcentajeGanancia !== undefined ? String(producto.porcentajeGanancia) : undefined
          };
        }
        return venta;
      });
      
      console.log('Ventas enriquecidas con porcentajes de ganancia:', ventasEnriquecidas);
      
      setVentasRegistro(ventasEnriquecidas);
      setVentasAgrupadas(agruparVentas(ventasEnriquecidas));
      setVentasSemanales(agruparVentasPorSemana(ventasEnriquecidas));
      setVentasDiarias(agruparVentasPorDia(ventasEnriquecidas));
    } catch (error) {
      console.error('Error al obtener registro de ventas:', error);
      if (error instanceof Error) {
        setError(`No se pudo cargar el registro de ventas: ${error.message}`);
      } else {
        setError('No se pudo cargar el registro de ventas. Por favor, intenta de nuevo.');
      }
    }
  }, [vendedorId, agruparVentas, agruparVentasPorSemana, agruparVentasPorDia]);


  const fetchTransacciones = useCallback(async () => {
    try {
      const data = await getTransaccionesVendedor();
      setTransacciones(data);
    } catch (error) {
      console.error('Error al obtener transacciones:', error);
      setError('No se pudieron cargar las transacciones. Por favor, intenta de nuevo.');
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        await Promise.all([fetchProductos(), fetchVentasRegistro(), fetchTransacciones()]);
      } catch (error) {
        console.error('Error loading data:', error);
        setError(error instanceof Error ? error.message : 'Error loading data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [fetchProductos, fetchVentasRegistro, fetchTransacciones]);

  return {
    isLoading,
    error,
    productosDisponibles,
    productosAgotados,
    ventasRegistro,
    transacciones,
    ventasDia,
    ventasAgrupadas,
    ventasSemanales,
    ventasDiarias,
    fetchProductos,
    fetchVentasRegistro,
    fetchTransacciones,
    sortOrder,
    setSortOrder,
    sortBy,
    setSortBy,
    handleEnviarVenta,
    productosSeleccionados,
    setProductosSeleccionados,
    fecha,
    setFecha
  }
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

const VentaDiaDesplegable = ({ venta, busqueda }: { venta: VentaDia, busqueda: string }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Filtrar las ventas basadas en la búsqueda
  const ventasFiltradas = busqueda
    ? venta.ventas.filter(v =>
      v.producto_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      formatDate(v.fecha).toLowerCase().includes(busqueda.toLowerCase()) ||
      v.total.toString().includes(busqueda)
    )
    : venta.ventas;

  // Calcular el total solo de las ventas filtradas
  const calcularTotalVentasFiltradas = () => {
    return ventasFiltradas.reduce((total, v) => {
      const ventaTotal = typeof v.total === 'string' ? parseFloat(v.total) : v.total;
      return total + (ventaTotal || 0);
    }, 0);
  };

  // Calcular la ganancia total basada en el porcentaje de ganancia de cada producto
  const calcularGananciaTotal = () => {
    return ventasFiltradas.reduce((totalGanancia, v) => {
      // Obtener el porcentaje de ganancia (puede estar en diferentes propiedades)
      const porcentajeGanancia = v.porcentajeGanancia || v.porcentaje_ganancia;
      
      // Verificar si hay porcentaje de ganancia
      if (!porcentajeGanancia) {
        console.log(`Producto: ${v.producto_nombre} porcentajeGanancia: ${v.porcentajeGanancia} porcentaje_ganancia: ${v.porcentaje_ganancia}`);
        return totalGanancia;
      }

      // Convertir a número y verificar si es mayor que cero
      const porcentajeNumerico = parseFloat(String(porcentajeGanancia));
      if (isNaN(porcentajeNumerico) || porcentajeNumerico === 0) {
        return totalGanancia;
      }

      const precioUnitario = typeof v.precio_unitario === 'string' ? parseFloat(v.precio_unitario) : v.precio_unitario;
      const cantidad = typeof v.cantidad === 'string' ? parseFloat(v.cantidad) : v.cantidad;
      const gananciaProducto = precioUnitario * (porcentajeNumerico / 100) * cantidad;

      return totalGanancia + gananciaProducto;
    }, 0);
  };

  return (
    <div className="border rounded-lg mb-2">
      <div
        className="flex justify-between items-center p-4 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{formatDate(venta.fecha)}</span>
        <div className="flex items-center">
          <span className="mr-2">${formatPrice(calcularTotalVentasFiltradas())}</span>
          {calcularGananciaTotal() > 0 && (
            <span className="mr-2 text-green-600">Ganancia: ${formatPrice(calcularGananciaTotal())}</span>
          )}
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>
      {isOpen && (
        <div className="p-4 bg-gray-50">
          {ventasFiltradas.map((v) => (
            <div key={v.id} className="flex flex-col border-b py-4 last:border-b-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Image
                    src={v.producto_foto || '/placeholder.svg'}
                    alt={v.producto_nombre}
                    width={40}
                    height={40}
                    className="rounded-md"
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{v.producto_nombre}</span>
                    {v.parametros && v.parametros.length > 0 ? (
                      <div className="mt-1">
                        {v.parametros.map((param, index) => (
                          <div key={index} className="text-sm text-gray-600">
                            • {param.nombre}: {param.cantidad}
                          </div>
                        ))}
                        <div className="text-sm font-medium text-gray-700 mt-1">
                          Cantidad total: {v.parametros.reduce((sum, param) => sum + param.cantidad, 0)}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600">
                        Cantidad: {v.cantidad}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">
                    Precio unitario: ${formatPrice(v.precio_unitario)}
                  </div>
                  <div className="font-medium text-green-600">
                    Total: ${formatPrice(v.total)}
                  </div>
                  {(v.porcentajeGanancia || v.porcentaje_ganancia) && parseFloat(String(v.porcentajeGanancia || v.porcentaje_ganancia)) > 0 && (
                    <div className="text-sm text-green-600">
                      Ganancia: ${formatPrice(v.precio_unitario * (parseFloat(String(v.porcentajeGanancia || v.porcentaje_ganancia)) / 100) * v.cantidad)} ({parseFloat(String(v.porcentajeGanancia || v.porcentaje_ganancia))}%)
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


const VentaSemanaDesplegable = ({ venta, busqueda }: { venta: VentaSemana, busqueda: string }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Filtrar las ventas basadas en la búsqueda
  const ventasFiltradas = busqueda
    ? venta.ventas.filter(v =>
      v.producto_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      formatDate(v.fecha).toLowerCase().includes(busqueda.toLowerCase()) ||
      v.total.toString().includes(busqueda)
    )
    : venta.ventas;

  // Agrupar las ventas filtradas por día
  const ventasPorDia = ventasFiltradas.reduce((acc: Record<string, Venta[]>, v) => {
    const fecha = parseISO(v.fecha);
    if (!isValid(fecha)) {
      console.error(`Invalid date in venta: ${v.fecha}`);
      return acc;
    }
    const fechaStr = format(fecha, 'yyyy-MM-dd');
    if (!acc[fechaStr]) {
      acc[fechaStr] = [];
    }
    acc[fechaStr].push(v);
    return acc;
  }, {});

  // Calcular el total solo de las ventas filtradas
  const totalFiltrado = ventasFiltradas.reduce((total, v) => {
    const ventaTotal = typeof v.total === 'string' ? parseFloat(v.total) : v.total;
    return total + (ventaTotal || 0);
  }, 0);

  // Calcular la ganancia basada en el porcentaje de ganancia de cada producto
  const gananciaFiltrada = ventasFiltradas.reduce((totalGanancia, v) => {
    // Obtener el porcentaje de ganancia (puede estar en diferentes propiedades)
    const porcentajeGanancia = v.porcentajeGanancia || v.porcentaje_ganancia;
    if (!porcentajeGanancia || parseFloat(porcentajeGanancia) === 0) return totalGanancia;

    const precioUnitario = typeof v.precio_unitario === 'string' ? parseFloat(v.precio_unitario) : v.precio_unitario;
    const cantidad = typeof v.cantidad === 'string' ? parseFloat(v.cantidad) : v.cantidad;
    const gananciaProducto = precioUnitario * (parseFloat(porcentajeGanancia) / 100) * cantidad;

    return totalGanancia + gananciaProducto;
  }, 0);

  return (
    <div className="border rounded-lg mb-2">
      <div
        className="flex justify-between items-center p-4 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>Semana {formatDate(venta.fechaInicio)} - {formatDate(venta.fechaFin)}</span>
        <div className="flex items-center space-x-4">
          <span>${formatPrice(totalFiltrado)}</span>
          <span className="text-green-600">Ganancia: ${formatPrice(gananciaFiltrada)}</span>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>
      {isOpen && (
        <div className="p-4 bg-gray-50">
          {Object.entries(ventasPorDia)
            .sort(([dateA], [dateB]) => {
              const a = parseISO(dateA);
              const b = parseISO(dateB);
              return isValid(a) && isValid(b) ? a.getTime() - b.getTime() : 0;
            })
            .map(([fecha, ventasDia]) => {
              const fechaVenta = parseISO(fecha);
              const fechaInicio = parseISO(venta.fechaInicio);
              const fechaFin = parseISO(venta.fechaFin);
              if (isValid(fechaVenta) && isValid(fechaInicio) && isValid(fechaFin) &&
                fechaVenta >= fechaInicio && fechaVenta <= fechaFin) {
                return (
                  <VentaDiaDesplegable
                    key={fecha}
                    venta={{
                      fecha,
                      ventas: ventasDia,
                      total: ventasDia.reduce((sum, v) => {
                        const ventaTotal = typeof v.total === 'string' ? parseFloat(v.total) : v.total;
                        return sum + (ventaTotal || 0);
                      }, 0)
                    }}
                    busqueda={busqueda}
                  />
                );
              }
              return null;
            })}
        </div>
      )}
    </div>
  );
};

const TransaccionesList = ({
  transacciones,
  searchTerm,
  vendedorId
}: {
  transacciones: Transaccion[],
  searchTerm: string,
  vendedorId: string
}) => {
  const [expandedTransactions, setExpandedTransactions] = useState<Set<string>>(new Set());

  const filteredTransacciones = transacciones.filter(t =>
    t.producto.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTransactionKey = (transaction: Transaccion) => {
    const parametrosString = transaction.parametros
      ?.sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map(p => `${p.nombre.toLowerCase()}:${p.cantidad}`)
      .join('|') || '';

    return `${new Date(transaction.fecha).getTime()}_${transaction.tipo}_${parametrosString}_${transaction.producto}`;
  };

  const toggleExpand = (transactionKey: string) => {
    setExpandedTransactions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(transactionKey)) {
        newSet.delete(transactionKey);
      } else {
        newSet.add(transactionKey);
      }
      return newSet;
    });
  };

  const filteredByRole = filteredTransacciones;

  const groupedTransactions = filteredByRole.reduce((acc, transaction) => {
    const key = getTransactionKey(transaction);
    if (!acc.has(key)) {
      acc.set(key, transaction);
    }
    return acc;
  }, new Map<string, Transaccion>());

  return (
    <div className="space-y-2">
      {Array.from(groupedTransactions.values()).map((transaccion) => {
        const transactionKey = getTransactionKey(transaccion);
        const transactionType = transaccion.tipo || 'Normal';
        const borderColor =
          transactionType === 'Baja' ? 'border-red-500' :
            transactionType === 'Entrega' ? 'border-green-500' :
              'border-blue-500';

        const cantidadTotal = transaccion.parametros
          ? transaccion.parametros.reduce((sum, param) => sum + param.cantidad, 0)
          : transaccion.cantidad;

        const isExpanded = expandedTransactions.has(transactionKey);

        return (
          <div
            key={transactionKey}
            className={`bg-white p-4 rounded-lg shadow border-l-4 ${borderColor}`}
          >
            <div
              className={`flex items-start ${transaccion.parametros ? 'cursor-pointer' : ''}`}
              onClick={() => {
                if (transaccion.parametros) {
                  toggleExpand(transactionKey);
                }
              }}
            >
              <ArrowLeftRight className="w-6 h-6 text-blue-500 mr-4 flex-shrink-0 mt-1" />
              <div className="flex-grow overflow-hidden">
                <div className="flex justify-between items-center mb-1">
                  <p className="font-bold text-sm truncate">{transaccion.producto}</p>
                  <p className="text-sm font-semibold text-green-600">
                    ${formatPrice(transaccion.precio)}
                  </p>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-600">
                  <span>{formatDate(transaccion.fecha)}</span>
                  <span>Cantidad Total: {cantidadTotal}</span>
                </div>
                {transaccion.parametros && (
                  <div className="flex items-center justify-end mt-1">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    )}
                  </div>
                )}
                {isExpanded && transaccion.parametros && (
                  <div className="mt-2 space-y-1 pl-4 border-l-2 border-gray-200">
                    {transaccion.parametros
                      .filter(param => param.cantidad !== 0) // Añadimos este filtro
                      .map((param, index) => (
                        <div key={index} className="flex justify-between text-xs text-gray-600">
                          <span className="font-medium">{param.nombre}:</span>
                          <span>{param.cantidad}</span>
                        </div>
                      ))}
                  </div>
                )}

                <p className="text-xs font-semibold mt-1 text-gray-700">{transactionType}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};



const ProductoCard = ({ producto, vendedorId }: { producto: Producto, vendedorId: string }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [transacciones, setTransacciones] = useState<Transaccion[]>([])
  const [ventas, setVentas] = useState<Venta[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')


  const calcularGanancia = (precio: number, porcentaje: number | undefined): number => {
    if (!porcentaje || porcentaje === 0) return 0;
    return precio * (porcentaje / 100);
  };

  // Convertir porcentajeGanancia a número (si ya es un número, lo usamos directamente)
  const porcentajeGanancia = producto.porcentajeGanancia 
    ? (typeof producto.porcentajeGanancia === 'string' 
        ? parseFloat(producto.porcentajeGanancia) 
        : producto.porcentajeGanancia) 
    : 0;

  // Función para agrupar ventas por día
  const agruparVentasPorDia = useCallback((ventas: Venta[]) => {
    const ventasDiarias: VentaDia[] = [];
    ventas.forEach((venta) => {
      const fecha = parseISO(venta.fecha);
      if (!isValid(fecha)) {
        console.error(`Invalid date in venta: ${venta.fecha}`);
        return;
      }
      const fechaStr = format(fecha, 'yyyy-MM-dd');
      const diaExistente = ventasDiarias.find((d) => d.fecha === fechaStr);
      if (diaExistente) {
        diaExistente.ventas.push(venta);
        diaExistente.total += typeof venta.total === 'number' ? venta.total : parseFloat(venta.total) || 0;
      } else {
        ventasDiarias.push({
          fecha: fechaStr,
          ventas: [venta],
          total: typeof venta.total === 'number' ? venta.total : parseFloat(venta.total) || 0,
        });
      }
    });
    return ventasDiarias.sort((a, b) => {
      const dateA = parseISO(a.fecha);
      const dateB = parseISO(b.fecha);
      return isValid(dateB) && isValid(dateA) ? dateB.getTime() - dateA.getTime() : 0;
    });
  }, []);

  // Función para agrupar ventas por semana
  const agruparVentasPorSemana = useCallback((ventas: Venta[]) => {
    const weekMap = new Map<string, VentaSemana>();

    const getWeekKey = (date: Date) => {
      const mondayOfWeek = startOfWeek(date, { weekStartsOn: 1 });
      const sundayOfWeek = endOfWeek(date, { weekStartsOn: 1 });
      return `${format(mondayOfWeek, 'yyyy-MM-dd')}_${format(sundayOfWeek, 'yyyy-MM-dd')}`;
    };

    ventas.forEach((venta) => {
      const ventaDate = parseISO(venta.fecha);
      if (!isValid(ventaDate)) {
        console.error(`Invalid date in venta: ${venta.fecha}`);
        return;
      }
      const weekKey = getWeekKey(ventaDate);

      if (!weekMap.has(weekKey)) {
        const mondayOfWeek = startOfWeek(ventaDate, { weekStartsOn: 1 });
        const sundayOfWeek = endOfWeek(ventaDate, { weekStartsOn: 1 });
        weekMap.set(weekKey, {
          fechaInicio: format(mondayOfWeek, 'yyyy-MM-dd'),
          fechaFin: format(sundayOfWeek, 'yyyy-MM-dd'),
          ventas: [],
          total: 0,
          ganancia: 0,
        });
      }

      const currentWeek = weekMap.get(weekKey)!;
      currentWeek.ventas.push(venta);
      currentWeek.total += typeof venta.total === 'number' ? venta.total : parseFloat(venta.total) || 0;
      currentWeek.ganancia = parseFloat((currentWeek.total * 0.08).toFixed(2));
    });

    return Array.from(weekMap.values()).sort((a, b) => {
      const dateA = parseISO(a.fechaInicio);
      const dateB = parseISO(b.fechaInicio);
      return isValid(dateB) && isValid(dateA) ? dateB.getTime() - dateA.getTime() : 0;
    });
  }, []);

  const calcularCantidadTotal = (parametros?: ProductoParametro[]): number => {
    if (!parametros) return 0;
    return parametros.reduce((total, param) => total + param.cantidad, 0);
  };

  const fetchProductData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(new Date().setMonth(new Date().getMonth() - 1))
        .toISOString().split('T')[0];

      const [transaccionesData, ventasData] = await Promise.all([
        getTransaccionesProducto(producto.id),
        getVentasProducto(producto.id, startDate, endDate, vendedorId)
      ]);

      setTransacciones(transaccionesData);
      setVentas(ventasData);
    } catch (error) {
      console.error('Error al obtener datos del producto:', error);
      setError('No se pudieron cargar los datos del producto. Por favor, intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  }, [producto.id, vendedorId]);

  const handleCardClick = () => {
    setIsDialogOpen(true)
    fetchProductData()
  }

  const ventasDiarias = useMemo(() => agruparVentasPorDia(ventas), [ventas, agruparVentasPorDia]);
  const ventasSemanales = useMemo(() => agruparVentasPorSemana(ventas), [ventas, agruparVentasPorSemana]);

  return (
    <>
      <Card
        onClick={handleCardClick}
        className="w-full cursor-pointer hover:bg-gray-100 transition-colors"
      >
        <CardContent className="p-4 flex items-center">
          {/* Contenedor de la imagen */}
          <div className="w-16 h-16 flex-shrink-0 relative mr-4">
            {producto.foto ? (
              <OptimizedImage
                src={producto.foto}
                fallbackSrc="/placeholder.svg"
                alt={producto.nombre}
                fill
                className="object-cover rounded"
              />
            ) : (
              <div className="w-full h-full bg-gray-200 rounded flex items-center justify-center">
                <span className="text-gray-500 text-xs">Sin imagen</span>
              </div>
            )}
          </div>

          {/* Contenido */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{producto.nombre}</h3>
            <p className="text-sm text-gray-600">
              Precio: ${formatPrice(producto.precio)}
            </p>
            {/* Visualización de ganancia */}
            {porcentajeGanancia > 0 && (
              <p className="text-sm font-bold text-green-600">
                Ganancia: ${formatPrice(calcularGanancia(producto.precio, porcentajeGanancia))} ({porcentajeGanancia}%)
              </p>
            )}
            {producto.tiene_parametros ? (
              <p className="text-sm text-gray-600">
                Cantidad: {calcularCantidadTotal(producto.parametros)}
              </p>
            ) : (
              <p className="text-sm text-gray-600">
                {producto.cantidad > 0 ? `Cantidad: ${producto.cantidad}` : 'Agotado'}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[800px] h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{producto.nombre}</DialogTitle>
          </DialogHeader>
          {isLoading ? (
            <div className="flex justify-center items-center h-48">Cargando...</div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <div className="flex-1 overflow-hidden">
              <Tabs defaultValue="informacion" className="h-full flex flex-col">
                <TabsList>
                  <TabsTrigger value="informacion">Información</TabsTrigger>
                  <TabsTrigger value="transacciones">Registro</TabsTrigger>
                  <TabsTrigger value="ventas">Ventas</TabsTrigger>
                </TabsList>
                <div className="flex-1 overflow-hidden">
                  <TabsContent value="informacion" className="h-full overflow-auto">
                    <div className="flex flex-col items-center space-y-4">
                      <div className="w-full h-[300px] flex items-center justify-center bg-gray-100 rounded-lg overflow-hidden">
                        <div className="relative w-full h-full">
                          <OptimizedImage
                            src={producto.foto || '/placeholder.svg'}
                            fallbackSrc="/placeholder.svg"
                            alt={producto.nombre}
                            fill
                            className="object-contain"
                          />
                        </div>
                      </div>
                      <div className="text-center w-full p-4 bg-white rounded-lg">
                        <h3 className="text-xl font-semibold">{producto.nombre}</h3>
                        <p className="text-gray-600">Precio: ${formatPrice(producto.precio)}</p>
                        {porcentajeGanancia > 0 && (
                          <p className="text-green-600 font-medium">
                            Ganancia: ${formatPrice(calcularGanancia(producto.precio, porcentajeGanancia))} ({porcentajeGanancia}%)
                          </p>
                        )}
                        {producto.tiene_parametros ? (
                          <div className="mt-4">
                            <div className="space-y-2">
                              {producto.parametros
                                ?.filter(parametro => parametro.cantidad > 0)
                                ?.map((parametro) => (
                                  <div key={parametro.nombre} className="flex justify-between px-4">
                                    <span>{parametro.nombre}</span>
                                    <span>{parametro.cantidad}</span>
                                  </div>
                                ))}
                              <div className="border-t pt-2 mt-2">
                                <span className="font-medium">
                                  Cantidad Total: {calcularCantidadTotal(producto.parametros)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-600">Cantidad disponible: {producto.cantidad}</p>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="transacciones" className="h-full overflow-auto mt-0 border-0">
                    <div className="sticky top-0 bg-white z-10 pb-4">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <Input
                          type="search"
                          placeholder="Buscar..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="overflow-auto">
                      <TransaccionesList
                        transacciones={transacciones}
                        searchTerm={searchTerm}
                        vendedorId={vendedorId}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="ventas" className="h-full overflow-auto mt-0 border-0">
                    <div className="space-y-4">
                      <Tabs defaultValue="por-dia">
                        <TabsList>
                          <TabsTrigger value="por-dia">Por día</TabsTrigger>
                          <TabsTrigger value="por-semana">Por semana</TabsTrigger>
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
                            {ventasDiarias.length > 0 ? (
                              ventasDiarias.map((venta) => (
                                <VentaDiaDesplegable
                                  key={venta.fecha}
                                  venta={venta}
                                  busqueda={searchTerm}
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
                            {ventasSemanales.length > 0 ? (
                              ventasSemanales.map((venta) => (
                                <VentaSemanaDesplegable
                                  key={`${venta.fechaInicio}-${venta.fechaFin}`}
                                  venta={venta}
                                  busqueda={searchTerm}
                                />
                              ))
                            ) : (
                              <div className="text-center py-4">No hay ventas registradas</div>
                            )}
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}


const ParametrosDialog = ({
  producto,
  open,
  onClose,
  onSubmit
}: ParametrosDialogProps) => {
  // Solo incluir parámetros con cantidad > 0
  const [parametros, setParametros] = useState<ProductoParametro[]>(() =>
    producto?.parametros
      ?.filter(p => p.cantidad > 0) // Filtrar parámetros con cantidad > 0
      ?.map(p => ({
        nombre: p.nombre,
        cantidad: 0
      })) || []
  );

  // Actualizar los parámetros cuando cambia el producto
  useEffect(() => {
    if (producto?.parametros) {
      setParametros(
        producto.parametros
          .filter(p => p.cantidad > 0) // Filtrar parámetros con cantidad > 0
          .map(p => ({
            nombre: p.nombre,
            cantidad: 0
          }))
      );
    }
  }, [producto]);

  const hasSelectedParameters = parametros.some(p => p.cantidad > 0);

  // Si no hay parámetros disponibles, mostrar un mensaje
  if (parametros.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seleccionar Parámetros de {producto?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="p-4 text-center text-gray-600">
            No hay parámetros disponibles para este producto.
          </div>
          <Button onClick={onClose}>Cerrar</Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Seleccionar Parámetros de {producto?.nombre}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {parametros.map((param, index) => {
            // Encontrar el parámetro original para obtener la cantidad máxima disponible
            const parametroOriginal = producto?.parametros?.find(p => p.nombre === param.nombre);
            const cantidadMaxima = parametroOriginal?.cantidad || 0;

            return (
              <div key={param.nombre} className="flex items-center justify-between">
                <div>
                  <label>{param.nombre}</label>
                  <span className="text-sm text-gray-500 ml-2">
                    (Disponible: {cantidadMaxima})
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const newParams = [...parametros];
                      newParams[index].cantidad = Math.max(0, param.cantidad - 1);
                      setParametros(newParams);
                    }}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span>{param.cantidad}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const newParams = [...parametros];
                      // No permitir exceder la cantidad máxima disponible
                      newParams[index].cantidad = Math.min(
                        param.cantidad + 1,
                        cantidadMaxima
                      );
                      setParametros(newParams);
                    }}
                    disabled={param.cantidad >= cantidadMaxima}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
          <div className="flex flex-col gap-2">
            {!hasSelectedParameters && (
              <p className="text-sm text-red-500">
                Debes seleccionar al menos un parámetro
              </p>
            )}
            <Button
              onClick={() => onSubmit(parametros)}
              disabled={!hasSelectedParameters}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};



export default function VendedorPage() {
  const params = useParams()
  const vendedorId = params.id as string
  const {
    isLoading,
    error,
    productosDisponibles,
    productosAgotados,
    ventasRegistro,
    transacciones,
    ventasDia,
    ventasAgrupadas,
    ventasSemanales,
    ventasDiarias,
    fetchProductos,
    fetchVentasRegistro,
    fetchTransacciones,
    sortOrder,
    setSortOrder,
    sortBy,
    setSortBy,
    handleEnviarVenta,
    productosSeleccionados,
    setProductosSeleccionados,
    fecha,
    setFecha
  } = useVendedorData(vendedorId)

  const [busqueda, setBusqueda] = useState('')
  const [seccion, setSeccion] = useState<'productos' | 'ventas' | 'registro'>('productos')
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [parametrosDialogOpen, setParametrosDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
  const [productosConParametrosEnEspera, setProductosConParametrosEnEspera] = useState<ProductoVenta[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [productosEnDialogo, setProductosEnDialogo] = useState<{
    id: string;
    cantidad: number;
  }[]>([]);



  const handleSort = (key: 'nombre' | 'cantidad') => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortOrder('asc')
    }
  }

  const sortedProductos = [...productosDisponibles].sort((a, b) => {
    if (sortBy === 'nombre') {
      return sortOrder === 'asc'
        ? a.nombre.localeCompare(b.nombre)
        : b.nombre.localeCompare(a.nombre)
    } else {
      return sortOrder === 'asc'
        ? a.cantidad - b.cantidad
        : b.cantidad - a.cantidad
    }
  })

  const productosFiltrados = sortedProductos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )


  const handleProductSelect = (producto: Producto) => {
    if (producto.tiene_parametros) {
      // La lógica existente para productos con parámetros
      if (selectedProductIds.includes(producto.id)) {
        setSelectedProductIds(prev => prev.filter(id => id !== producto.id));
        setProductosConParametrosEnEspera(prev =>
          prev.filter(p => p.id !== producto.id)
        );
      } else {
        setSelectedProduct(producto);
        setParametrosDialogOpen(true);
      }
    } else {
      // Nueva lógica para productos sin parámetros
      if (selectedProductIds.includes(producto.id)) {
        // Si ya está seleccionado, lo quitamos
        setSelectedProductIds(prev => prev.filter(id => id !== producto.id));
        setProductosEnDialogo(prev => prev.filter(p => p.id !== producto.id));
      } else {
        // Si no está seleccionado, lo añadimos con cantidad 1
        setSelectedProductIds(prev => [...prev, producto.id]);
        setProductosEnDialogo(prev => [...prev, { id: producto.id, cantidad: 1 }]);
      }
    }
  };

  const ajustarCantidadEnDialogo = (id: string, incremento: number) => {
    setProductosEnDialogo(prev => prev.map(p => {
      if (p.id === id) {
        // Encontrar el producto para obtener la cantidad máxima disponible
        const producto = productosDisponibles.find(prod => prod.id === id);
        const cantidadMaxima = producto ? producto.cantidad : 1;
        // Ajustar la cantidad sin exceder los límites
        return { ...p, cantidad: Math.max(1, Math.min(p.cantidad + incremento, cantidadMaxima)) };
      }
      return p;
    }));
  };

  const handleParametrosSubmit = (parametros: ProductoParametro[]) => {
    if (!selectedProduct) return;

    // Filtrar solo los parámetros con cantidad > 0
    const parametrosFiltrados = parametros.filter(param => param.cantidad > 0);

    // Añadir el producto a productosConParametrosEnEspera
    setProductosConParametrosEnEspera(prev => [
      ...prev,
      {
        ...selectedProduct,
        cantidadVendida: 1,
        parametrosVenta: parametrosFiltrados // Usar los parámetros filtrados
      }
    ]);

    // Añadir el ID del producto a selectedProductIds
    setSelectedProductIds(prev => [...prev, selectedProduct.id]);

    // Cerrar el diálogo de parámetros
    setParametrosDialogOpen(false);
    setSelectedProduct(null);
  };


  const handleConfirmSelection = () => {
    // Productos sin parámetros con sus cantidades ajustadas
    const newSelectedProducts = productosDisponibles
      .filter(producto =>
        selectedProductIds.includes(producto.id) &&
        !producto.tiene_parametros
      )
      .map(producto => {
        const productoEnDialogo = productosEnDialogo.find(p => p.id === producto.id);
        return {
          ...producto,
          cantidadVendida: productoEnDialogo ? productoEnDialogo.cantidad : 1
        };
      });

    // Combinar productos normales y productos con parámetros
    setProductosSeleccionados(prev => [
      ...prev,
      ...newSelectedProducts,
      ...productosConParametrosEnEspera
    ]);

    // Reiniciar las selecciones
    setSelectedProductIds([]);
    setProductosEnDialogo([]);
    setProductosConParametrosEnEspera([]);
    setIsDialogOpen(false);
  };

  // Añade un manejador para cuando se cierra el diálogo
  const handleDialogClose = () => {
    setSelectedProductIds([]);
    setProductosConParametrosEnEspera([]);
    setIsDialogOpen(false);
  };



  const handleAjustarCantidad = (id: string, incremento: number) => {
    setProductosSeleccionados(prev => prev.reduce((acc, p) => {
      if (p.id === id) {
        const nuevaCantidad = Math.max(0, Math.min(p.cantidadVendida + incremento, p.cantidad))
        if (nuevaCantidad === 0) {
          return acc; // Remove the product if quantity reaches 0
        }
        return [...acc, { ...p, cantidadVendida: nuevaCantidad }];
      }
      return [...acc, p];
    }, [] as ProductoVenta[]))
  }


  const productosAgotadosFiltrados = productosAgotados.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  const cambiarSeccion = (seccion: 'productos' | 'ventas' | 'registro') => {
    setSeccion(seccion);
    setSheetOpen(false); // Cerrar explícitamente el Sheet
  }

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Cargando...</div>
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error de autenticación</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="min-h-screen bg-orange-50 pb-10">
      <header className="bg-white border-b border-orange-200 shadow-sm p-4 mb-6">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-orange-800">Panel de Vendedor</h1>
          <div className="flex items-center space-x-4">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="border-orange-300 hover:bg-orange-100">
                  <MenuIcon className="h-5 w-5 text-orange-600" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-white border-l border-orange-200">
                <nav className="flex flex-col space-y-4 mt-8">
                  <Button
                    variant="ghost"
                    className={`${seccion === 'productos' ? 'bg-orange-100 text-orange-800' : 'text-orange-700 hover:bg-orange-50 hover:text-orange-800'}`}
                    onClick={() => cambiarSeccion('productos')}
                  >
                    Productos
                  </Button>
                  <Button
                    variant="ghost"
                    className={`${seccion === 'ventas' ? 'bg-orange-100 text-orange-800' : 'text-orange-700 hover:bg-orange-50 hover:text-orange-800'}`}
                    onClick={() => cambiarSeccion('ventas')}
                  >
                    Ventas
                  </Button>
                  <Button
                    variant="ghost"
                    className={`${seccion === 'registro' ? 'bg-orange-100 text-orange-800' : 'text-orange-700 hover:bg-orange-50 hover:text-orange-800'}`}
                    onClick={() => cambiarSeccion('registro')}
                  >
                    Registro
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4">
        {seccion === 'productos' && (
          <Tabs defaultValue="disponibles">
            <div className="flex justify-between items-center mb-4">
              <TabsList>
                <TabsTrigger value="disponibles">Disponibles</TabsTrigger>
                <TabsTrigger value="agotados">Agotados</TabsTrigger>
              </TabsList>
              {/* The export button has been removed as requested */}
            </div>
            <TabsContent value="disponibles">
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Buscar productos..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="pl-10 max-w-sm"
                  />
                </div>
              </div>
              <div className="flex justify-start space-x-2 mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSort('nombre')}
                  className="flex items-center text-xs px-2 py-1"
                >
                  Nombre
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSort('cantidad')}
                  className="flex items-center text-xs px-2 py-1"
                >
                  Cantidad
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-2">
                {productosFiltrados.map((producto) => (
                  <ProductoCard key={producto.id} producto={producto} vendedorId={vendedorId} />
                ))}
              </div>
            </TabsContent>
            <TabsContent value="agotados">
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Buscar productos agotados..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="pl-10 max-w-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                {productosAgotadosFiltrados.map((producto) => (
                  <ProductoCard key={producto.id} producto={producto} vendedorId={vendedorId} />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
        {seccion === 'ventas' && (
          <Tabs defaultValue="vender">
            <TabsList>
              <TabsTrigger value="vender">Vender</TabsTrigger>
              <TabsTrigger value="registro">Registro de Ventas</TabsTrigger>
            </TabsList>
            <TabsContent value="vender">
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">1. Selecciona la fecha</h2>
                <WeekPicker
                  value={fecha}
                  onChange={setFecha}
                />
                <h2 className="text-xl font-semibold">2. Selecciona los productos</h2>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setIsDialogOpen(true)}>Seleccionar Productos</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Seleccionar Productos</DialogTitle>
                    </DialogHeader>
                    <div className="mb-4">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <Input
                          placeholder="Buscar productos..."
                          value={busqueda}
                          onChange={(e) => setBusqueda(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <ScrollArea className="h-[300px] pr-4">
                      {productosDisponibles.filter(p =>
                        p.nombre.toLowerCase().includes(busqueda.toLowerCase())
                      ).map((producto) => (
                        <Card key={producto.id} className="mb-2">
                          <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center">
                              <Checkbox
                                id={`product-${producto.id}`}
                                checked={selectedProductIds.includes(producto.id)}
                                onCheckedChange={() => handleProductSelect(producto)}
                              />
                              <OptimizedImage
                                src={producto.foto || '/placeholder.svg'}
                                fallbackSrc="/placeholder.svg"
                                alt={producto.nombre}
                                width={40}
                                height={40}
                                className="rounded-md ml-4 mr-4"
                              />
                              <div>
                                <label htmlFor={`product-${producto.id}`} className="font-medium">
                                  {producto.nombre}
                                </label>
                                <p className="text-sm text-gray-500">
                                  Cantidad disponible: {producto.tiene_parametros
                                    ? calcularCantidadTotal(producto)
                                    : producto.cantidad}
                                </p>
                                <p className="text-sm text-gray-500">Precio: ${formatPrice(producto.precio)}</p>

                                {/* Selector de cantidad para productos sin parámetros */}
                                {!producto.tiene_parametros && selectedProductIds.includes(producto.id) && (
                                  <div className="flex items-center space-x-2 mt-2">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        ajustarCantidadEnDialogo(producto.id, -1);
                                      }}
                                      className="h-6 w-6"
                                    >
                                      <Minus className="h-3 w-3" />
                                    </Button>
                                    <span>
                                      {productosEnDialogo.find(p => p.id === producto.id)?.cantidad || 1}
                                    </span>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        ajustarCantidadEnDialogo(producto.id, 1);
                                      }}
                                      className="h-6 w-6"
                                      disabled={
                                        (productosEnDialogo.find(p => p.id === producto.id)?.cantidad || 1) >= producto.cantidad
                                      }
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}

                                {/* Mostrar los parámetros si ya están configurados */}
                                {producto.tiene_parametros && selectedProductIds.includes(producto.id) && (
                                  <div className="mt-2 text-sm text-gray-600">
                                    {productosConParametrosEnEspera
                                      .find(p => p.id === producto.id)
                                      ?.parametrosVenta
                                      ?.filter(param => param.cantidad > 0)
                                      ?.map(param => (
                                        <div key={param.nombre} className="flex justify-between">
                                          <span>{param.nombre}:</span>
                                          <span>{param.cantidad}</span>
                                        </div>
                                      ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}

                    </ScrollArea>
                    <Button onClick={handleConfirmSelection} className="mt-4">
                      Confirmar Selección
                    </Button>
                  </DialogContent>
                </Dialog>
                <div>
                  <h3 className="font-bold mb-2">Productos Seleccionados:</h3>
                  {productosSeleccionados.map((producto) => (
                    <div key={producto.id} className="flex justify-between items-center mb-2 p-2 bg-gray-100 rounded">
                      <div className="flex items-center">
                        <OptimizedImage
                          src={producto.foto || '/placeholder.svg'}
                          fallbackSrc="/placeholder.svg"
                          alt={producto.nombre}
                          width={40}
                          height={40}
                          className="rounded-md mr-2"
                        />
                        <div>
                          <p className="font-medium">{producto.nombre}</p>
                          {producto.parametrosVenta && producto.parametrosVenta.length > 0 ? (
                            <div className="text-xs text-gray-600">
                              {producto.parametrosVenta.map(param => (
                                <div key={param.nombre}>
                                  {param.nombre}: {param.cantidad}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-600">
                              Cantidad: {producto.cantidadVendida}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleAjustarCantidad(producto.id, -producto.cantidadVendida)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  {productosSeleccionados.length > 0 && (
                    <div className="mt-4">
                      <Button onClick={handleEnviarVenta} className="w-full">
                        Registrar Venta
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="registro">
              <div className="space-y-4">
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="Buscar ventas..."
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-2">Ventas por Día</h3>
                    {ventasDiarias.length > 0 ? (
                      <>
                        {/* Lista de ventas por día */}
                        {ventasDiarias
                          .filter(venta =>
                            venta.ventas.some(v =>
                              v.producto_nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
                              formatDate(v.fecha).toLowerCase().includes(busqueda.toLowerCase()) ||
                              v.total.toString().includes(busqueda)
                            )
                          )
                          .map((venta) => (
                            <VentaDiaDesplegable
                              key={venta.fecha}
                              venta={venta}
                              busqueda={busqueda}
                            />
                          ))}
                      </>
                    ) : (
                      <div className="text-center py-4">No hay ventas diarias registradas</div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
        {seccion === 'registro' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Registro de Actividades</h2>
            <div className="relative mb-4">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                type="search"
                placeholder="Buscar..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="overflow-auto">
              <TransaccionesList
                transacciones={transacciones}
                searchTerm={busqueda}
                vendedorId={vendedorId}
              />
            </div>
          </div>
        )}
      </div>
      <ParametrosDialog
        producto={selectedProduct}
        open={parametrosDialogOpen}
        onClose={() => {
          setParametrosDialogOpen(false);
          setSelectedProduct(null);
        }}
        onSubmit={handleParametrosSubmit}
      />
    </div>
  )
}