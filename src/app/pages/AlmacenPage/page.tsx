'use client'

import { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx';
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { startOfWeek, endOfWeek, format, isValid } from 'date-fns';
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import ContabilidadProducto from '@/components/ContabilidadProducto'
import ContabilidadVendedoresPage from '@/components/ContabilidadVendedoresPage'
import { Checkbox } from "@/components/ui/checkbox"
import { Menu, ArrowUpDown, Plus, Truck, UserPlus, FileSpreadsheet, Trash2, X, Minus, Loader2, MoreVertical, Eye, Edit, DollarSign, Search, TrendingUp, Calendar, Box, ArrowLeftRight } from "lucide-react"
import {
  getVendedores,
  getCurrentUser,
  getInventario,
  registerUser,
  getVentasVendedor,
  agregarProducto,
  editarProducto,
  entregarProducto,
  reducirProductoInventario,
  getTransaccionesVendedor,
  editarVendedor,
  eliminarProducto,
  deleteSale,
  createMerma,
  getMermas,
  deleteMerma,
  verificarNombreProducto,
  getVendedorProductos,
  getVendedorVentas,
  getVendedorTransacciones,
  enviarCafeteriaACocina,
  transferirProductoEntreVendedores
} from '../../services/api'
import ProductDialog from '@/components/ProductDialog'
import VendorDialog from '@/components/VendedorDialog'
import SalesSection from '@/components/SalesSection'
import { ImageUpload } from '@/components/ImageUpload'
import { Producto, Vendedor, Venta, Transaccion, Merma, Parametro } from '@/types'
import { toast } from "@/hooks/use-toast";
import { useVendorProducts } from '@/hooks/use-vendor-products';
import MenuSectionComponent from '@/components/MenuSection'
import React from 'react'



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

interface NewUser {
  nombre: string;
  password: string;
  telefono: string;
  rol: string;
}

interface NewProduct {
  nombre: string;
  precio: number;
  precioCompra: number;
  cantidad: number;
  foto: string;
  tieneParametros: boolean;
  porcentajeGanancia: number;
  seccion: string;
  parametros: Array<{
    nombre: string;
    cantidad: number;
  }>;
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


const useAlmacenData = () => {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [inventario, setInventario] = useState<Producto[]>([])

  const fetchVendedores = useCallback(async () => {
    try {
      const data = await getVendedores()
      setVendedores(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los vendedores",
        variant: "destructive",
      })
    }
  }, [])

  const fetchInventario = useCallback(async () => {
    try {
      const data = await getInventario()
      setInventario(data as Producto[])
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al obtener el inventario",
        variant: "destructive",
      })
    }
  }, [])

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser()
        if (user?.rol === 'Almacen') {
          setIsAuthenticated(true)
          await Promise.all([fetchVendedores(), fetchInventario()])
        } else {
          router.push('/pages/LoginPage')
        }
      } catch (error) {
        router.push('/pages/LoginPage')
      }
    }

    checkAuth()
  }, [router, fetchVendedores, fetchInventario])

  return { isAuthenticated, vendedores, inventario, fetchVendedores, fetchInventario, setInventario }
}

const SeccionAutocomplete = ({
  value,
  onChange,
  seccionesExistentes,
  placeholder = "Sección del producto"
}: {
  value: string;
  onChange: (value: string) => void;
  seccionesExistentes: string[];
  placeholder?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredSecciones, setFilteredSecciones] = useState<string[]>([]);

  useEffect(() => {
    if (value) {
      const filtered = seccionesExistentes.filter(seccion =>
        seccion.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSecciones(filtered);
    } else {
      setFilteredSecciones(seccionesExistentes);
    }
  }, [value, seccionesExistentes]);

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          // Delay para permitir el clic en las opciones
          setTimeout(() => setIsOpen(false), 200);
        }}
        placeholder={placeholder}
      />

      {isOpen && (filteredSecciones.length > 0 || value) && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {/* Opción para crear nueva sección si no existe */}
          {value && !seccionesExistentes.includes(value) && (
            <div
              className="px-3 py-2 cursor-pointer hover:bg-gray-100 border-b text-blue-600"
              onClick={() => {
                onChange(value);
                setIsOpen(false);
              }}
            >
              <span className="font-medium">Crear nueva: &quot;{value}&quot;</span>

            </div>
          )}

          {/* Secciones existentes filtradas */}
          {filteredSecciones.map((seccion, index) => (
            <div
              key={index}
              className="px-3 py-2 cursor-pointer hover:bg-gray-100"
              onClick={() => {
                onChange(seccion);
                setIsOpen(false);
              }}
            >
              {seccion}
            </div>
          ))}

          {filteredSecciones.length === 0 && value && seccionesExistentes.includes(value) && (
            <div className="px-3 py-2 text-gray-500">
              No hay más secciones que coincidan
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function AlmacenPage() {
  const { isAuthenticated, vendedores, inventario, fetchVendedores, fetchInventario, setInventario } = useAlmacenData()
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [newUser, setNewUser] = useState<NewUser>({
    nombre: '',
    password: '',
    telefono: '',
    rol: ''
  })
  const [productosVendedor, setProductosVendedor] = useState<Producto[]>([])
  const [ventasVendedor, setVentasVendedor] = useState<Venta[]>([])
  const [transaccionesVendedor, setTransaccionesVendedor] = useState<Transaccion[]>([])
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState<Vendedor | null>(null)
  const [modeVendedor, setModeVendedor] = useState<'view' | 'edit' | 'ventas' | 'productos' | 'transacciones'>('view')
  const [ventasSemanales, setVentasSemanales] = useState<VentaSemana[]>([])
  const [ventasDiarias, setVentasDiarias] = useState<VentaDia[]>([])
  const [showAddProductModal, setShowAddProductModal] = useState(false)
  const [newProduct, setNewProduct] = useState<NewProduct>({
    nombre: '',
    precio: 0,
    precioCompra: 0,
    cantidad: 0,
    foto: '',
    tieneParametros: false,
    porcentajeGanancia: 0,
    seccion: '',
    parametros: []
  });

  const [searchTerm, setSearchTerm] = useState("")
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  // En AlmacenPage.tsx, actualizar el estado:
  const [activeSection, setActiveSection] = useState<'productos' | 'vendedores' | 'ventas' | 'menu' | 'contabilidad' | 'contabilidad-vendedores'>('productos')
  const [showMassDeliveryDialog, setShowMassDeliveryDialog] = useState(false)
  const [selectedVendorForMassDelivery, setSelectedVendorForMassDelivery] = useState<number | null>(null)
  const [selectedProducts, setSelectedProducts] = useState<{
    [productId: string]: {
      cantidad: number;
      parametros?: {
        [parametroId: string]: number;
      };
    };
  }>({});

  const [productSearchTerm, setProductSearchTerm] = useState("")
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [sortBy, setSortBy] = useState<'nombre' | 'cantidad'>('nombre')
  const [activeProductTab, setActiveProductTab] = useState<'inventario' | 'merma' | 'agotados'>('inventario');
  const [mermas, setMermas] = useState<Merma[]>([]);
  const [mermaToDelete, setMermaToDelete] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [expandedMermas, setExpandedMermas] = useState<Set<string>>(new Set());
  const [mermaSearchTerm, setMermaSearchTerm] = useState("")
  const [mermaSortOrder, setMermaSortOrder] = useState<'asc' | 'desc'>('asc')
  const [mermaSortBy, setMermaSortBy] = useState<'nombre' | 'cantidad'>('nombre')
  const [nombreExiste, setNombreExiste] = useState(false);
  const [verificandoNombre, setVerificandoNombre] = useState(false);
  const { updateProductQuantity } = useVendorProducts();
  const [reduceDialogOpen, setReduceDialogOpen] = useState(false)
  const [productToReduce, setProductToReduce] = useState<Producto | null>(null)
  const [quantityToReduce, setQuantityToReduce] = useState(0)
  const [parameterQuantities, setParameterQuantities] = useState<Record<string, number>>({})
  const [showDestinationDialog, setShowDestinationDialog] = useState(false)
  const [selectedDestination, setSelectedDestination] = useState<'almacen' | 'merma' | 'cocina' | null>(null)
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  // Agregar estos estados al inicio del componente
  const [showVentasModal, setShowVentasModal] = useState(false)
  const [ventasVendedorSimple, setVentasVendedorSimple] = useState<Venta[]>([])
  const [vendedorVentasSeleccionado, setVendedorVentasSeleccionado] = useState<Vendedor | null>(null)
  const [loadingVentas, setLoadingVentas] = useState(false)
  const [expandedVentasDays, setExpandedVentasDays] = useState<Set<string>>(new Set());
  const [expandedVentasProducts, setExpandedVentasProducts] = useState<Set<string>>(new Set());
  const [seccionesExistentes, setSeccionesExistentes] = useState<string[]>([])


  const obtenerSeccionesUnicas = useCallback(() => {
    const secciones = inventario
      .map(producto => producto.seccion)
      .filter((seccion): seccion is string => seccion !== undefined && seccion !== null && seccion.trim() !== '')
      .filter((seccion, index, array) => array.indexOf(seccion) === index) // Eliminar duplicados
      .sort(); // Ordenar alfabéticamente

    setSeccionesExistentes(secciones);
  }, [inventario]);


  useEffect(() => {
    obtenerSeccionesUnicas();
  }, [inventario, obtenerSeccionesUnicas]);

  // Función simplificada para mostrar ventas
  const handleMostrarVentas = async (vendedor: Vendedor) => {
    try {
      setLoadingVentas(true)
      setVendedorVentasSeleccionado(vendedor)

      // Hacer solo la petición de ventas
      const ventas = await getVendedorVentas(vendedor.id)
      setVentasVendedorSimple(ventas)
      setShowVentasModal(true)

    } catch (error) {
      console.error('Error al cargar ventas:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar las ventas del vendedor",
        variant: "destructive",
      })
    } finally {
      setLoadingVentas(false)
    }
  }

  const toggleVentasDay = (fecha: string) => {
    setExpandedVentasDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fecha)) {
        newSet.delete(fecha);
      } else {
        newSet.add(fecha);
      }
      return newSet;
    });
  };

  const toggleVentasProduct = (ventaId: string) => {
    setExpandedVentasProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ventaId)) {
        newSet.delete(ventaId);
      } else {
        newSet.add(ventaId);
      }
      return newSet;
    });
  };

  const isProductoAgotado = (producto: Producto): boolean => {
    if (producto.tiene_parametros && producto.parametros) {
      // Si tiene parámetros, está agotado si todos los parámetros están en 0
      return producto.parametros.every(param => param.cantidad === 0);
    }
    // Si no tiene parámetros, está agotado si la cantidad es 0
    return producto.cantidad === 0;
  };

  const getFilteredProducts = (productos: Producto[]): Producto[] => {
    const filteredBySearch = productos.filter((producto) =>
      producto.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );

    switch (activeProductTab) {
      case 'agotados':
        return filteredBySearch.filter(isProductoAgotado);
      case 'inventario':
        return filteredBySearch.filter(producto => !isProductoAgotado(producto));
      default:
        return filteredBySearch;
    }
  };


  const handleDeleteVendorData = async (vendorId: string) => {
    try {
      const response = await fetch(`/api/users/vendedores?id=${vendorId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al eliminar datos');
      }

      return await response.json();
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  };


  const toggleMermaExpansion = (mermaId: string) => {
    setExpandedMermas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(mermaId)) {
        newSet.delete(mermaId);
      } else {
        newSet.add(mermaId);
      }
      return newSet;
    });
  };

  const handleMermaSort = (key: 'nombre' | 'cantidad') => {
    if (mermaSortBy === key) {
      setMermaSortOrder(mermaSortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setMermaSortBy(key)
      setMermaSortOrder('asc')
    }
  }

  const fetchMermas = useCallback(async () => {
    try {
      const data = await getMermas();
      setMermas(data);
    } catch (error) {
      console.error('Error al obtener las mermas:', error);
      toast({
        title: "Error",
        description: "Error al obtener las mermas",
        variant: "destructive",
      });
    }
  }, []);


  useEffect(() => {
    if (activeProductTab === 'merma') {
      console.log('Fetching mermas...');
      fetchMermas().then(() => {
        console.log('Mermas actualizadas:', mermas);
      });
    }
  }, [activeProductTab, fetchMermas]);

  const handleExportToExcel = () => {
    const header = ["Nombre", "Precio", "Cantidad"];
    const data = inventario.map(producto => [producto.nombre, producto.precio, producto.cantidad]);

    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Productos");

    XLSX.writeFile(wb, "lista_productos.xlsx");
  };

  const handleProductMerma = async (
    productId: string,
    vendorId: string,
    cantidad: number,
    parametros?: Parametro[]
  ) => {
    try {
      console.log('🟢 handleProductMerma llamado con:', {
        productId,
        vendorId,
        cantidad,
        parametros
      });

      // ✅ CORRECCIÓN: Convertir vendorId a string primero
      const vendorIdStr = String(vendorId || '');
      const origenId = vendorIdStr.trim() !== '' ? vendorIdStr : 'cafeteria';

      console.log('🟡 origenId determinado:', origenId);

      // ✅ Transformar y filtrar los parámetros
      const parametrosFormateados = parametros
        ?.filter(p => p.cantidad > 0)
        ?.map(p => ({
          nombre: p.nombre,
          cantidad: p.cantidad
        }));

      console.log('🟡 Datos preparados para createMerma:', {
        productId,
        origenId,
        cantidad,
        parametrosFormateados,
        tieneParametros: !!parametrosFormateados?.length
      });

      // ✅ Validar que hay algo que enviar
      if (parametrosFormateados && parametrosFormateados.length > 0) {
        const totalCantidad = parametrosFormateados.reduce((sum, p) => sum + p.cantidad, 0);
        if (totalCantidad === 0) {
          toast({
            title: "Error",
            description: "Debe especificar al menos una cantidad mayor a 0",
            variant: "destructive",
          });
          return;
        }
      } else if (!cantidad || cantidad === 0) {
        toast({
          title: "Error",
          description: "Debe especificar una cantidad mayor a 0",
          variant: "destructive",
        });
        return;
      }

      console.log('🟡 Llamando a createMerma...');

      await createMerma(
        String(productId), // ✅ Asegurar que sea string
        origenId,
        cantidad,
        parametrosFormateados
      );

      console.log('✅ createMerma completado exitosamente');

      // Actualizar los estados después de la operación
      if (vendedorSeleccionado) {
        console.log('🔄 Actualizando productos del vendedor...');
        const updatedProducts = await getProductosCompartidos();
        setProductosVendedor(updatedProducts);
      }

      console.log('🔄 Actualizando inventario...');
      await fetchInventario();

      console.log('🔄 Actualizando mermas...');
      await fetchMermas();

      console.log('✅ Todos los estados actualizados');

      toast({
        title: "Éxito",
        description: "Merma registrada correctamente",
      });
    } catch (error) {
      console.error('❌ Error en handleProductMerma:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al registrar la merma",
        variant: "destructive",
      });
      throw error; // ✅ IMPORTANTE: Re-lanzar el error
    }
  };

  // En AlmacenPage, reemplazar la función handleProductTransfer
  const handleProductTransfer = async (
    productId: string,
    fromVendorId: string,
    toVendorId: string,
    cantidad: number,
    parametros?: Array<{ nombre: string; cantidad: number }>
  ) => {
    try {
      console.log('🟢 handleProductTransfer iniciado:', {
        productId,
        fromVendorId,
        toVendorId,
        cantidad,
        parametros
      });

      // Buscar el producto
      const producto = inventario.find(p => p.id.toString() === productId.toString());
      if (!producto) {
        throw new Error('Producto no encontrado');
      }

      // Buscar vendedores
      const vendedorOrigen = vendedores.find(v => v.id.toString() === fromVendorId.toString());
      const vendedorDestino = vendedores.find(v => v.id.toString() === toVendorId.toString());

      if (!vendedorOrigen || !vendedorDestino) {
        throw new Error('Vendedor no encontrado');
      }

      console.log('🟡 Llamando a transferirProductoEntreVendedores...');

      // Llamar a la función de API
      const result = await transferirProductoEntreVendedores(
        productId,
        fromVendorId,
        toVendorId,
        cantidad,
        parametros
      );

      console.log('✅ Transferencia completada:', result);

      // Actualizar estados locales
      if (vendedorSeleccionado) {
        console.log('🔄 Actualizando productos del vendedor...');
        const updatedProducts = await getVendedorProductos(vendedorSeleccionado.id);
        setProductosVendedor(updatedProducts);

        console.log('🔄 Actualizando transacciones del vendedor...');
        const updatedTransactions = await getVendedorTransacciones(vendedorSeleccionado.id);
        setTransaccionesVendedor(updatedTransactions);
      }

      console.log('🔄 Actualizando inventario...');
      await fetchInventario();

      console.log('🔄 Actualizando vendedores...');
      await fetchVendedores();

      console.log('✅ Estados actualizados correctamente');

      toast({
        title: "Éxito",
        description: `Producto transferido de ${vendedorOrigen.nombre} a ${vendedorDestino.nombre}`,
      });

      return result;

    } catch (error) {
      console.error('❌ Error en handleProductTransfer:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al transferir el producto",
        variant: "destructive",
      });
      throw error;
    }
  };



  const handleDeleteProduct = async (productId: string) => {
    try {
      await eliminarProducto(productId);
      await fetchInventario();
      setSelectedProduct(null);
      alert('Producto eliminado exitosamente');
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Error al eliminar el producto. Por favor, inténtelo de nuevo.');
    }
  };


  const handleDeleteMerma = (productoId: string) => {
    setMermaToDelete(productoId);
  };


  const confirmDeleteMerma = async () => {
    if (!mermaToDelete) return;

    try {
      await deleteMerma(mermaToDelete);
      // En lugar de filtrar manualmente, volvemos a cargar todas las mermas
      await fetchMermas();

      toast({
        title: "Éxito",
        description: "Merma eliminada correctamente",
      });
    } catch (error) {
      console.error('Error al eliminar la merma:', error);
      toast({
        title: "Error",
        description: "Error al eliminar la merma",
        variant: "destructive",
      });
    } finally {
      setMermaToDelete(null);
    }
  };


  const agruparMermas = (mermas: Merma[]) => {
    return mermas.reduce((acc, merma) => {
      const key = merma.producto.id;

      // Calcular la cantidad total basada en los parámetros si existen
      const cantidadTotal = merma.producto.tiene_parametros && merma.producto.parametros
        ? merma.producto.parametros.reduce((sum, param) => sum + param.cantidad, 0)
        : merma.cantidad;

      if (!acc[key]) {
        // Primera vez que encontramos este producto
        acc[key] = {
          ...merma,
          cantidad: cantidadTotal,
          producto: {
            ...merma.producto,
            parametros: merma.producto.tiene_parametros ? (merma.producto.parametros || []) : []
          }
        };
      } else {
        // Ya existe este producto, actualizamos la cantidad
        acc[key] = {
          ...acc[key],
          cantidad: acc[key].cantidad + cantidadTotal,
          producto: {
            ...acc[key].producto,
            parametros: merma.producto.parametros || []
          }
        };
      }
      return acc;
    }, {} as { [key: string]: Merma });
  };



  const calcularCantidadTotal = (producto: Producto) => {
    if (producto.tiene_parametros && producto.parametros) {
      return producto.parametros.reduce((sum, param) => sum + param.cantidad, 0);
    }
    return producto.cantidad; // Si no tiene parámetros, usar la cantidad directa
  };

  // Reemplazar la función existente
  const handleProductDelivery = async (
    productId: string,
    cantidad: number,
    parametros?: Array<{ nombre: string; cantidad: number }>,
    userId?: number // NUEVO PARÁMETRO
  ) => {
    try {
      if (!productId) {
        toast({
          title: "Error",
          description: "ID de producto inválido",
          variant: "destructive",
        });
        return;
      }

      await entregarProducto(productId, cantidad, parametros, userId);

      // Buscar nombre del vendedor para el mensaje
      const vendedor = vendedores.find(v => Number(v.id) === userId);
      const nombreDestino = vendedor ? vendedor.nombre : 'destino desconocido';

      toast({
        title: "Éxito",
        description: `Producto entregado a ${nombreDestino} correctamente`,
      });

      // Actualizar inventario
      await fetchInventario();
    } catch (error) {
      console.error('Error en entrega de producto:', error);
      toast({
        title: "Error",
        description: "Error al entregar el producto",
        variant: "destructive",
      });
    }
  };


  const handleMassDelivery = async () => {
    try {
      if (Object.keys(selectedProducts).length === 0) {
        toast({
          title: "Error",
          description: "Por favor, selecciona al menos un producto.",
          variant: "destructive",
        });
        return;
      }

      if (!selectedVendorForMassDelivery) {
        toast({
          title: "Error",
          description: "Por favor, selecciona un destinatario.",
          variant: "destructive",
        });
        return;
      }

      await fetchInventario();

      for (const [productId, productData] of Object.entries(selectedProducts)) {
        const { cantidad, parametros } = productData;

        const producto = inventario.find((p) => p.id.toString() === productId.toString());
        if (!producto) continue;

        // Calcular la cantidad total correctamente
        const cantidadTotal = parametros
          ? Object.values(parametros).reduce((sum, val) => sum + (Number(val) || 0), 0)
          : Number(cantidad) || 0;

        // Validar que la cantidad sea un número válido
        if (isNaN(cantidadTotal) || cantidadTotal <= 0) {
          toast({
            title: "Error",
            description: `Cantidad inválida para el producto ${producto.nombre}`,
            variant: "destructive",
          });
          continue;
        }

        if (producto.cantidad < cantidadTotal) {
          toast({
            title: "Error",
            description: `Stock insuficiente para ${producto.nombre}`,
            variant: "destructive",
          });
          continue;
        }

        // Transformar parámetros
        const parametrosArray = parametros
          ? Object.entries(parametros)
            .filter(([nombre]) => nombre && nombre !== '0' && nombre !== '1')
            .map(([nombre, cantidadParam]) => ({
              nombre,
              cantidad: Number(cantidadParam) || 0
            }))
          : undefined;

        try {
          await entregarProducto(
            productId,
            cantidadTotal,
            parametrosArray,
            selectedVendorForMassDelivery
          );
        } catch (error) {
          console.error(`Error en entrega: ${error}`);
          toast({
            title: "Error",
            description: `Error al entregar ${producto.nombre}`,
            variant: "destructive",
          });
        }
      }

      await fetchInventario();
      setShowMassDeliveryDialog(false);
      setSelectedProducts({});
      setSelectedVendorForMassDelivery(null);
      toast({
        title: "Éxito",
        description: "Entrega masiva realizada con éxito",
      });

    } catch (error) {
      console.error('Error en entrega masiva:', error);
      toast({
        title: "Error",
        description: "Error en la entrega masiva",
        variant: "destructive",
      });
    }
  };


  const handleSort = (key: 'nombre' | 'cantidad') => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortOrder('asc')
    }
  }

  const sortedInventario = [...inventario].sort((a, b) => {
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

  const filteredInventarioForMassDelivery = inventario
    .filter((producto) => {
      // Primero verifica si el producto tiene cantidad mayor a 0
      if (producto.tiene_parametros && producto.parametros) {
        // Para productos con parámetros, verifica si al menos un parámetro tiene cantidad > 0
        return producto.parametros.some(param => param.cantidad > 0);
      }
      // Para productos sin parámetros, verifica si la cantidad es mayor a 0
      return producto.cantidad > 0;
    })
    .filter((producto) =>
      producto.nombre.toLowerCase().includes(productSearchTerm.toLowerCase())
    );



  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewUser({ ...newUser, [e.target.name]: e.target.value })
  }

  const handleRoleChange = (value: string) => {
    setNewUser({ ...newUser, rol: value })
  }

  const handleRegisterUser = async () => {
    try {
      await registerUser(newUser)
      setShowRegisterModal(false)
      setNewUser({
        nombre: '',
        password: '',
        telefono: '',
        rol: ''
      })
      await fetchVendedores()
    } catch (error) {
      console.error('Error al registrar usuario:', error)
    }
  }


  const calcularVentasDiarias = (ventas: Venta[]) => {
    const ventasPorDia = ventas.reduce((acc: Record<string, Venta[]>, venta) => {
      const fecha = parseLocalDate(venta.fecha);
      if (!isValid(fecha)) {
        console.error(`Fecha inválida en venta: ${venta.fecha}`);
        return acc;
      }

      const fechaStr = format(fecha, 'yyyy-MM-dd');
      if (!acc[fechaStr]) {
        acc[fechaStr] = [];
      }
      acc[fechaStr].push(venta);
      return acc;
    }, {});

    const ventasDiarias = Object.entries(ventasPorDia).map(([fecha, ventasDelDia]) => {
      return {
        fecha,
        ventas: ventasDelDia,
        total: ventasDelDia.reduce((sum, venta) => sum + parseFloat(venta.total.toString()), 0)
      };
    });

    setVentasDiarias(ventasDiarias);
  };


  const calcularVentasSemanales = (ventas: Venta[]) => {
    const ventasPorSemana = ventas.reduce((acc: Record<string, VentaSemana>, venta) => {
      const fecha = parseLocalDate(venta.fecha);
      if (!isValid(fecha)) {
        console.error(`Fecha inválida en venta: ${venta.fecha}`);
        return acc;
      }

      const inicioSemana = startOfWeek(fecha, { weekStartsOn: 1 });
      const finSemana = endOfWeek(fecha, { weekStartsOn: 1 });
      const claveWeek = `${format(inicioSemana, 'yyyy-MM-dd')}_${format(finSemana, 'yyyy-MM-dd')}`;

      if (!acc[claveWeek]) {
        acc[claveWeek] = {
          fechaInicio: format(inicioSemana, 'yyyy-MM-dd'),
          fechaFin: format(finSemana, 'yyyy-MM-dd'),
          ventas: [],
          total: 0,
          ganancia: 0
        };
      }

      acc[claveWeek].ventas.push(venta);
      const ventaTotal = parseFloat(venta.total.toString());
      acc[claveWeek].total += ventaTotal;
      acc[claveWeek].ganancia = parseFloat((acc[claveWeek].total * 0.08).toFixed(2));

      return acc;
    }, {});

    const ventasSemanas = Object.values(ventasPorSemana);
    setVentasSemanales(ventasSemanas);
  };


  // Funciones auxiliares
  const getProductosCompartidos = async () => {
    // Esta función debería estar definida en el servicio API
    // Pero por ahora, usamos la función existente como alternativa
    try {
      return await getVendedorProductos(vendedorSeleccionado?.id || '');
    } catch (error) {
      console.error('Error al obtener productos compartidos:', error);
      return [];
    }
  };

  const handleVerVendedor = async (vendedor: Vendedor, initialMode: 'view' | 'edit' | 'ventas' = 'view') => {
    try {
      setIsLoading(true);

      // Primero establecemos el modo y el vendedor seleccionado
      setModeVendedor(initialMode);
      setVendedorSeleccionado(vendedor);

      // ✅ SIEMPRE cargar TODOS los datos, sin importar el modo
      const [productosResult, ventasResult, transaccionesResult] = await Promise.allSettled([
        getVendedorProductos(vendedor.id),
        getVendedorVentas(vendedor.id),
        getVendedorTransacciones(vendedor.id)
      ]);

      // Procesar productos
      if (productosResult.status === 'fulfilled') {
        const productosCorregidos = productosResult.value.map(p => ({
          id: p.id,
          nombre: p.nombre,
          precio: p.precio,
          cantidad: p.cantidad,
          foto: p.foto || null,
          tiene_parametros: Boolean(p.tiene_parametros || p.tieneParametros),
          tieneParametros: Boolean(p.tiene_parametros || p.tieneParametros),
          parametros: p.parametros || []
        }));
        setProductosVendedor(productosCorregidos);
      } else {
        console.error('Error al obtener productos:', productosResult.reason);
        setProductosVendedor([]);
      }

      // Procesar ventas
      if (ventasResult.status === 'fulfilled') {
        const ventas = ventasResult.value;
        console.log('✅ Ventas cargadas:', ventas.length); // ← Log para debug
        setVentasVendedor(ventas);
        calcularVentasDiarias(ventas);
        calcularVentasSemanales(ventas);
      } else {
        console.error('Error al obtener ventas:', ventasResult.reason);
        setVentasVendedor([]);
        setVentasDiarias([]);
        setVentasSemanales([]);
      }

      // Procesar transacciones
      if (transaccionesResult.status === 'fulfilled') {
        setTransaccionesVendedor(transaccionesResult.value);
      } else {
        console.error('Error al obtener transacciones:', transaccionesResult.reason);
        setTransaccionesVendedor([]);
      }

      console.log('✅ Todos los datos cargados'); // ← Log para debug

    } catch (error) {
      console.error('Error al cargar datos del vendedor:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar algunos datos del vendedor.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };



  useEffect(() => {
    const verificarNombre = async () => {
      if (!newProduct.nombre.trim()) {
        setNombreExiste(false);
        return;
      }

      setVerificandoNombre(true);
      try {
        const existe = await verificarNombreProducto(newProduct.nombre);
        setNombreExiste(existe);
      } catch (error) {
        console.error('Error al verificar nombre:', error);
      } finally {
        setVerificandoNombre(false);
      }
    };

    const timeoutId = setTimeout(verificarNombre, 500);
    return () => clearTimeout(timeoutId);
  }, [newProduct.nombre]);

  const handleProductInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target

    if (type === 'file') {
      const fileList = e.target.files
      if (fileList && fileList.length > 0) {
        setNewProduct({ ...newProduct, [name]: fileList[0] })
      }
    } else if (type === 'checkbox') {
      if (name === 'tieneParametros') {
        setNewProduct({
          ...newProduct,
          tieneParametros: e.target.checked,
          parametros: e.target.checked ? [{ nombre: '', cantidad: 0 }] : []
        })
      } else if (name === 'usaPorcentajeGanancia') {
        setNewProduct({
          ...newProduct,
          porcentajeGanancia: e.target.checked ? 10 : 0
        })
      }
    } else {
      setNewProduct({
        ...newProduct,
        [name]: type === 'number' ? parseFloat(value) : value
      })
    }
  }


  const handleAddProduct = async () => {
    try {
      if (nombreExiste) {
        toast({
          title: "Error",
          description: "El nombre del producto ya existe",
          variant: "destructive",
        });
        return;
      }

      const formData = new FormData();
      formData.append('nombre', newProduct.nombre);
      formData.append('precio', newProduct.precio.toString());
      formData.append('precioCompra', newProduct.precioCompra.toString());
      formData.append('porcentajeGanancia', newProduct.porcentajeGanancia.toString());
      formData.append('seccion', newProduct.seccion); // Agregar esta línea

      if (newProduct.tieneParametros) {
        formData.append('tieneParametros', 'true');
        formData.append('parametros', JSON.stringify(newProduct.parametros));
        const cantidadTotal = newProduct.parametros.reduce((sum, param) => sum + param.cantidad, 0);
        formData.append('cantidad', cantidadTotal.toString());
      } else {
        formData.append('tieneParametros', 'false');
        formData.append('cantidad', newProduct.cantidad.toString());
      }

      if (newProduct.foto && typeof newProduct.foto === 'string' && newProduct.foto.trim() !== '') {
        formData.append('foto', newProduct.foto);
      }

      await agregarProducto(formData);
      await fetchInventario();
      setShowAddProductModal(false);
      setNewProduct({
        nombre: '',
        precio: 0,
        precioCompra: 0,
        porcentajeGanancia: 0,
        cantidad: 0,
        foto: '',
        tieneParametros: false,
        seccion: '', // Agregar esta línea
        parametros: []
      });

      toast({
        title: "Éxito",
        description: "Producto agregado correctamente",
      });
    } catch (error) {
      console.error('Error al agregar producto:', error);
      toast({
        title: "Error",
        description: "Error al agregar el producto",
        variant: "destructive",
      });
    }
  };


  const handleReduceVendorProduct = async (
    productId: string,
    cantidad: number,
    parametros?: Array<{ nombre: string; cantidad: number }>
  ) => {
    try {
      // Pasar el vendorId como cuarto parámetro
      await reducirProductoInventario(
        productId,
        cantidad,
        parametros,
        vendedorSeleccionado?.id || 'almacen' // ← AGREGAR ESTO
      );

      if (vendedorSeleccionado) {
        const updatedProducts = await getProductosCompartidos();
        setProductosVendedor(updatedProducts);
        const updatedTransactions = await getVendedorTransacciones(vendedorSeleccionado.id);
        setTransaccionesVendedor(updatedTransactions);
      }

      await fetchInventario();
      toast({
        title: "Éxito",
        description: "Producto reducido correctamente",
      });
    } catch (error) {
      console.error('Error al reducir producto:', error);
      toast({
        title: "Error",
        description: "Error al reducir el producto",
        variant: "destructive",
      });
    }
  };


  const handleEditVendedor = async (editedVendor: Vendedor & { newPassword?: string }) => {
    try {
      await editarVendedor(editedVendor.id, editedVendor);
      await fetchVendedores();
      setVendedorSeleccionado(null);
      toast({
        title: "Éxito",
        description: "Vendedor actualizado exitosamente",
      });
    } catch (error) {
      console.error('Error editing vendor:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Error desconocido al editar el vendedor',
        variant: "destructive",
      });
    }
  };

  const filteredInventario = sortedInventario.filter((producto) =>
    producto.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleUpdateProductQuantity = async (
    vendorId: string,
    productId: string,
    newQuantity: number,
    parametros?: Array<{ nombre: string; cantidad: number }>
  ) => {
    try {
      await updateProductQuantity(vendorId, productId, newQuantity, parametros);
      // Actualizar los productos del vendedor después de la actualización
      if (vendedorSeleccionado) {
        const updatedProducts = await getProductosCompartidos();
        setProductosVendedor(updatedProducts);
      }
    } catch (error) {
      console.error('Error al actualizar la cantidad:', error);
    }
  };

  const handleEditProduct = async (editedProduct: Producto, imageUrl: string | undefined) => {
    try {
      const formData = new FormData();
      formData.append('nombre', editedProduct.nombre);
      formData.append('precio', editedProduct.precio.toString());
      formData.append('cantidad', editedProduct.cantidad.toString());
      formData.append('tiene_parametros', editedProduct.tiene_parametros.toString());
      formData.append('precio_compra', (editedProduct.precio_compra || 0).toString());
      formData.append('porcentajeGanancia', (editedProduct.porcentajeGanancia || 0).toString());
      formData.append('seccion', editedProduct.seccion || ''); // Agregar esta línea
      formData.append('tiene_agrego', (editedProduct.tiene_agrego || false).toString());
      formData.append('tiene_costo', (editedProduct.tiene_costo || false).toString());

      if (editedProduct.agregos) {
        formData.append('agregos', JSON.stringify(editedProduct.agregos));
      }
      if (editedProduct.costos) {
        formData.append('costos', JSON.stringify(editedProduct.costos));
      }

      if (editedProduct.parametros) {
        formData.append('parametros', JSON.stringify(editedProduct.parametros));
      }

      if (imageUrl) {
        formData.append('fotoUrl', imageUrl);
        console.log('FormData imagen:', imageUrl);
      }

      await editarProducto(editedProduct.id, formData);
      await fetchInventario();
      setSelectedProduct(null);

      toast({
        title: "Éxito",
        description: "Producto actualizado correctamente",
      });
    } catch (error) {
      console.error('Error al editar producto:', error);
      toast({
        title: "Error",
        description: "Error al actualizar el producto",
        variant: "destructive",
      });
    }
  };





  const handleToggleVendedorActivo = async (vendedorId: string, activo: boolean) => {
    try {
      // Solo enviamos el campo activo para actualizar
      await editarVendedor(vendedorId, { activo });
      await fetchVendedores();
      toast({
        title: "Éxito",
        description: `Vendedor ${activo ? 'activado' : 'desactivado'} exitosamente`,
      });
    } catch (error) {
      console.error('Error al actualizar el estado del vendedor:', error);
      toast({
        title: "Error",
        description: "Error al actualizar el estado del vendedor",
        variant: "destructive",
      });
    }
  };

  const handleMostrarProductosVendedor = (vendedor: Vendedor) => {
    setVendedorSeleccionado(vendedor);
    setModeVendedor('productos');
  };

  const handleMostrarTransaccionesVendedor = (vendedor: Vendedor) => {
    setVendedorSeleccionado(vendedor);
    setModeVendedor('transacciones');
  };



  // Agregar una función para alternar la expansión de productos
  const toggleProductExpansion = (productId: string) => {
    setExpandedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  if (!isAuthenticated) {
    return <div>Cargando...</div>
  }

  return (
    <div className="container mx-auto p-4 relative bg-orange-50">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-orange-800">Panel de Almacén</h1>
        <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="fixed top-4 right-4 z-50 border-orange-300 hover:bg-orange-100">
              <Menu className="h-6 w-6 text-orange-600" />
              <span className="sr-only">Abrir menú</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="bg-white border-l border-orange-200">
            <nav className="flex flex-col space-y-4">
              <Button
                variant="ghost"
                className={activeSection === 'productos' ? 'bg-orange-100 text-orange-800' : 'text-orange-700 hover:bg-orange-50 hover:text-orange-800'}
                onClick={() => {
                  setActiveSection('productos')
                  setIsMenuOpen(false)
                }}
              >
                Almacén
              </Button>

              <Button
                variant="ghost"
                className={activeSection === 'vendedores' ? 'bg-orange-100 text-orange-800' : 'text-orange-700 hover:bg-orange-50 hover:text-orange-800'}
                onClick={() => {
                  setActiveSection('vendedores')
                  setIsMenuOpen(false)
                }}
              >
                Vendedores
              </Button>
              <Button
                variant="ghost"
                className={activeSection === 'ventas' ? 'bg-orange-100 text-orange-800' : 'text-orange-700 hover:bg-orange-50 hover:text-orange-800'}
                onClick={() => {
                  setActiveSection('ventas')
                  setIsMenuOpen(false)
                }}
              >
                Ventas
              </Button>

              <Button
                variant="ghost"
                className={activeSection === 'contabilidad' ? 'bg-orange-100 text-orange-800' : 'text-orange-700 hover:bg-orange-50 hover:text-orange-800'}
                onClick={() => {
                  setActiveSection('contabilidad')
                  setIsMenuOpen(false)
                }}
              >
                Contabilidad por producto
              </Button>

              <Button
                variant="ghost"
                className={activeSection === 'contabilidad-vendedores' ? 'bg-orange-100 text-orange-800' : 'text-orange-700 hover:bg-orange-50 hover:text-orange-800'}
                onClick={() => {
                  setActiveSection('contabilidad-vendedores')
                  setIsMenuOpen(false)
                }}
              >
                Contabilidad Vendedores
              </Button>

              <Button
                variant="ghost"
                className={activeSection === 'menu' ? 'bg-orange-100 text-orange-800' : 'text-orange-700 hover:bg-orange-50 hover:text-orange-800'}
                onClick={() => {
                  setActiveSection('menu')
                  setIsMenuOpen(false)
                }}
              >
                Menú
              </Button>
            </nav>
          </SheetContent>
        </Sheet>
      </div>



      {activeSection === 'productos' && (
        <div>
          <div className="flex flex-wrap justify-end gap-2 mb-4">
            <Button
              onClick={() => setShowAddProductModal(true)}
              className="flex-grow sm:flex-grow-0 bg-primary hover:bg-primary/90 text-white"
            >
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Agregar Producto</span>
              <span className="sm:hidden">Agregar</span>
            </Button>
            <Button
              onClick={() => setShowMassDeliveryDialog(true)}
              className="flex-grow sm:flex-grow-0 bg-orange-400 hover:bg-orange-500 text-white"
            >
              <Truck className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Entrega Masiva</span>
              <span className="sm:hidden">Entregar</span>
            </Button>
            <Button
              onClick={handleExportToExcel}
              className="flex-grow sm:flex-grow-0 bg-orange-300 hover:bg-orange-400 text-orange-800"
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Exportar a Excel</span>
              <span className="sm:hidden">Exportar</span>
            </Button>
          </div>

          <Card className="border-orange-200 shadow-md">
            <CardHeader className="border-b border-orange-100">
              <CardTitle className="text-orange-800 mb-4">Productos en Almacén</CardTitle>
              <div className="flex flex-wrap gap-2 justify-start">
                <Button
                  variant={activeProductTab === 'inventario' ? "default" : "outline"}
                  onClick={() => setActiveProductTab('inventario')}
                  size="sm"
                  className={activeProductTab === 'inventario' ? "bg-primary text-white" : "border-orange-200 text-orange-700 hover:bg-orange-50"}
                >
                  Inventario
                </Button>
                <Button
                  variant={activeProductTab === 'agotados' ? "default" : "outline"}
                  onClick={() => setActiveProductTab('agotados')}
                  size="sm"
                  className={`relative ${activeProductTab === 'agotados' ? "bg-primary text-white" : "border-orange-200 text-orange-700 hover:bg-orange-50"}`}
                >
                  Agotados
                </Button>
                <Button
                  variant={activeProductTab === 'merma' ? "default" : "outline"}
                  onClick={() => setActiveProductTab('merma')}
                  size="sm"
                  className={activeProductTab === 'merma' ? "bg-primary text-white" : "border-orange-200 text-orange-700 hover:bg-orange-50"}
                >
                  Merma
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              {activeProductTab === 'merma' ? (
                <div className="space-y-4">
                  {/* Barra de búsqueda */}
                  <div className="mb-4">
                    <Input
                      placeholder="Buscar en mermas..."
                      value={mermaSearchTerm}
                      onChange={(e) => setMermaSearchTerm(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>

                  {/* Botones de ordenamiento */}
                  <div className="flex justify-start space-x-2 mb-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleMermaSort('nombre')}
                      className="flex items-center text-xs px-2 py-1"
                    >
                      Nombre
                      <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleMermaSort('cantidad')}
                      className="flex items-center text-xs px-2 py-1"
                    >
                      Cantidad
                      <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </div>

                  {/* Lista de mermas con filtrado y ordenamiento */}
                  <div className="space-y-4">
                    {mermas.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No hay productos en merma registrados
                      </div>
                    ) : (
                      Object.values(agruparMermas(mermas))
                        .filter((merma) =>
                          merma.producto.nombre.toLowerCase().includes(mermaSearchTerm.toLowerCase())
                        )
                        .sort((a, b) => {
                          if (mermaSortBy === 'nombre') {
                            return mermaSortOrder === 'asc'
                              ? a.producto.nombre.localeCompare(b.producto.nombre)
                              : b.producto.nombre.localeCompare(a.producto.nombre);
                          } else {
                            return mermaSortOrder === 'asc'
                              ? a.cantidad - b.cantidad
                              : b.cantidad - a.cantidad;
                          }
                        })
                        .map((merma) => {
                          const tieneParametros = merma.producto.tiene_parametros;
                          const isExpanded = expandedMermas.has(merma.producto.id);

                          return (
                            <div
                              key={merma.producto.id}
                              className="p-3 rounded-lg border bg-white hover:bg-gray-50 transition-all duration-200"
                            >
                              <div
                                className={`flex items-center ${tieneParametros ? 'cursor-pointer' : ''}`}
                                onClick={(e) => {
                                  if (tieneParametros) {
                                    e.preventDefault();
                                    toggleMermaExpansion(merma.producto.id);
                                  }
                                }}
                              >
                                {/* Contenedor de la imagen */}
                                <div className="w-12 h-12 flex-shrink-0 relative mr-4">
                                  <Image
                                    src={imageErrors[merma.producto.id] ? '/placeholder.svg' : (merma.producto.foto || '/placeholder.svg')}
                                    alt={merma.producto.nombre}
                                    fill
                                    className="rounded-md object-cover"
                                    onError={() => {
                                      setImageErrors(prev => ({
                                        ...prev,
                                        [merma.producto.id]: true
                                      }));
                                    }}
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-medium text-base">{merma.producto.nombre}</h3>
                                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                                    <div>
                                      <p>${Number(merma.producto.precio).toFixed(2)}</p>
                                      <p>{new Date(merma.fecha).toLocaleDateString()}</p>
                                    </div>
                                    <div>
                                      <p>Cantidad: {merma.producto.tiene_parametros
                                        ? merma.producto.parametros?.reduce((sum, param) => sum + param.cantidad, 0)
                                        : merma.cantidad}</p>
                                      {tieneParametros && !isExpanded && (
                                        <p className="text-blue-500 text-xs">
                                          Parámetros
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteMerma(merma.producto.id);
                                  }}
                                >
                                  <Trash2 className="h-5 w-5" />
                                </Button>
                              </div>

                              {tieneParametros && isExpanded && (
                                <div className="mt-3 pl-16 border-t pt-2">
                                  <div className="space-y-1">
                                    {merma.producto.parametros?.map((parametro, index) => (
                                      <div key={`${parametro.nombre}-${index}`} className="flex justify-between text-sm">
                                        <span className="text-gray-600">{parametro.nombre}:</span>
                                        <span className="font-medium">{parametro.cantidad}</span>
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
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <Input
                      placeholder="Buscar productos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="max-w-sm"
                    />
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
                    {getFilteredProducts(filteredInventario).length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        {activeProductTab === 'agotados'
                          ? 'No hay productos agotados'
                          : 'No se encontraron productos'}
                      </div>
                    ) : (
                      getFilteredProducts(filteredInventario).map((producto) => (
                        <div
                          key={producto.id}
                          onClick={() => setSelectedProduct(producto)}
                          className={`flex items-center p-3 rounded-lg border mb-2 bg-white hover:bg-gray-50 cursor-pointer ${activeProductTab === 'agotados' ? 'border-red-200 bg-red-50' : ''
                            }`}
                        >
                          {/* Contenedor de la imagen */}
                          <div className="w-12 h-12 flex-shrink-0 relative mr-4">
                            <Image
                              src={imageErrors[producto.id] ? '/placeholder.svg' : (producto.foto || '/placeholder.svg')}
                              alt={producto.nombre}
                              fill
                              className="rounded-md object-cover"
                              onError={() => {
                                setImageErrors(prev => ({
                                  ...prev,
                                  [producto.id]: true
                                }));
                              }}
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-gray-900 truncate">
                              {producto.nombre}
                            </h3>
                            <div className="flex flex-wrap gap-x-4 text-sm text-gray-500">
                              <p>Precio: ${Number(producto.precio).toFixed(2)}</p>
                              <p className={`${calcularCantidadTotal(producto) === 0 ? 'text-red-500 font-semibold' : ''}`}>
                                Cantidad: {calcularCantidadTotal(producto)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </CardContent>


          </Card>
        </div>
      )}


      {activeSection === 'vendedores' && (
        <div>
          <div className="flex justify-end mb-4">
            <Button
              onClick={() => setShowRegisterModal(true)}
              className="bg-purple-500 hover:bg-purple-600 text-white"
            >
              <UserPlus className="mr-2 h-4 w-4" /> Agregar Usuario
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Vendedores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {vendedores.map((vendedor) => (
                  <div
                    key={vendedor.id}
                    className="w-full h-auto p-4 flex items-center text-left bg-white border border-gray-200 rounded-lg shadow-sm"
                  >
                    <div className="flex items-center space-x-4 flex-grow">
                      <Checkbox
                        id={`vendedor-activo-${vendedor.id}`}
                        checked={vendedor.activo !== false}
                        onCheckedChange={(checked) => {
                          handleToggleVendedorActivo(vendedor.id, !!checked);
                        }}
                      />
                      <div className="flex-grow">
                        <span className="font-semibold text-gray-800">{vendedor.nombre}</span>
                        <div className="text-sm text-gray-600">
                          <span>Teléfono: {vendedor.telefono}</span>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Abrir menú</span>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleVerVendedor(vendedor, 'edit')}>
                              <Edit className="mr-2 h-4 w-4" />
                              <span>Editar</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleVerVendedor(vendedor, 'ventas')}>
                              <DollarSign className="mr-2 h-4 w-4" />
                              <span>Ventas</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleMostrarProductosVendedor(vendedor)}>
                              <Box className="mr-2 h-4 w-4" />
                              <span>Productos</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleMostrarTransaccionesVendedor(vendedor)}>
                              <ArrowLeftRight className="mr-2 h-4 w-4" />
                              <span>Transacciones</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeSection === 'ventas' && (
        <SalesSection userRole="Almacen" />
      )}

      {activeSection === 'contabilidad' && (
        <ContabilidadProducto inventario={inventario} />
      )}

      {activeSection === 'contabilidad-vendedores' && (
        <ContabilidadVendedoresPage vendedores={vendedores} onRefresh={fetchVendedores} />
      )}

      {activeSection === 'menu' && (
        <MenuSectionComponent />
      )}

      <Dialog open={showMassDeliveryDialog} onOpenChange={setShowMassDeliveryDialog}>
        <DialogContent className="max-w-[95vw] w-full md:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Entrega Masiva</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Buscar productos..."
              value={productSearchTerm}
              onChange={(e) => setProductSearchTerm(e.target.value)}
            />
            <div className="max-h-[55vh] overflow-y-auto space-y-2 pr-2">
              {filteredInventarioForMassDelivery.map((producto) => (
                <div key={producto.id} className="flex flex-col p-3 border rounded-lg bg-white">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center h-5">
                      <Checkbox
                        id={`product-${producto.id}`}
                        checked={!!selectedProducts[producto.id]}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedProducts((prev) => ({
                              ...prev,
                              [producto.id]: {
                                cantidad: 0,
                                parametros: producto.tiene_parametros ? {} : undefined,
                              },
                            }));
                          } else {
                            setSelectedProducts((prev) => {
                              const { [producto.id]: _, ...rest } = prev;
                              return rest;
                            });
                          }
                        }}
                      />
                    </div>

                    <div className="w-16 h-16 relative rounded-md overflow-hidden flex-shrink-0">
                      <Image
                        src={producto.foto || '/placeholder.svg'}
                        alt={producto.nombre}
                        fill
                        className="object-cover"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <label htmlFor={`product-${producto.id}`} className="font-medium text-sm block">
                        {producto.nombre}
                      </label>
                      <div className="text-xs text-gray-600 mt-1 space-y-1">
                        <p>Precio: ${producto.precio}</p>
                        <p>Disponible: {producto.cantidad}</p>
                      </div>
                    </div>
                  </div>

                  {selectedProducts[producto.id] && (
                    <div className="mt-3 pl-8 space-y-3">
                      {!producto.tiene_parametros ? (
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-600 flex-shrink-0">Cantidad:</label>
                          <Input
                            type="number"
                            value={selectedProducts[producto.id]?.cantidad || ''}
                            onChange={(e) =>
                              setSelectedProducts((prev) => ({
                                ...prev,
                                [producto.id]: {
                                  ...prev[producto.id],
                                  cantidad: parseInt(e.target.value, 10) || 0,
                                },
                              }))
                            }
                            className="w-24 h-8"
                            min={1}
                            max={producto.cantidad}
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {producto.parametros?.map((parametro) => (
                            <div key={parametro.nombre} className="flex items-center gap-2">
                              <label className="text-sm text-gray-600 flex-1">
                                {parametro.nombre}:
                                <span className="text-xs text-gray-500 ml-1">
                                  (Máx: {parametro.cantidad})
                                </span>
                              </label>
                              <Input
                                type="number"
                                value={selectedProducts[producto.id]?.parametros?.[parametro.nombre] || ''}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value, 10) || 0;
                                  setSelectedProducts((prev) => ({
                                    ...prev,
                                    [producto.id]: {
                                      ...prev[producto.id],
                                      parametros: {
                                        ...prev[producto.id]?.parametros,
                                        [parametro.nombre]: value,
                                      },
                                    },
                                  }));
                                }}
                                className="w-24 h-8"
                                min={0}
                                max={parametro.cantidad}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="sticky bottom-0 pt-2 bg-white space-y-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Entregar a:</label>
                <Select
                  value={selectedVendorForMassDelivery?.toString() || ""}
                  onValueChange={(val) => setSelectedVendorForMassDelivery(Number(val))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un destinatario" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendedores.map((v) => (
                      <SelectItem key={v.id} value={v.id.toString()}>
                        {v.nombre} ({v.rol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleMassDelivery}
                disabled={Object.keys(selectedProducts).length === 0}
                className="w-full"
              >
                Entregar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      <Dialog open={showRegisterModal} onOpenChange={setShowRegisterModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Nuevo Usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label htmlFor="nombre" className="block text-sm font-medium text-gray-700">Nombre</label>
              <Input
                id="nombre"
                name="nombre"
                value={newUser.nombre}
                onChange={handleInputChange}
                placeholder="Nombre completo"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Contraseña</label>
              <Input
                id="password"
                name="password"
                type="password"
                value={newUser.password}
                onChange={handleInputChange}
                placeholder="Contraseña"
              />
            </div>
            <div>
              <label htmlFor="telefono" className="block text-sm font-medium text-gray-700">Teléfono</label>
              <Input
                id="telefono"
                name="telefono"
                value={newUser.telefono}
                onChange={handleInputChange}
                placeholder="Número de teléfono"
              />
            </div>
            <div>
              <label htmlFor="rol" className="block text-sm font-medium text-gray-700">Rol</label>
              <Select onValueChange={handleRoleChange} value={newUser.rol}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Almacen">Almacén</SelectItem>
                  <SelectItem value="Vendedor">Vendedor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleRegisterUser}>Registrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddProductModal} onOpenChange={setShowAddProductModal}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agregar Nuevo Producto</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label htmlFor="nombre" className="block text-sm font-medium text-gray-700">Nombre</label>
              <Input
                id="nombre"
                name="nombre"
                value={newProduct.nombre}
                onChange={handleProductInputChange}
                placeholder="Nombre del producto"
              />
              {verificandoNombre && (
                <p className="text-sm text-gray-500 mt-1">Verificando nombre...</p>
              )}
              {!verificandoNombre && nombreExiste && (
                <p className="text-sm text-red-500 mt-1">Este nombre de producto ya existe</p>
              )}
            </div>

            <div>
              <label htmlFor="precio" className="block text-sm font-medium text-gray-700">Precio</label>
              <Input
                id="precio"
                name="precio"
                type="number"
                value={newProduct.precio}
                onChange={handleProductInputChange}
                placeholder="Precio del producto"
              />
            </div>

            <div>
              <label htmlFor="precioCompra" className="block text-sm font-medium text-gray-700">Precio de Compra</label>
              <Input
                id="precioCompra"
                name="precioCompra"
                type="number"
                value={newProduct.precioCompra}
                onChange={handleProductInputChange}
                placeholder="Precio de compra del producto"
              />
            </div>

            <div>
              <label htmlFor="seccion" className="block text-sm font-medium text-gray-700">Sección</label>
              <SeccionAutocomplete
                value={newProduct.seccion}
                onChange={(value) => setNewProduct(prev => ({ ...prev, seccion: value }))}
                seccionesExistentes={seccionesExistentes}
                placeholder="Sección del producto"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="usaPorcentajeGanancia"
                checked={!!newProduct.porcentajeGanancia}
                onCheckedChange={(checked) => {
                  setNewProduct(prev => ({
                    ...prev,
                    porcentajeGanancia: checked ? (prev.porcentajeGanancia || 10) : 0
                  }));
                }}
              />
              <label htmlFor="usaPorcentajeGanancia">Definir % de ganancia</label>
            </div>

            {!!newProduct.porcentajeGanancia && (
              <div>
                <label htmlFor="porcentajeGanancia" className="block text-sm font-medium text-gray-700">% de ganancia</label>
                <Input
                  id="porcentajeGanancia"
                  name="porcentajeGanancia"
                  type="number"
                  value={newProduct.porcentajeGanancia}
                  onChange={handleProductInputChange}
                  placeholder="Porcentaje de ganancia"
                  min="0"
                  max="100"
                />
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="tieneParametros"
                checked={newProduct.tieneParametros}
                onCheckedChange={(checked) => {
                  setNewProduct(prev => ({
                    ...prev,
                    tieneParametros: checked as boolean,
                    parametros: checked ? [{ nombre: '', cantidad: 0 }] : []
                  }));
                }}
              />
              <label htmlFor="tieneParametros">Tiene parámetros</label>
            </div>

            {newProduct.tieneParametros ? (
              <div className="space-y-4">
                {/* Contenedor scrolleable para los parámetros */}
                <div className="max-h-[300px] overflow-y-auto pr-2 space-y-4 border rounded-lg p-4">
                  {newProduct.parametros.map((param, index) => (
                    <div key={index} className="flex space-x-2">
                      <Input
                        placeholder="Nombre del parámetro"
                        value={param.nombre}
                        onChange={(e) => {
                          const newParametros = [...newProduct.parametros];
                          newParametros[index].nombre = e.target.value;
                          setNewProduct(prev => ({ ...prev, parametros: newParametros }));
                        }}
                      />
                      <Input
                        type="number"
                        placeholder="Cantidad"
                        value={param.cantidad}
                        onChange={(e) => {
                          const newParametros = [...newProduct.parametros];
                          newParametros[index].cantidad = parseInt(e.target.value);
                          setNewProduct(prev => ({ ...prev, parametros: newParametros }));
                        }}
                      />
                      {/* Botón para eliminar parámetro */}
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => {
                          const newParametros = newProduct.parametros.filter((_, i) => i !== index);
                          setNewProduct(prev => ({ ...prev, parametros: newParametros }));
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                {/* Botón para agregar parámetro fuera del área scrolleable */}
                <Button
                  type="button"
                  onClick={() => {
                    setNewProduct(prev => ({
                      ...prev,
                      parametros: [...prev.parametros, { nombre: '', cantidad: 0 }]
                    }));
                  }}
                  className="w-full"
                >
                  + Agregar parámetro
                </Button>
              </div>
            ) : (
              <div>
                <label htmlFor="cantidad" className="block text-sm font-medium text-gray-700">Cantidad</label>
                <Input
                  id="cantidad"
                  name="cantidad"
                  type="number"
                  value={newProduct.cantidad}
                  onChange={handleProductInputChange}
                  placeholder="Cantidad del producto"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Foto del producto
              </label>
              <ImageUpload
                value={newProduct.foto}
                onChange={(url) => setNewProduct(prev => ({ ...prev, foto: url }))}
                disabled={false}
              />
            </div>

            {/* Botón de agregar justo después del campo de foto */}
            <div className="pt-4">
              <Button
                onClick={handleAddProduct}
                className="w-full"
                disabled={nombreExiste || verificandoNombre}
              >
                {verificandoNombre ? 'Verificando...' : 'Agregar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>



      <AlertDialog open={mermaToDelete !== null} onOpenChange={(open) => !open && setMermaToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMermaToDelete(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteMerma}
              className="bg-red-500 hover:bg-red-600"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {selectedProduct && (
        <ProductDialog
          product={{ ...selectedProduct, foto: selectedProduct.foto || '' }}
          onClose={() => setSelectedProduct(null)}
          vendedores={vendedores}
          onEdit={handleEditProduct}
          onDelete={handleDeleteProduct}
          onDeliver={(productId, cantidadTotal, parametros, userId) =>
            handleProductDelivery(productId, cantidadTotal, parametros, userId)
          }
          seccionesExistentes={seccionesExistentes}
        />
      )}



      {vendedorSeleccionado && (
        <>
          {isLoading ? (
            <Dialog open={true} onOpenChange={() => setVendedorSeleccionado(null)}>
              <DialogContent>
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                  <p>Cargando datos del vendedor...</p>
                </div>
              </DialogContent>
            </Dialog>
          ) : (
            <VendorDialog
              almacen={inventario}
              vendor={vendedorSeleccionado}
              onClose={() => setVendedorSeleccionado(null)}
              onEdit={handleEditVendedor}
              productos={productosVendedor}
              ventas={ventasVendedor}
              ventasSemanales={ventasSemanales}
              ventasDiarias={ventasDiarias}
              transacciones={transaccionesVendedor}
              onProductReduce={(productId, vendorId, cantidad, parametros) =>
                handleReduceVendorProduct(productId, cantidad, parametros)
              }
              onDeleteSale={deleteSale}
              onProductMerma={handleProductMerma}
              vendedores={vendedores}
              onDeleteVendorData={handleDeleteVendorData}
              onUpdateProductQuantity={handleUpdateProductQuantity}
              initialMode={modeVendedor}
              onProductTransfer={handleProductTransfer}
            />
          )}
        </>
      )}



      <Dialog open={reduceDialogOpen} onOpenChange={setReduceDialogOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Reducir cantidad de producto</DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0">
            <div className="space-y-4">
              <p className="font-medium">{productToReduce?.nombre}</p>

              {productToReduce?.parametros && productToReduce.parametros.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">Especifique la cantidad a reducir para cada parámetro:</p>

                  <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
                    {productToReduce.parametros
                      .filter(parametro => parametro.cantidad > 0)
                      .map((parametro, index) => (
                        <div key={index} className="flex items-center justify-between space-x-4 p-2 border rounded-lg">
                          <div>
                            <p className="font-medium">{parametro.nombre}</p>
                            <p className="text-sm text-gray-500">Disponible: {parametro.cantidad}</p>
                          </div>
                          <Input
                            type="number"
                            className="w-24"
                            value={parameterQuantities[parametro.nombre] || 0}
                            onChange={(e) => {
                              const value = Math.max(0, Math.min(Number(e.target.value), parametro.cantidad))
                              setParameterQuantities(prev => ({
                                ...prev,
                                [parametro.nombre]: value
                              }))
                            }}
                            min={0}
                            max={parametro.cantidad}
                          />
                        </div>
                      ))}
                  </div>

                  <div className="text-sm text-gray-500">
                    Total a reducir: {Object.values(parameterQuantities).reduce((a, b) => a + b, 0)}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">Especifique la cantidad a reducir:</p>
                  <div className="flex items-center space-x-4">
                    <Input
                      type="number"
                      value={quantityToReduce}
                      onChange={(e) => setQuantityToReduce(Math.max(0, Math.min(Number(e.target.value), productToReduce?.cantidad || 0)))}
                      max={productToReduce?.cantidad}
                      min={0}
                    />
                    <span className="text-sm text-gray-500">
                      Disponible: {productToReduce?.cantidad}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setReduceDialogOpen(false)
                setParameterQuantities({})
                setQuantityToReduce(0)
              }}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (productToReduce?.tiene_parametros && productToReduce.parametros && productToReduce.parametros.length > 0) {
                  const totalQuantity = Object.values(parameterQuantities).reduce((a, b) => a + b, 0)
                  if (totalQuantity > 0) {
                    setQuantityToReduce(totalQuantity)
                    setShowDestinationDialog(true)
                    setReduceDialogOpen(false)
                  }
                } else if (quantityToReduce > 0) {
                  setShowDestinationDialog(true)
                  setReduceDialogOpen(false)
                }
              }}
              disabled={
                isLoading ||
                (productToReduce?.tiene_parametros && productToReduce.parametros && productToReduce.parametros.length > 0
                  ? Object.values(parameterQuantities).reduce((a, b) => a + b, 0) <= 0
                  : quantityToReduce <= 0)
              }
            >
              Siguiente
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo para seleccionar destino (Almacén o Merma) */}
      <Dialog open={showDestinationDialog} onOpenChange={setShowDestinationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar a:</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-4"> {/* Cambiar de grid-cols-2 a grid-cols-3 */}
            <Button
              variant={selectedDestination === 'almacen' ? 'default' : 'outline'}
              onClick={() => setSelectedDestination('almacen')}
            >
              Almacén
            </Button>
            <Button
              variant={selectedDestination === 'cocina' ? 'default' : 'outline'}
              onClick={() => setSelectedDestination('cocina')}
            >
              Cocina
            </Button>
            <Button
              variant={selectedDestination === 'merma' ? 'default' : 'outline'}
              onClick={() => setSelectedDestination('merma')}
            >
              Merma
            </Button>
          </div>
          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowDestinationDialog(false)
                setSelectedDestination(null)
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!productToReduce || !selectedDestination) return;

                setIsLoading(true);
                try {
                  // Preparar los parámetros
                  const parametrosReduccion = productToReduce.tiene_parametros && productToReduce.parametros
                    ? Object.entries(parameterQuantities)
                      .filter(([_, cantidad]) => cantidad > 0)
                      .map(([nombre, cantidad]) => ({
                        nombre,
                        cantidad
                      }))
                    : undefined;

                  if (selectedDestination === 'merma') {
                    // Enviar a merma
                    await handleProductMerma(
                      productToReduce.id,
                      'cafeteria', // ← CAMBIAR de '' a 'cafeteria'
                      productToReduce.tiene_parametros ? 0 : quantityToReduce,
                      parametrosReduccion
                    );
                  } else if (selectedDestination === 'almacen') {

                  }



                  setShowDestinationDialog(false);
                  setSelectedDestination(null);
                  setProductToReduce(null);
                  setQuantityToReduce(0);
                  setParameterQuantities({});

                  toast({
                    title: "Éxito",
                    description: `Producto ${selectedDestination === 'merma'
                      ? 'enviado a merma'
                      : selectedDestination === 'cocina'
                        ? 'enviado a cocina'
                        : 'devuelto al almacén'
                      } correctamente.`,
                  });
                } catch (error) {
                  console.error('Error al procesar la operación:', error);
                  toast({
                    title: "Error",
                    description: `No se pudo ${selectedDestination === 'merma'
                      ? 'enviar a merma'
                      : selectedDestination === 'cocina'
                        ? 'enviar a cocina'
                        : 'devolver al almacén'
                      } el producto.`,
                    variant: "destructive",
                  });
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={
                isLoading ||
                !selectedDestination ||
                (productToReduce?.tiene_parametros
                  ? !Object.values(parameterQuantities).some(qty => qty > 0)
                  : quantityToReduce <= 0)
              }
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                'Confirmar'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>


      {/* Modal de ventas simplificado */}
      <Dialog open={showVentasModal} onOpenChange={setShowVentasModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Ventas de {vendedorVentasSeleccionado?.nombre}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {ventasVendedorSimple.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-lg font-medium">No hay ventas registradas</p>
                <p className="text-sm">Este vendedor aún no tiene ventas registradas</p>
              </div>
            ) : (
              <>
                {/* Total general */}
                <div className="p-4 border rounded-lg bg-gray-50">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total de ventas:</span>
                    <span className="font-bold text-lg">
                      ${ventasVendedorSimple.reduce((sum, venta) => sum + Number(venta.total), 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Ventas agrupadas por día */}
                <div className="space-y-2">
                  {Object.entries(
                    ventasVendedorSimple.reduce((acc, venta) => {
                      const fecha = new Date(venta.fecha).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit'
                      });

                      if (!acc[fecha]) {
                        acc[fecha] = [];
                      }
                      acc[fecha].push(venta);
                      return acc;
                    }, {} as Record<string, typeof ventasVendedorSimple>)
                  )
                    .sort(([a], [b]) => {
                      const fechaA = new Date(ventasVendedorSimple.find(v =>
                        new Date(v.fecha).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit'
                        }) === a
                      )?.fecha || '');
                      const fechaB = new Date(ventasVendedorSimple.find(v =>
                        new Date(v.fecha).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit'
                        }) === b
                      )?.fecha || '');
                      return fechaB.getTime() - fechaA.getTime();
                    })
                    .map(([fecha, ventasDelDia]) => {
                      const totalDia = ventasDelDia.reduce((sum, venta) => sum + Number(venta.total), 0);
                      const isExpanded = expandedVentasDays.has(fecha);

                      return (
                        <div key={fecha} className="border rounded-lg">
                          <div
                            className="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => toggleVentasDay(fecha)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-gray-400">
                                  {isExpanded ? '▼' : '▶'}
                                </span>
                                <span className="font-medium">{fecha}</span>
                              </div>
                              <span className="font-semibold">
                                ${totalDia.toFixed(2)}
                              </span>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="border-t bg-gray-50">
                              <div className="p-3 space-y-2">
                                {ventasDelDia.map((venta) => {
                                  const isProductExpanded = expandedVentasProducts.has(venta.id);
                                  const tieneParametros = venta.parametros && venta.parametros.length > 0;

                                  // Buscar el nombre del producto en el inventario
                                  const producto = inventario.find(p => p.id === venta.producto);
                                  const nombreProducto = producto ? producto.nombre : venta.producto;

                                  return (
                                    <div key={venta.id} className="bg-white rounded border">
                                      <div
                                        className={`p-3 ${tieneParametros ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                                        onClick={() => tieneParametros && toggleVentasProduct(venta.id)}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            {tieneParametros && (
                                              <span className="text-gray-400 text-sm">
                                                {isProductExpanded ? '▼' : '▶'}
                                              </span>
                                            )}
                                            <div>
                                              <p className="font-medium">{nombreProducto}</p>
                                              <div className="text-sm text-gray-600">
                                                <span>Cantidad: {venta.cantidad}</span>
                                                <span className="ml-3">
                                                  {new Date(venta.fecha).toLocaleTimeString('es-ES', {
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                  })}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <p className="font-semibold">
                                              ${Number(venta.total).toFixed(2)}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                              ${(Number(venta.total) / venta.cantidad).toFixed(2)} c/u
                                            </p>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Parámetros desplegables */}
                                      {tieneParametros && isProductExpanded && (
                                        <div className="border-t bg-gray-50 p-3">
                                          <p className="text-sm font-medium text-gray-700 mb-2">Parámetros vendidos:</p>
                                          <div className="space-y-1">
                                            {venta.parametros?.map((parametro, paramIndex) => (
                                              <div key={paramIndex} className="flex justify-between text-sm">
                                                <span className="text-gray-600">{parametro.nombre}:</span>
                                                <span className="font-medium">{parametro.cantidad}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}

                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>


    </div>
  )
} 