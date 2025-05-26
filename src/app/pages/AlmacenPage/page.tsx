'use client'

import { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx';
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { startOfWeek, endOfWeek, format, parseISO, isValid } from 'date-fns';
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Checkbox } from "@/components/ui/checkbox"
import { Menu, ArrowUpDown, Plus, Truck, UserPlus, FileSpreadsheet, Trash2, X, Minus, Loader2, MoreVertical, Eye, Edit, DollarSign, Search } from "lucide-react"
import {
  getVendedores,
  getCurrentUser,
  getInventario,
  registerUser,
  getProductosCompartidos,
  getProductosCafeteria,
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
  getVendedorTransacciones
} from '../../services/api'
import ProductDialog from '@/components/ProductDialog'
import VendorDialog from '@/components/VendedorDialog'
import SalesSection from '@/components/SalesSection'
import { ImageUpload } from '@/components/ImageUpload'
import { Producto, Vendedor, Venta, Transaccion, Merma, Parametro } from '@/types'
import { toast } from "@/hooks/use-toast";
import { useVendorProducts } from '@/hooks/use-vendor-products';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import VentasCafeteriaList from '@/components/VentasCafeteriaList'
import TransaccionesList from '@/components/TransaccionesList'
import BalanceSection from '@/components/BalanceSection'
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
  porcentajeGanancia: number; // Añadir esta línea
  parametros: Array<{
    nombre: string;
    cantidad: number;
  }>;
}


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
  const [modeVendedor, setModeVendedor] = useState<'view' | 'edit' | 'ventas'>('view')
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
    porcentajeGanancia: 0, // Añadir esta línea
    parametros: []
  });

  const [searchTerm, setSearchTerm] = useState("")
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('productos')
  const [showMassDeliveryDialog, setShowMassDeliveryDialog] = useState(false)
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
  const [activeCafeteriaTab, setActiveCafeteriaTab] = useState<'productos' | 'transacciones' | 'ventas'>('productos');
  const [reduceDialogOpen, setReduceDialogOpen] = useState(false)
  const [productToReduce, setProductToReduce] = useState<Producto | null>(null)
  const [quantityToReduce, setQuantityToReduce] = useState(0)
  const [parameterQuantities, setParameterQuantities] = useState<Record<string, number>>({})
  const [showDestinationDialog, setShowDestinationDialog] = useState(false)
  const [selectedDestination, setSelectedDestination] = useState<'almacen' | 'merma' | null>(null)
  const [cafeteriaFilterOption, setCafeteriaFilterOption] = useState<'todos' | 'pocos' | 'sin-existencias'>('todos')
  const [cafeteriaProductos, setCafeteriaProductos] = useState<Producto[]>([])
  const [cafeteriaSortBy, setCafeteriaSortBy] = useState<'nombre' | 'precio' | 'cantidadCaf' | 'cantidadAlm'>('nombre')
  const [cafeteriaSortOrder, setCafeteriaSortOrder] = useState<'asc' | 'desc'>('asc')
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

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

  const getFilteredCafeteriaProducts = (productos: Producto[]): Producto[] => {
    // Filtrar primero por término de búsqueda
    const filteredBySearch = productos.filter((producto) =>
      producto.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Calcular la cantidad total para cada producto
    const calcularCantidadTotal = (producto: Producto): number => {
      if (producto.tiene_parametros && producto.parametros) {
        // Filtrar parámetros válidos (no numéricos y cantidad > 0)
        const parametrosValidos = producto.parametros.filter(param =>
          isNaN(Number(param.nombre)) && // Excluir nombres que son solo números
          param.nombre.trim() !== '' // Excluir nombres vacíos
        );

        return parametrosValidos.reduce((total, param) => total + (param.cantidad || 0), 0);
      }
      return producto.cantidad || 0;
    };

    // Luego aplicar el filtro seleccionado
    switch (cafeteriaFilterOption) {
      case 'pocos':
        return filteredBySearch.filter(producto => {
          const cantidad = calcularCantidadTotal(producto);
          return cantidad >= 0 && cantidad < 5; // Incluir productos con cantidad 0
        });
      case 'sin-existencias':
        return filteredBySearch.filter(producto => {
          const cantidad = calcularCantidadTotal(producto);
          return cantidad === 0;
        });
      default: // 'todos'
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
      console.log('Fetching mermas...');
      const data = await getMermas();
      console.log('Mermas received:', data);
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
      // Solo llamar a createMerma, que manejará internamente la reducción
      await createMerma(productId, vendorId, cantidad, parametros);

      // Actualizar los estados después de la operación
      if (vendedorSeleccionado) {
        const updatedProducts = await getProductosCompartidos();
        setProductosVendedor(updatedProducts);
      }

      // Si estamos en la sección de cafetería, actualizar específicamente esos productos
      if (activeSection === 'cafeteria') {
        const updatedCafeteriaProducts = await getProductosCafeteria();
        setCafeteriaProductos(updatedCafeteriaProducts);
      }

      await fetchInventario();
      await fetchMermas();

      toast({
        title: "Éxito",
        description: "Merma registrada correctamente",
      });
    } catch (error) {
      console.error('Error al registrar merma:', error);
      toast({
        title: "Error",
        description: "Error al registrar la merma",
        variant: "destructive",
      });
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

  const handleProductDelivery = async (
    productId: string,
    cantidad: number,
    parametros?: Array<{ nombre: string; cantidad: number }>
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

      await entregarProducto(productId, cantidad, parametros);

      toast({
        title: "Éxito",
        description: "Producto entregado correctamente",
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
            parametrosArray
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

  // Función para calcular ventas diarias
  const calcularVentasDiarias = (ventas: Venta[]) => {
    const ventasPorDia = ventas.reduce((acc: Record<string, Venta[]>, venta) => {
      const fecha = parseISO(venta.fecha);
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

  // Función para calcular ventas semanales
  const calcularVentasSemanales = (ventas: Venta[]) => {
    const ventasPorSemana = ventas.reduce((acc: Record<string, VentaSemana>, venta) => {
      const fecha = parseISO(venta.fecha);
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

      // Primero establecemos el modo y el vendedor seleccionado para mostrar algo al usuario
      setModeVendedor(initialMode);
      setVendedorSeleccionado(vendedor);

      // Usamos Promise.allSettled para que si alguna falla, las otras continúen
      const [productosResult, ventasResult, transaccionesResult] = await Promise.allSettled([
        getVendedorProductos(vendedor.id),
        getVendedorVentas(vendedor.id),
        getVendedorTransacciones(vendedor.id)
      ]);

      // Procesamos los resultados individualmente
      if (productosResult.status === 'fulfilled') {
        // Mapeamos los productos a la estructura esperada
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
        setProductosVendedor([]); // Array vacío si hay error
      }

      if (ventasResult.status === 'fulfilled') {
        const ventas = ventasResult.value;
        setVentasVendedor(ventas);
        calcularVentasDiarias(ventas);
        calcularVentasSemanales(ventas);
      } else {
        console.error('Error al obtener ventas:', ventasResult.reason);
        setVentasVendedor([]);
        setVentasDiarias([]);
        setVentasSemanales([]);
      }

      if (transaccionesResult.status === 'fulfilled') {
        setTransaccionesVendedor(transaccionesResult.value);
      } else {
        console.error('Error al obtener transacciones:', transaccionesResult.reason);
        setTransaccionesVendedor([]); // Array vacío si hay error
      }
    } catch (error) {
      console.error('Error al cargar datos del vendedor:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar algunos datos del vendedor. La información puede estar incompleta.",
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
      formData.append('porcentajeGanancia', newProduct.porcentajeGanancia.toString()); // Añadir esta línea

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
        porcentajeGanancia: 0, // Añadir esta línea
        cantidad: 0,
        foto: '',
        tieneParametros: false,
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
      // Si hay parámetros, enviarlos en la reducción
      await reducirProductoInventario(productId, cantidad, parametros);

      if (vendedorSeleccionado) {
        const updatedProducts = await getProductosCompartidos();
        setProductosVendedor(updatedProducts);
        const updatedTransactions = await getTransaccionesVendedor();
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
      // Añadir el porcentaje de ganancia al FormData
      formData.append('porcentajeGanancia', (editedProduct.porcentajeGanancia || 0).toString());

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
  useEffect(() => {
    const loadCafeteriaData = async () => {
      if (activeSection === 'cafeteria') {
        try {
          // Cambiar getProductosCompartidos por getProductosCafeteria
          const productos = await getProductosCafeteria();

          // Debug para ver qué estamos recibiendo
          console.log('Debug - Productos recibidos de getProductosCafeteria:', productos);

          if (productos && productos.length > 0) {
            setProductosVendedor(productos);
            setCafeteriaProductos(productos);
          } else {
            // Si no hay productos, establecer arrays vacíos
            setProductosVendedor([]);
            setCafeteriaProductos([]);
            toast({
              title: "Información",
              description: "No hay productos disponibles en la cafetería.",
              variant: "default",
            });
          }

          // Cargar transacciones
          const transacciones = await getTransaccionesVendedor();
          setTransaccionesVendedor(transacciones);

          // Actualizar también el inventario general
          await fetchInventario();
        } catch (error) {
          console.error('Error al cargar datos de cafetería:', error);
          toast({
            title: "Error",
            description: "No se pudieron cargar los datos de la cafetería",
            variant: "destructive",
          });
        }
      }
    };

    loadCafeteriaData();
  }, [activeSection]);

  // Corregir la función handleReduceCafeteriaProduct para que coincida con la firma correcta
  const handleReduceCafeteriaProduct = async (
    productId: string,
    cantidad: number,
    parametros?: Array<{ nombre: string; cantidad: number }>
  ) => {
    try {
      // La función reducirProductoInventario ahora espera solo 3 parámetros
      await reducirProductoInventario(productId, cantidad, parametros);

      // Actualizar los datos después de la operación
      const updatedProducts = await getProductosCafeteria();
      setProductosVendedor(updatedProducts);
      setCafeteriaProductos(updatedProducts);

      // Actualizar las transacciones
      const transacciones = await getTransaccionesVendedor();
      setTransaccionesVendedor(transacciones);

      // Actualizar el inventario general
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
      throw error; // Re-lanzar el error para que pueda ser capturado por el manejador superior
    }
  };

  const handleCafeteriaSort = (key: 'nombre' | 'precio' | 'cantidadCaf' | 'cantidadAlm') => {
    if (cafeteriaSortBy === key) {
      setCafeteriaSortOrder(cafeteriaSortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setCafeteriaSortBy(key)
      setCafeteriaSortOrder('asc')
    }
  }

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

  // Efecto para cargar los datos del vendedor cuando cambia
  useEffect(() => {
    if (!vendedorSeleccionado) return;

    setIsLoading(true);

    // Limpiar datos anteriores
    setProductosVendedor([]);
    setVentasVendedor([]);
    setTransaccionesVendedor([]);
    setVentasDiarias([]);
    setVentasSemanales([]);

    const loadData = async () => {
      try {
        if (modeVendedor === 'edit') {
          // Para editar solo necesitamos los productos
          const productos = await getVendedorProductos(vendedorSeleccionado.id);
          setProductosVendedor(productos.map(p => ({
            ...p,
            tiene_parametros: p.tiene_parametros || p.tieneParametros || false,
            tieneParametros: p.tiene_parametros || p.tieneParametros || false,
            foto: p.foto || ''
          })) as any);
        } else if (modeVendedor === 'ventas') {
          // Para ventas necesitamos las ventas y cálculos relacionados
          const ventas = await getVendedorVentas(vendedorSeleccionado.id);
          setVentasVendedor(ventas);
          calcularVentasDiarias(ventas);
          calcularVentasSemanales(ventas);
        }
      } catch (error) {
        console.error('Error al cargar datos del vendedor:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar algunos datos. La información podría estar incompleta.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [vendedorSeleccionado, modeVendedor]);

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
                className={activeSection === 'cafeteria' ? 'bg-orange-100 text-orange-800' : 'text-orange-700 hover:bg-orange-50 hover:text-orange-800'}
                onClick={() => {
                  setActiveSection('cafeteria')
                  setIsMenuOpen(false)

                  if (!cafeteriaProductos.length) {
                    toast({
                      title: "Aviso",
                      description: "No se encontró un vendedor con el nombre 'Cafetería'. Por favor, créelo primero.",
                      variant: "default",
                    });
                  }
                }}
              >
                Cafetería
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
                className={activeSection === 'balance' ? 'bg-orange-100 text-orange-800' : 'text-orange-700 hover:bg-orange-50 hover:text-orange-800'}
                onClick={() => {
                  setActiveSection('balance')
                  setIsMenuOpen(false)
                }}
              >
                Balance
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
              <div className="flex justify-between items-center">
                <CardTitle className="text-orange-800">Productos en Almacén</CardTitle>
                <div className="flex space-x-2">
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setVendedorSeleccionado(vendedor);
                            setModeVendedor('edit');
                          }}
                        >
                          <Edit className="h-4 w-4" />
                          <span className="ml-1">Editar</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setVendedorSeleccionado(vendedor);
                            setModeVendedor('ventas');
                          }}
                        >
                          <DollarSign className="h-4 w-4" />
                          <span className="ml-1">Ventas</span>
                        </Button>
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

      {activeSection === 'cafeteria' && (
        <div>
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Productos en Cafetería</CardTitle>
                <div className="flex space-x-2">
                  <Button
                    variant={activeCafeteriaTab === 'productos' ? "default" : "outline"}
                    onClick={() => setActiveCafeteriaTab('productos')}
                    size="sm"
                  >
                    Productos
                  </Button>
                  <Button
                    variant={activeCafeteriaTab === 'transacciones' ? "default" : "outline"}
                    onClick={() => setActiveCafeteriaTab('transacciones')}
                    size="sm"
                  >
                    Transacciones
                  </Button>
                  <Button
                    variant={activeCafeteriaTab === 'ventas' ? "default" : "outline"}
                    onClick={() => setActiveCafeteriaTab('ventas')}
                    size="sm"
                  >
                    Ventas
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {activeCafeteriaTab === 'productos' ? (
                <div>
                  {/* Barra de búsqueda para productos */}
                  <div className="mb-4 flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-2 items-start">
                    <Input
                      placeholder="Buscar productos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="flex-grow"
                    />
                    <Select
                      value={cafeteriaFilterOption}
                      onValueChange={(value) => setCafeteriaFilterOption(value as 'todos' | 'pocos' | 'sin-existencias')}
                    >
                      <SelectTrigger className="w-full md:w-auto min-w-[200px]">
                        <SelectValue placeholder="Filtrar productos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos los productos</SelectItem>
                        <SelectItem value="pocos">Menos de 5 unidades</SelectItem>
                        <SelectItem value="sin-existencias">Sin existencias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Tabla de productos en cafetería */}
                  <div className="overflow-x-auto">
                    <table className="w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Foto
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <button
                              onClick={() => handleCafeteriaSort('nombre')}
                              className="flex items-center space-x-1 focus:outline-none"
                            >
                              <span>Nombre</span>
                              <ArrowUpDown className="h-3 w-3" />
                            </button>
                          </th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <button
                              onClick={() => handleCafeteriaSort('precio')}
                              className="flex items-center justify-end space-x-1 focus:outline-none ml-auto"
                            >
                              <span>Precio</span>
                              <ArrowUpDown className="h-3 w-3" />
                            </button>
                          </th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <button
                              onClick={() => handleCafeteriaSort('cantidadCaf')}
                              className="flex items-center justify-end space-x-1 focus:outline-none ml-auto"
                            >
                              <span>Cant. Caf</span>
                              <ArrowUpDown className="h-3 w-3" />
                            </button>
                          </th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <button
                              onClick={() => handleCafeteriaSort('cantidadAlm')}
                              className="flex items-center justify-end space-x-1 focus:outline-none ml-auto"
                            >
                              <span>Cant. Alm</span>
                              <ArrowUpDown className="h-3 w-3" />
                            </button>
                          </th>
                          <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Acción
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {getFilteredCafeteriaProducts(productosVendedor)
                          .sort((a, b) => {
                            // Calcular la cantidad en cafetería de los productos
                            const cantidadCafeteriaA = a.tiene_parametros && a.parametros
                              ? a.parametros.filter(p => isNaN(Number(p.nombre)) && p.nombre.trim() !== '')
                                .reduce((sum, param) => sum + param.cantidad, 0)
                              : a.cantidad;

                            const cantidadCafeteriaB = b.tiene_parametros && b.parametros
                              ? b.parametros.filter(p => isNaN(Number(p.nombre)) && p.nombre.trim() !== '')
                                .reduce((sum, param) => sum + param.cantidad, 0)
                              : b.cantidad;

                            // Buscar el producto correspondiente en el almacén
                            const productoAlmacenA = inventario.find(p => p.id === a.id);
                            const productoAlmacenB = inventario.find(p => p.id === b.id);

                            // Calcular la cantidad en almacén
                            const cantidadAlmacenA = productoAlmacenA
                              ? (productoAlmacenA.tiene_parametros && productoAlmacenA.parametros
                                ? productoAlmacenA.parametros.filter(p => isNaN(Number(p.nombre)) && p.nombre.trim() !== '')
                                  .reduce((sum, param) => sum + param.cantidad, 0)
                                : productoAlmacenA.cantidad)
                              : 0;

                            const cantidadAlmacenB = productoAlmacenB
                              ? (productoAlmacenB.tiene_parametros && productoAlmacenB.parametros
                                ? productoAlmacenB.parametros.filter(p => isNaN(Number(p.nombre)) && p.nombre.trim() !== '')
                                  .reduce((sum, param) => sum + param.cantidad, 0)
                                : productoAlmacenB.cantidad)
                              : 0;

                            // Ordenar según el campo seleccionado
                            switch (cafeteriaSortBy) {
                              case 'nombre':
                                return cafeteriaSortOrder === 'asc'
                                  ? a.nombre.localeCompare(b.nombre)
                                  : b.nombre.localeCompare(a.nombre);
                              case 'precio':
                                return cafeteriaSortOrder === 'asc'
                                  ? Number(a.precio) - Number(b.precio)
                                  : Number(b.precio) - Number(a.precio);
                              case 'cantidadCaf':
                                return cafeteriaSortOrder === 'asc'
                                  ? cantidadCafeteriaA - cantidadCafeteriaB
                                  : cantidadCafeteriaB - cantidadCafeteriaA;
                              case 'cantidadAlm':
                                return cafeteriaSortOrder === 'asc'
                                  ? cantidadAlmacenA - cantidadAlmacenB
                                  : cantidadAlmacenB - cantidadAlmacenA;
                              default:
                                return 0;
                            }
                          })
                          .map((producto) => {
                            // Encontrar el producto correspondiente en el almacén
                            const productoAlmacen = inventario.find(p => p.id === producto.id);

                            // Calcular la cantidad total en el almacén
                            const cantidadAlmacen = productoAlmacen
                              ? (productoAlmacen.tiene_parametros && productoAlmacen.parametros
                                ? productoAlmacen.parametros.filter(p => isNaN(Number(p.nombre)) && p.nombre.trim() !== '')
                                  .reduce((sum, param) => sum + param.cantidad, 0)
                                : productoAlmacen.cantidad)
                              : 0;

                            // Calcular la cantidad total en cafetería
                            const cantidadCafeteria = producto.tiene_parametros && producto.parametros
                              ? producto.parametros.filter(p => isNaN(Number(p.nombre)) && p.nombre.trim() !== '')
                                .reduce((sum, param) => sum + param.cantidad, 0)
                              : producto.cantidad;

                            // Determinar si es cantidad cero para aplicar el estilo rojo
                            const cantidadCero = cantidadCafeteria === 0;

                            return (
                              <React.Fragment key={producto.id}>
                                <tr
                                  className={`hover:bg-gray-50 ${cantidadCero ? 'bg-red-50' : ''} ${producto.tiene_parametros ? 'cursor-pointer' : ''}`}
                                  onClick={() => {
                                    if (producto.tiene_parametros && producto.parametros && producto.parametros.length > 0) {
                                      toggleProductExpansion(producto.id);
                                    }
                                  }}
                                >
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="w-10 h-10 relative">
                                      <Image
                                        src={producto.foto || '/placeholder.svg'}
                                        alt={producto.nombre}
                                        fill
                                        className="rounded-md object-cover"
                                        onError={(e) => {
                                          // Fallback a imagen por defecto
                                          (e.target as HTMLImageElement).src = '/placeholder.svg';
                                        }}
                                      />
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className={`text-sm font-medium ${cantidadCero ? 'text-red-600' : 'text-gray-900'}`}>{producto.nombre}</div>
                                    {producto.tiene_parametros && producto.parametros && producto.parametros.length > 0 && (
                                      <div className="text-xs text-blue-500 hover:underline">
                                        {expandedProducts.has(producto.id) ? 'Ocultar parámetros' : 'Ver parámetros'} ({producto.parametros.length})
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right">
                                    <div className={`text-sm ${cantidadCero ? 'text-red-600' : 'text-gray-900'}`}>${Number(producto.precio).toFixed(2)}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right">
                                    <div className={`text-sm ${cantidadCero ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>
                                      {cantidadCafeteria}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right">
                                    <div className={`text-sm ${cantidadCero ? 'text-red-600' : 'text-gray-900'}`}>{cantidadAlmacen}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation(); // Evitar que se expanda al hacer clic en el botón
                                        setProductToReduce(producto);
                                        setReduceDialogOpen(true);
                                      }}
                                      disabled={cantidadCero}
                                    >
                                      <Minus className="h-4 w-4" />
                                    </Button>
                                  </td>
                                </tr>
                                {expandedProducts.has(producto.id) && producto.tiene_parametros && producto.parametros && (
                                  <tr className="bg-gray-50">
                                    <td colSpan={6} className="px-6 py-3">
                                      <div className="ml-12 space-y-2 text-sm">
                                        {producto.parametros
                                          .filter(p => isNaN(Number(p.nombre)) && p.nombre.trim() !== '')
                                          .map((parametro, idx) => (
                                            <div key={idx} className="bg-white p-2 rounded border">
                                              <div className="font-medium">{parametro.nombre}</div>
                                              <div className={`${parametro.cantidad === 0 ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>
                                                Cantidad: {parametro.cantidad}
                                              </div>
                                            </div>
                                          ))}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        {getFilteredCafeteriaProducts(productosVendedor).length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                              No se encontraron productos que coincidan con el filtro seleccionado
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : activeCafeteriaTab === 'ventas' ? (
                <div className="space-y-4">
                  <div className="mb-4">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <Input
                        placeholder="Buscar por producto o vendedor..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <VentasCafeteriaList searchTerm={searchTerm} />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="mb-4">
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
                      transacciones={transaccionesVendedor}
                      searchTerm={searchTerm}
                      vendedorId=""
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeSection === 'balance' && (
        <BalanceSection />
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
            <div className="sticky bottom-0 pt-2 bg-white">
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
          onDeliver={(productId, cantidadTotal, parametros) => handleProductDelivery(productId, cantidadTotal, parametros)}
        />
      )}

      {vendedorSeleccionado && (
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
          onProductReduce={(productId, vendorId, cantidad, parametros) => handleReduceVendorProduct(productId, cantidad, parametros)}
          onDeleteSale={deleteSale}
          onProductMerma={handleProductMerma}
          vendedores={vendedores}
          onDeleteVendorData={handleDeleteVendorData}
          onUpdateProductQuantity={handleUpdateProductQuantity}
          initialMode={modeVendedor}
          onProductTransfer={async (productId, fromVendorId, toVendorId, cantidad, parametros) => {
            // Implementación temporal para evitar el error
            console.log('Transferencia de producto no implementada', {
              productId, fromVendorId, toVendorId, cantidad, parametros
            });
            toast({
              title: "Aviso",
              description: "La transferencia de productos entre vendedores no está disponible actualmente",
              variant: "default",
            });
            return Promise.resolve();
          }}
        />
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
                if (productToReduce?.parametros && productToReduce.parametros.length > 0) {
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
                (productToReduce?.parametros
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
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant={selectedDestination === 'almacen' ? 'default' : 'outline'}
              onClick={() => setSelectedDestination('almacen')}
            >
              Almacén
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
                    // Enviar a merma usando una cadena vacía como el ID de vendedor
                    await handleProductMerma(
                      productToReduce.id,
                      '',  // No usar cafeteriaVendorId, sino simplemente enviar una cadena vacía
                      productToReduce.tiene_parametros ? 0 : quantityToReduce,
                      parametrosReduccion
                    );

                    // Actualizar inmediatamente la interfaz para cafetería
                    if (activeSection === 'cafeteria') {
                      const updatedProducts = await getProductosCafeteria();
                      setCafeteriaProductos(updatedProducts);
                      setProductosVendedor(updatedProducts);
                    }
                  } else if (selectedDestination === 'almacen') {
                    // Devolver al almacén usando la función específica para cafetería
                    await handleReduceCafeteriaProduct(
                      productToReduce.id,
                      productToReduce.tiene_parametros ? 0 : quantityToReduce,
                      parametrosReduccion
                    );
                  }

                  setShowDestinationDialog(false);
                  setSelectedDestination(null);
                  setProductToReduce(null);
                  setQuantityToReduce(0);
                  setParameterQuantities({});

                  toast({
                    title: "Éxito",
                    description: `Producto ${selectedDestination === 'merma' ? 'enviado a merma' : 'reducido'} correctamente.`,
                  });
                } catch (error) {
                  console.error('Error al procesar la operación:', error);
                  toast({
                    title: "Error",
                    description: `No se pudo ${selectedDestination === 'merma' ? 'enviar a merma' : 'reducir'} el producto.`,
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
    </div>
  )
} 