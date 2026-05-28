'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Shield,
  Plus,
  Truck,
  ArrowLeftRight,
  ClipboardList,
  LogOut,
  Loader2,
  Box,
  TrendingUp,
  UserCheck,
  Search,
  Scan,
  DollarSign
} from 'lucide-react';
import { toast } from "@/hooks/use-toast";
import {
  getCurrentUser,
  getInventario,
  getVendedores,
  agregarProducto,
  entregarProducto,
  transferirProductoEntreVendedores,
  getTransacciones,
  logModeradorAccion,
  verificarNombreProducto
} from '../../services/api';
import { Producto, Vendedor, Transaccion } from '@/types';
import ProductDialog from '@/components/ProductDialog';
import BarcodeScanner from '@/components/BarcodeScanner';
import { ImageUpload } from '@/components/ImageUpload';

type ModeradorSection = 'crear' | 'entregar' | 'mover' | 'transacciones';

// Componente de autocompletado para secciones
const SeccionAutocomplete = React.memo(({
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
          setTimeout(() => setIsOpen(false), 200);
        }}
        placeholder={placeholder}
      />

      {isOpen && (filteredSecciones.length > 0 || value) && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
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
});

SeccionAutocomplete.displayName = 'SeccionAutocomplete';


export default function ModeradorPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [moderadorInfo, setModeradorInfo] = useState<{ id: string; nombre: string } | null>(null);
  const [activeTab, setActiveTab] = useState<ModeradorSection>('crear');
  const [loading, setLoading] = useState(true);

  // Shared Data
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [inventario, setInventario] = useState<Producto[]>([]);

  // Action states: Crear Producto
  const [newProduct, setNewProduct] = useState({
    nombre: '',
    precio: 0,
    precioCompra: 0,
    cantidad: 0,
    foto: '',
    tieneParametros: false,
    porcentajeGanancia: 0,
    seccion: '',
    parametros: [] as Array<{ nombre: string; cantidad: number }>,
    codigo_barras: ''
  });
  const [newParamName, setNewParamName] = useState('');
  const [newParamQty, setNewParamQty] = useState(0);
  const [imageUploading, setImageUploading] = useState(false);

  type MassDeliveryProductState = {
    cantidad: number;
    parametros?: { [key: string]: number };
  };

  // Action states: Entregar Producto
  const [selectedProductsDeliver, setSelectedProductsDeliver] = useState<{ [key: string]: MassDeliveryProductState }>({});
  const [selectedVendedorDeliver, setSelectedVendedorDeliver] = useState<string>('');

  // Action states: Mover entre Vendedores
  const [selectedProductMove, setSelectedProductMove] = useState<Producto | null>(null);
  const [selectedFromVendedorMove, setSelectedFromVendedorMove] = useState<string>('');
  const [selectedToVendedorMove, setSelectedToVendedorMove] = useState<string>('');
  const [cantidadMove, setCantidadMove] = useState<number>(0);
  const [paramQuantitiesMove, setParamQuantitiesMove] = useState<{ [key: string]: number }>({});
  const [inventarioOrigen, setInventarioOrigen] = useState<Producto[]>([]);
  const [loadingFromInventory, setLoadingFromInventory] = useState(false);

  // Action states: Ver Transacciones
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [loadingTransacciones, setLoadingTransacciones] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Search inputs
  const [searchTermDeliver, setSearchTermDeliver] = useState('');
  const [searchTermMove, setSearchTermMove] = useState('');

  // Verifications
  const [nombreExiste, setNombreExiste] = useState(false);
  const [verificandoNombre, setVerificandoNombre] = useState(false);
  const [barcodeExiste, setBarcodeExiste] = useState(false);
  const [verificandoBarcode, setVerificandoBarcode] = useState(false);
  const [seccionesExistentes, setSeccionesExistentes] = useState<string[]>([]);

  // Scanner
  const [showScanner, setShowScanner] = useState(false);
  const [scannerFor, setScannerFor] = useState<'crear' | 'entregar' | 'mover'>('crear');

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (newProduct.nombre.trim()) {
        setVerificandoNombre(true);
        try {
          const existe = await verificarNombreProducto(newProduct.nombre);
          setNombreExiste(existe);
        } catch (error) {
          console.error(error);
        } finally {
          setVerificandoNombre(false);
        }
      } else {
        setNombreExiste(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [newProduct.nombre]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (newProduct.codigo_barras.trim()) {
        setVerificandoBarcode(true);
        try {
          const res = await fetch(`/api/productos/verificar-barcode?barcode=${newProduct.codigo_barras}`);
          const data = await res.json();
          setBarcodeExiste(data.exists);
        } catch (error) {
          console.error(error);
        } finally {
          setVerificandoBarcode(false);
        }
      } else {
        setBarcodeExiste(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [newProduct.codigo_barras]);

  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);
      const user = await getCurrentUser();
      if (user?.rol === 'Moderador') {
        setIsAuthenticated(true);
        setModeradorInfo({ id: user.id, nombre: user.nombre });
        
        // Fetch static resources
        const [vends, inv] = await Promise.all([getVendedores(), getInventario()]);
        setVendedores(vends);
        setInventario(inv);
        const secciones = Array.from(new Set(inv.map((p: Producto) => p.seccion).filter(Boolean)));
        setSeccionesExistentes(secciones as string[]);
      } else {
        toast({ title: "Acceso denegado", description: "No tienes permisos de moderador", variant: "destructive" });
        router.push('/pages/LoginPage');
      }
    } catch (error) {
      console.error('Auth error:', error);
      router.push('/pages/LoginPage');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Log action helper
  const logAccion = async (accion: string, detalles: string) => {
    if (moderadorInfo) {
      await logModeradorAccion(moderadorInfo.id, accion, detalles);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/pages/LoginPage');
  };

  const refreshData = async () => {
    try {
      const [inv, vends] = await Promise.all([getInventario(), getVendedores()]);
      setInventario(inv);
      setVendedores(vends);
      const secciones = Array.from(new Set(inv.map((p: Producto) => p.seccion).filter(Boolean)));
      setSeccionesExistentes(secciones as string[]);
    } catch (error) {
      console.error(error);
    }
  };

  // 1. CREAR PRODUCTO ACTION
  const addParamToProduct = () => {
    if (!newParamName.trim()) return;
    setNewProduct(prev => ({
      ...prev,
      parametros: [...prev.parametros, { nombre: newParamName, cantidad: newParamQty }]
    }));
    setNewParamName('');
    setNewParamQty(0);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.nombre.trim() || nombreExiste || barcodeExiste) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('nombre', newProduct.nombre);
      formData.append('precio', String(newProduct.precio));
      formData.append('precioCompra', String(newProduct.precioCompra));
      formData.append('cantidad', String(newProduct.tieneParametros ? 0 : newProduct.cantidad));
      formData.append('foto', newProduct.foto || '');
      formData.append('tieneParametros', String(newProduct.tieneParametros));
      formData.append('seccion', newProduct.seccion);
      formData.append('codigo_barras', newProduct.codigo_barras);
      formData.append('porcentajeGanancia', String(newProduct.porcentajeGanancia));
      
      if (newProduct.tieneParametros) {
        formData.append('parametros', JSON.stringify(newProduct.parametros));
      }

      await agregarProducto(formData);
      
      toast({ title: "Éxito", description: `Producto "${newProduct.nombre}" creado exitosamente.` });
      
      // LOG ACCION
      const detallesProducto = [
        `Nombre: "${newProduct.nombre}"`,
        `Sección: "${newProduct.seccion || 'N/A'}"`,
        `Precio Venta: $${newProduct.precio}`,
        `Precio Compra: $${newProduct.precioCompra}`,
        `Ganancia: ${newProduct.porcentajeGanancia}%`,
        `Código: ${newProduct.codigo_barras}`,
        newProduct.tieneParametros 
          ? `Parámetros: ${newProduct.parametros.map(p => `${p.nombre} (${p.cantidad})`).join(', ')}` 
          : `Cantidad Inicial: ${newProduct.cantidad}`
      ].join(' | ');

      await logAccion('crear_producto', `Creó un nuevo producto. ${detallesProducto}`);
      
      // Reset form
      setNewProduct({
        nombre: '',
        precio: 0,
        precioCompra: 0,
        cantidad: 0,
        foto: '',
        tieneParametros: false,
        porcentajeGanancia: 0,
        seccion: '',
        parametros: [],
        codigo_barras: ''
      });
      await refreshData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "No se pudo crear el producto", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // 2. ENTREGAR PRODUCTO ACTION
  const handleDeliverProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Object.keys(selectedProductsDeliver).length === 0 || !selectedVendedorDeliver) return;

    try {
      setLoading(true);
      const targetVendor = vendedores.find(v => v.id.toString() === selectedVendedorDeliver);
      
      let totalItems = 0;
      for (const [productId, productData] of Object.entries(selectedProductsDeliver)) {
        const { cantidad, parametros } = productData;
        const producto = inventario.find(p => p.id.toString() === productId.toString());
        if (!producto) continue;

        const cantidadTotal = parametros
          ? Object.values(parametros).reduce((sum, val) => sum + (Number(val) || 0), 0)
          : Number(cantidad) || 0;

        if (isNaN(cantidadTotal) || cantidadTotal <= 0) continue;

        const parametrosArray = parametros
          ? Object.entries(parametros)
            .filter(([nombre]) => nombre && nombre !== '0' && nombre !== '1')
            .map(([nombre, cantidadParam]) => ({
              nombre,
              cantidad: Number(cantidadParam) || 0
            }))
            .filter(p => p.cantidad > 0)
          : undefined;

        await entregarProducto(
          productId,
          cantidadTotal,
          parametrosArray,
          Number(selectedVendedorDeliver)
        );
        totalItems += cantidadTotal;
      }

      if (totalItems > 0) {
        toast({ title: "Entregado", description: "Productos despachados con éxito" });
        await logAccion('entregar_producto', `Entregó ${totalItems} unidades totales al punto de venta "${targetVendor?.nombre}"`);
      } else {
        toast({ title: "Advertencia", description: "Debe ingresar una cantidad mayor que cero para los productos seleccionados", variant: "default" });
      }

      // Reset
      setSelectedProductsDeliver({});
      await refreshData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "No se pudo realizar la entrega", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // 3. MOVER ENTRE VENDEDORES ACTION
  const loadSellerInventory = async (vendorId: string) => {
    if (!vendorId) return;
    try {
      setLoadingFromInventory(true);
      const res = await fetch(`/api/users/productos/${vendorId}`);
      if (res.ok) {
        const data = await res.json();
        setInventarioOrigen(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingFromInventory(false);
    }
  };

  useEffect(() => {
    if (selectedFromVendedorMove) {
      loadSellerInventory(selectedFromVendedorMove);
      setSelectedProductMove(null);
    }
  }, [selectedFromVendedorMove]);

  const handleMoveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductMove || !selectedFromVendedorMove || !selectedToVendedorMove) return;

    if (selectedFromVendedorMove === selectedToVendedorMove) {
      toast({ title: "Error", description: "El punto de origen y destino no pueden ser el mismo", variant: "destructive" });
      return;
    }

    const totalQty = selectedProductMove.tiene_parametros
      ? Object.values(paramQuantitiesMove).reduce((a, b) => a + b, 0)
      : cantidadMove;

    if (totalQty <= 0) {
      toast({ title: "Advertencia", description: "La cantidad debe ser mayor que cero", variant: "default" });
      return;
    }

    try {
      setLoading(true);
      const fromVend = vendedores.find(v => v.id.toString() === selectedFromVendedorMove);
      const toVend = vendedores.find(v => v.id.toString() === selectedToVendedorMove);

      const payloadParams = selectedProductMove.tiene_parametros && selectedProductMove.parametros
        ? selectedProductMove.parametros.map(p => ({
            nombre: p.nombre,
            cantidad: paramQuantitiesMove[p.nombre] || 0
          })).filter(p => p.cantidad > 0)
        : undefined;

      await transferirProductoEntreVendedores(
        selectedProductMove.id,
        selectedFromVendedorMove,
        selectedToVendedorMove,
        totalQty,
        payloadParams
      );

      toast({ title: "Éxito", description: "Productos transferidos con éxito" });

      // LOG ACCION
      await logAccion('mover_vendedores', `Transfirió ${totalQty} unidades de "${selectedProductMove.nombre}" desde "${fromVend?.nombre}" hacia "${toVend?.nombre}"`);

      // Reset
      setSelectedProductMove(null);
      setCantidadMove(0);
      setParamQuantitiesMove({});
      loadSellerInventory(selectedFromVendedorMove);
      await refreshData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Error al realizar la transferencia", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // 4. VER TRANSACCIONES
  const fetchTransacciones = useCallback(async () => {
    try {
      setLoadingTransacciones(true);
      const data = await getTransacciones();
      setTransacciones(data);
      
      // LOG ACCION
      await logAccion('ver_transacciones', `Consultó el historial general de transacciones del almacén`);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingTransacciones(false);
    }
  }, [moderadorInfo]);

  useEffect(() => {
    if (activeTab === 'transacciones') {
      fetchTransacciones();
    }
  }, [activeTab, fetchTransacciones]);

  // QR/Barcode Scan handle
  const handleBarcodeScanned = (barcode: string) => {
    setShowScanner(false);
    if (scannerFor === 'crear') {
      setNewProduct(prev => ({ ...prev, codigo_barras: barcode }));
      toast({ title: "Código Escaneado", description: `Código: ${barcode}` });
    } else if (scannerFor === 'entregar') {
      const found = inventario.find(p => p.codigo_barras === barcode);
      if (found) {
        setSelectedProductsDeliver(prev => ({
          ...prev,
          [found.id]: prev[found.id] || {
            cantidad: 0,
            parametros: found.tiene_parametros ? {} : undefined,
          }
        }));
        toast({ title: "Producto Añadido", description: found.nombre });
      } else {
        toast({ title: "No encontrado", description: "Código de barras no registrado en el inventario", variant: "destructive" });
      }
    } else if (scannerFor === 'mover') {
      const found = inventarioOrigen.find(p => p.codigo_barras === barcode);
      if (found) {
        setSelectedProductMove(found);
        toast({ title: "Producto Encontrado", description: found.nombre });
      } else {
        toast({ title: "No encontrado", description: "Código de barras no registrado en el punto de origen", variant: "destructive" });
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-orange-50 gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-orange-600" />
        <span className="text-orange-950 font-bold text-lg">Iniciando Panel de Moderador...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-orange-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-orange-100 py-4 px-6 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 text-orange-800 rounded-lg">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-orange-900 leading-none">Panel de Moderador</h1>
              <span className="text-xs text-orange-600 font-semibold mt-1 inline-block">
                Usuario activo: {moderadorInfo?.nombre}
              </span>
            </div>
          </div>
          
          <Button variant="ghost" onClick={handleLogout} className="text-red-600 hover:bg-red-50 gap-2 border border-transparent hover:border-red-100">
            <LogOut className="w-4 h-4" /> Cerrar Sesión
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1 space-y-3">
          <Button
            onClick={() => setActiveTab('crear')}
            variant={activeTab === 'crear' ? 'default' : 'outline'}
            className={`w-full justify-start gap-3 h-12 text-left ${activeTab === 'crear' ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-white border-orange-100 hover:bg-orange-50 text-orange-950'}`}
          >
            <Plus className="w-5 h-5" /> Crear Producto
          </Button>
          <Button
            onClick={() => setActiveTab('entregar')}
            variant={activeTab === 'entregar' ? 'default' : 'outline'}
            className={`w-full justify-start gap-3 h-12 text-left ${activeTab === 'entregar' ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-white border-orange-100 hover:bg-orange-50 text-orange-950'}`}
          >
            <Truck className="w-5 h-5" /> Entregar Producto
          </Button>
          <Button
            onClick={() => setActiveTab('mover')}
            variant={activeTab === 'mover' ? 'default' : 'outline'}
            className={`w-full justify-start gap-3 h-12 text-left ${activeTab === 'mover' ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-white border-orange-100 hover:bg-orange-50 text-orange-950'}`}
          >
            <ArrowLeftRight className="w-5 h-5" /> Mover entre Vendedores
          </Button>
          <Button
            onClick={() => setActiveTab('transacciones')}
            variant={activeTab === 'transacciones' ? 'default' : 'outline'}
            className={`w-full justify-start gap-3 h-12 text-left ${activeTab === 'transacciones' ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-white border-orange-100 hover:bg-orange-50 text-orange-950'}`}
          >
            <ClipboardList className="w-5 h-5" /> Ver Transacciones
          </Button>
        </div>

        {/* Content Section */}
        <div className="lg:col-span-3">
          
          {/* TAB 1: CREAR PRODUCTO */}
          {activeTab === 'crear' && (
            <Card className="border-orange-100 shadow-sm">
              <CardHeader className="bg-white border-b border-orange-50">
                <CardTitle className="text-xl font-bold text-orange-950 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-orange-600" /> Crear Nuevo Producto
                </CardTitle>
                <CardDescription>
                  Registra un producto en el inventario general del almacén
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleCreateProduct} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="nombre">Nombre del Producto</Label>
                      <Input
                        id="nombre"
                        value={newProduct.nombre}
                        onChange={e => setNewProduct(prev => ({ ...prev, nombre: e.target.value }))}
                        placeholder="Ej. Coca Cola 350ml"
                        required
                        className={`${nombreExiste ? 'border-red-500 ring-red-500' : ''}`}
                      />
                      {verificandoNombre && <p className="text-xs text-gray-500 mt-1">Verificando nombre...</p>}
                      {!verificandoNombre && nombreExiste && <p className="text-xs text-red-500 font-medium mt-1">Este nombre de producto ya existe</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="seccion">Sección o Categoría</Label>
                      <SeccionAutocomplete
                        value={newProduct.seccion}
                        onChange={(value) => setNewProduct(prev => ({ ...prev, seccion: value }))}
                        seccionesExistentes={seccionesExistentes}
                        placeholder="Ej. Bebidas, Golosinas"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="precio">Precio de Venta ($)</Label>
                      <Input
                        id="precio"
                        type="number"
                        step="0.01"
                        value={newProduct.precio}
                        onChange={e => setNewProduct(prev => ({ ...prev, precio: parseFloat(e.target.value) || 0 }))}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="precioCompra">Precio de Compra ($)</Label>
                      <Input
                        id="precioCompra"
                        type="number"
                        step="0.01"
                        value={newProduct.precioCompra}
                        onChange={e => setNewProduct(prev => ({ ...prev, precioCompra: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="porcentajeGanancia">% de Ganancia</Label>
                      <Input
                        id="porcentajeGanancia"
                        type="number"
                        value={newProduct.porcentajeGanancia}
                        onChange={e => setNewProduct(prev => ({ ...prev, porcentajeGanancia: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Código de Barras</Label>
                    <div className="flex gap-2">
                      <Input
                        value={newProduct.codigo_barras}
                        onChange={e => setNewProduct(prev => ({ ...prev, codigo_barras: e.target.value }))}
                        placeholder="Código de barras"
                        className={`flex-1 ${barcodeExiste ? 'border-red-500 ring-red-500' : ''}`}
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          const random = Math.floor(Math.random() * 900000000000) + 100000000000;
                          setNewProduct(prev => ({ ...prev, codigo_barras: random.toString() }));
                        }}
                      >
                        Aleatorio
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setScannerFor('crear');
                          setShowScanner(true);
                        }}
                        className="bg-orange-50 border border-orange-100 text-orange-950"
                      >
                        <Scan className="w-4 h-4 mr-2" /> Escanear
                      </Button>
                    </div>
                    {verificandoBarcode && <p className="text-xs text-gray-500 mt-1">Verificando código...</p>}
                    {barcodeExiste && <p className="text-xs text-red-500 font-medium mt-1">Este código de barras ya existe.</p>}
                  </div>

                  <div className="flex items-center space-x-2 pt-2">
                    <Checkbox
                      id="tieneParametros"
                      checked={newProduct.tieneParametros}
                      onCheckedChange={checked => setNewProduct(prev => ({ ...prev, tieneParametros: checked as boolean }))}
                    />
                    <Label htmlFor="tieneParametros" className="font-semibold text-gray-700 cursor-pointer">
                      El producto tiene parámetros (Sabores, tallas, etc.)
                    </Label>
                  </div>

                  {newProduct.tieneParametros ? (
                    <div className="p-4 bg-orange-50/50 rounded-lg border border-orange-100 space-y-4">
                      <Label className="font-bold text-orange-950">Añadir Parámetros</Label>
                      <div className="flex flex-wrap gap-3 items-end">
                        <div className="flex-1 min-w-[200px] space-y-1">
                          <Label className="text-xs">Nombre del parámetro</Label>
                          <Input
                            value={newParamName}
                            onChange={e => setNewParamName(e.target.value)}
                            placeholder="Ej. Fresa, Chocolate"
                          />
                        </div>
                        <div className="w-24 space-y-1">
                          <Label className="text-xs">Cantidad</Label>
                          <Input
                            type="number"
                            value={newParamQty}
                            onChange={e => setNewParamQty(parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <Button type="button" onClick={addParamToProduct} variant="outline" className="border-orange-200">
                          Añadir
                        </Button>
                      </div>

                      {newProduct.parametros.length > 0 && (
                        <div className="space-y-1 pt-2 border-t border-orange-100">
                          <Label className="text-xs font-semibold">Lista de Parámetros:</Label>
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            {newProduct.parametros.map((p, idx) => (
                              <div key={idx} className="bg-white px-3 py-1.5 rounded border text-sm flex justify-between">
                                <span className="font-medium">{p.nombre}</span>
                                <span className="text-gray-500 font-bold">{p.cantidad}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label htmlFor="cantidad">Cantidad Inicial en Almacén</Label>
                      <Input
                        id="cantidad"
                        type="number"
                        value={newProduct.cantidad}
                        onChange={e => setNewProduct(prev => ({ ...prev, cantidad: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label>Imagen del Producto</Label>
                    <ImageUpload
                      value={newProduct.foto}
                      onChange={url => setNewProduct(prev => ({ ...prev, foto: url }))}
                      disabled={imageUploading}
                    />
                  </div>

                  <div className="pt-4 border-t flex justify-end">
                    <Button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-6" disabled={nombreExiste || verificandoNombre || barcodeExiste || verificandoBarcode}>
                      Crear Producto
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* TAB 2: ENTREGAR PRODUCTO */}
          {activeTab === 'entregar' && (
            <Card className="border-orange-100 shadow-sm">
              <CardHeader className="bg-white border-b border-orange-50">
                <CardTitle className="text-xl font-bold text-orange-950 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-orange-600" /> Entregar Producto a Puntos de Venta
                </CardTitle>
                <CardDescription>
                  Despacha productos desde el inventario del almacén común
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleDeliverProduct} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="vendedorDeliver">Punto de Venta Destinatario</Label>
                    <Select
                      value={selectedVendedorDeliver}
                      onValueChange={setSelectedVendedorDeliver}
                      required
                    >
                      <SelectTrigger id="vendedorDeliver" className="w-full">
                        <SelectValue placeholder="Selecciona el vendedor de destino" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendedores.map(v => (
                          <SelectItem key={v.id} value={v.id.toString()}>
                            {v.nombre} ({v.telefono || 'Sin teléfono'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <Label>Seleccionar Productos a Entregar</Label>
                    <div className="flex gap-2 mb-2">
                      <Input
                        placeholder="Buscar producto por nombre o código..."
                        value={searchTermDeliver}
                        onChange={e => setSearchTermDeliver(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setScannerFor('entregar');
                          setShowScanner(true);
                        }}
                        className="bg-orange-50 border border-orange-100 text-orange-950"
                      >
                        <Scan className="w-4 h-4 mr-2" /> Escanear QR
                      </Button>
                    </div>

                    <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-2 border rounded-md p-2 bg-gray-50/50">
                      {inventario
                        .filter(p => p.nombre.toLowerCase().includes(searchTermDeliver.toLowerCase()) || p.codigo_barras?.includes(searchTermDeliver))
                        .map((producto) => (
                        <div key={producto.id} className="flex flex-col p-3 border rounded-lg bg-white">
                          <div className="flex items-start gap-3">
                            <div className="flex items-center h-5">
                              <Checkbox
                                id={`product-${producto.id}`}
                                checked={!!selectedProductsDeliver[producto.id]}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedProductsDeliver((prev) => ({
                                      ...prev,
                                      [producto.id]: {
                                        cantidad: 0,
                                        parametros: producto.tiene_parametros ? {} : undefined,
                                      },
                                    }));
                                  } else {
                                    setSelectedProductsDeliver((prev) => {
                                      const { [producto.id]: _, ...rest } = prev;
                                      return rest;
                                    });
                                  }
                                }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <label htmlFor={`product-${producto.id}`} className="font-medium text-sm block cursor-pointer">
                                {producto.nombre} {producto.seccion ? `(${producto.seccion})` : ''}
                              </label>
                              <div className="text-xs text-gray-600 mt-1 space-y-1">
                                <p>Disponible: {producto.tiene_parametros && producto.parametros ? producto.parametros.reduce((a, b) => a + b.cantidad, 0) : producto.cantidad}</p>
                              </div>
                            </div>
                          </div>

                          {selectedProductsDeliver[producto.id] && (
                            <div className="mt-3 pl-8 space-y-3">
                              {!producto.tiene_parametros ? (
                                <div className="flex items-center gap-2">
                                  <label className="text-sm text-gray-600 flex-shrink-0">Cantidad a entregar:</label>
                                  <Input
                                    type="number"
                                    value={selectedProductsDeliver[producto.id]?.cantidad || ''}
                                    onChange={(e) =>
                                      setSelectedProductsDeliver((prev) => ({
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
                                          (Disp: {parametro.cantidad})
                                        </span>
                                      </label>
                                      <Input
                                        type="number"
                                        value={selectedProductsDeliver[producto.id]?.parametros?.[parametro.nombre] || ''}
                                        onChange={(e) => {
                                          const value = parseInt(e.target.value, 10) || 0;
                                          setSelectedProductsDeliver((prev) => ({
                                            ...prev,
                                            [producto.id]: {
                                              ...prev[producto.id],
                                              parametros: {
                                                ...prev[producto.id]?.parametros,
                                                [parametro.nombre]: Math.min(value, parametro.cantidad),
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
                      {inventario.length === 0 && (
                        <div className="text-center py-4 text-gray-500">No hay productos en inventario.</div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t flex justify-end">
                    <Button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white font-bold">
                      Despachar Stock
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* TAB 3: MOVER ENTRE VENDEDORES */}
          {activeTab === 'mover' && (
            <Card className="border-orange-100 shadow-sm">
              <CardHeader className="bg-white border-b border-orange-50">
                <CardTitle className="text-xl font-bold text-orange-950 flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-orange-600" /> Mover entre Vendedores / Puntos de Venta
                </CardTitle>
                <CardDescription>
                  Traspasa existencias de un vendedor origen a otro vendedor destino
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleMoveProduct} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="fromVendor">Punto de Venta Origen (Tiene el stock)</Label>
                      <Select
                        value={selectedFromVendedorMove}
                        onValueChange={setSelectedFromVendedorMove}
                        required
                      >
                        <SelectTrigger id="fromVendor" className="w-full">
                          <SelectValue placeholder="Selecciona origen" />
                        </SelectTrigger>
                        <SelectContent>
                          {vendedores.map(v => (
                            <SelectItem key={v.id} value={v.id.toString()}>
                              {v.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="toVendor">Punto de Venta Destino (Recibirá el stock)</Label>
                      <Select
                        value={selectedToVendedorMove}
                        onValueChange={setSelectedToVendedorMove}
                        required
                      >
                        <SelectTrigger id="toVendor" className="w-full">
                          <SelectValue placeholder="Selecciona destino" />
                        </SelectTrigger>
                        <SelectContent>
                          {vendedores.map(v => (
                            <SelectItem key={v.id} value={v.id.toString()}>
                              {v.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Seleccionar Producto a Traspasar</Label>
                    <Input
                      placeholder="Buscar producto por nombre o código..."
                      value={searchTermMove}
                      onChange={e => setSearchTermMove(e.target.value)}
                      className="mb-2"
                    />
                    <div className="flex gap-2">
                      <Select
                        value={selectedProductMove?.id || ''}
                        onValueChange={val => {
                          const prod = inventarioOrigen.find(p => p.id.toString() === val);
                          setSelectedProductMove(prod || null);
                          setParamQuantitiesMove({});
                        }}
                        disabled={!selectedFromVendedorMove || loadingFromInventory}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={loadingFromInventory ? "Cargando stock..." : "Selecciona un producto del origen"} />
                        </SelectTrigger>
                        <SelectContent>
                          {inventarioOrigen
                            .filter(p => p.nombre.toLowerCase().includes(searchTermMove.toLowerCase()) || p.codigo_barras?.includes(searchTermMove))
                            .map(p => (
                            <SelectItem key={p.id} value={p.id.toString()}>
                              {p.nombre} - Stock: {p.tiene_parametros && p.parametros ? p.parametros.reduce((a, b) => a + b.cantidad, 0) : p.cantidad}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button
                        type="button"
                        variant="secondary"
                        disabled={!selectedFromVendedorMove || loadingFromInventory}
                        onClick={() => {
                          setScannerFor('mover');
                          setShowScanner(true);
                        }}
                        className="bg-orange-50 border border-orange-100 text-orange-950"
                      >
                        <Scan className="w-4 h-4 mr-2" /> Escanear QR
                      </Button>
                    </div>
                  </div>

                  {selectedProductMove && (
                    <div className="p-4 bg-orange-50/50 rounded-lg border border-orange-100 space-y-3">
                      <h4 className="font-bold text-orange-950 text-sm">Configurar transferencia</h4>
                      
                      {selectedProductMove.tiene_parametros && selectedProductMove.parametros ? (
                        <div className="space-y-3">
                          {selectedProductMove.parametros.map(p => (
                            <div key={p.nombre} className="flex justify-between items-center gap-4 bg-white p-2 rounded border">
                              <span className="font-medium text-sm text-gray-700">{p.nombre} (Stock origen: {p.cantidad})</span>
                              <Input
                                type="number"
                                min="0"
                                max={p.cantidad}
                                value={paramQuantitiesMove[p.nombre] || 0}
                                onChange={e => {
                                  const val = Math.min(p.cantidad, Math.max(0, parseInt(e.target.value) || 0));
                                  setParamQuantitiesMove({ ...paramQuantitiesMove, [p.nombre]: val });
                                }}
                                className="w-24"
                              />
                            </div>
                          ))}
                          <div className="flex justify-between items-center font-bold text-orange-950 pt-2 border-t">
                            <span>Total a Traspasar:</span>
                            <span>{Object.values(paramQuantitiesMove).reduce((a, b) => a + b, 0)} unidades</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <Label htmlFor="cantidadMove">Cantidad a Mover (Stock origen: {selectedProductMove.cantidad})</Label>
                          <Input
                            id="cantidadMove"
                            type="number"
                            min="0"
                            max={selectedProductMove.cantidad}
                            value={cantidadMove}
                            onChange={e => setCantidadMove(Math.min(selectedProductMove.cantidad, Math.max(0, parseInt(e.target.value) || 0)))}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-4 border-t flex justify-end">
                    <Button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white font-bold">
                      Realizar Transferencia
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* TAB 4: VER TRANSACCIONES */}
          {activeTab === 'transacciones' && (
            <Card className="border-orange-100 shadow-sm">
              <CardHeader className="bg-white border-b border-orange-50">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
                  <div>
                    <CardTitle className="text-xl font-bold text-orange-950 flex items-center gap-2">
                      <ClipboardList className="w-5 h-5 text-orange-600" /> Transacciones Recientes
                    </CardTitle>
                    <CardDescription>
                      Historial completo de movimientos de almacén para auditoría rápida
                    </CardDescription>
                  </div>
                  <div className="relative max-w-xs w-full">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <Input
                      placeholder="Buscar por producto..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-9 border-orange-100"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {loadingTransacciones ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                      <thead className="text-xs text-orange-900 uppercase bg-orange-50/70 border-b border-orange-100">
                        <tr>
                          <th className="px-4 py-3">Fecha</th>
                          <th className="px-4 py-3">Producto</th>
                          <th className="px-4 py-3">Tipo</th>
                          <th className="px-4 py-3">Desde</th>
                          <th className="px-4 py-3">Hacia</th>
                          <th className="px-4 py-3 text-right">Cantidad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transacciones
                          .filter(t => t.producto && t.producto.toLowerCase().includes(searchTerm.toLowerCase()))
                          .slice(0, 50)
                          .map((t, idx) => (
                            <tr key={idx} className="bg-white border-b border-orange-50 hover:bg-orange-50/30">
                              <td className="px-4 py-3 font-medium text-gray-800">
                                {new Date(t.fecha).toLocaleDateString('es-ES', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </td>
                              <td className="px-4 py-3 text-gray-900 font-semibold">{t.producto}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  t.tipo === 'Entrega' 
                                    ? 'bg-blue-100 text-blue-800' 
                                    : t.tipo === 'Baja' 
                                      ? 'bg-red-100 text-red-800' 
                                      : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {t.tipo}
                                </span>
                              </td>
                              <td className="px-4 py-3">{t.desde || '-'}</td>
                              <td className="px-4 py-3">{t.hacia || '-'}</td>
                              <td className="px-4 py-3 text-right font-bold text-gray-950">{t.cantidad}</td>
                            </tr>
                          ))}
                        
                        {transacciones.length === 0 && (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-gray-400 font-medium">
                              No hay transacciones registradas
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

        </div>
      </main>

      {/* SCANNER DIALOG */}
      <BarcodeScanner
        open={showScanner}
        onScan={handleBarcodeScanned}
        onClose={() => setShowScanner(false)}
      />
    </div>
  );
}
