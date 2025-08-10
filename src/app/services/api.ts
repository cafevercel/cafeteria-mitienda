//api.ts

import axios from 'axios';
import { Venta, Vendedor, Transaccion, VentaParametro, IngresoBalance, Gasto, Producto, GastoBalance, Balance, MenuSection, Agrego, Costo, ProductoCocina } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export const api = axios.create({
  baseURL: API_URL
});

interface User {
  id: string;
  nombre: string;
  rol: string;
  telefono?: string;
  password: string;
}

interface LocalProducto {
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
  foto?: string | null;
  tiene_parametros: boolean;
  tieneParametros?: boolean;
  porcentaje_ganancia?: number; // Usar el nombre con guion bajo
  seccion?: string;
  parametros?: Array<{
    nombre: string;
    cantidad: number;
  }>;
}


/**
 * Este archivo contiene todas las funciones de API para interactuar con el backend.
 * NOTA: El sistema ahora utiliza un inventario compartido para todos los vendedores.
 * - Las tablas usuario_productos y usuario_producto_parametros ya no tienen usuario_id
 * - Todas las transacciones y entregas de productos van al inventario común
 * - Solo las ventas siguen asociadas a vendedores específicos
 */

export const uploadImage = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const getCurrentUser = async (): Promise<User> => {
  try {
    const response = await api.get<User>('/users/me');

    // Verificar que response.data existe y tiene un id
    if (!response.data || !response.data.id) {
      throw new Error('Respuesta inválida del servidor: datos de usuario incompletos');
    }

    return {
      ...response.data,
      id: response.data.id.toString() // Ensure ID is always a string
    };
  } catch (error) {
    console.error('Error al obtener el usuario actual:', error);

    // Mejorar el mensaje de error basado en el tipo de error
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
      } else if (error.response?.status === 404) {
        throw new Error('Usuario no encontrado. Por favor, inicia sesión nuevamente.');
      } else if (!error.response) {
        throw new Error('Error de conexión. Por favor, verifica tu conexión a internet.');
      }
    }

    throw new Error('No se pudo obtener la información del usuario. Por favor, inicia sesión nuevamente.');
  }
};

export const login = async (nombre: string, password: string): Promise<User> => {
  try {
    const response = await api.post('/auth/login', { nombre, password });
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      api.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      return response.data;
    } else {
      throw new Error('No se recibió el token de autenticación');
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Error en la solicitud de login:', error.response?.data || error.message);
    } else {
      console.error('Error en la solicitud de login:', error);
    }
    throw new Error('Error de autenticación. Por favor, verifica tus credenciales e intenta de nuevo.');
  }
};

export const logout = async (): Promise<void> => {
  try {
    await api.post('/auth/logout');
    localStorage.removeItem('token'); // Asegurarse de limpiar el token
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    localStorage.removeItem('token'); // Limpiar el token incluso si hay error
    throw error;
  }
};

export const getVendedores = async (): Promise<Vendedor[]> => {
  const response = await api.get('/users/vendedores');
  return response.data;
};

export const getInventario = async (): Promise<Producto[]> => {
  try {
    const response = await api.get<LocalProducto[]>('/productos');
    // Asegurar que los datos cumplan con el tipo Producto
    return response.data.map(p => ({
      ...p,
      foto: p.foto || null,
      tiene_parametros: Boolean(p.tiene_parametros)
    })) as Producto[];
  } catch (error) {
    console.error('Error fetching inventory:', error);
    throw error;
  }
};

export const registerUser = async (userData: Omit<User, 'id'>): Promise<User> => {
  const response = await api.post<User>('/auth/register', userData);
  return response.data;
};

export const getProductosCompartidos = async () => {
  try {
    const response = await api.get('/productos/compartidos');

    // Mapear correctamente los datos para que coincidan con el tipo Producto
    return response.data.map((producto: any) => ({
      id: producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      foto: producto.foto,
      cantidad: producto.cantidad,
      tiene_parametros: producto.tieneParametros || producto.tiene_parametros || false,
      tieneParametros: producto.tieneParametros || producto.tiene_parametros || false,
      porcentajeGanancia: producto.porcentajeGanancia || 0,
      parametros: Array.isArray(producto.parametros) ? producto.parametros : []
    }));
  } catch (error) {
    console.error('Error al obtener productos compartidos:', error);
    throw new Error('No se pudieron cargar los productos compartidos. Por favor, intenta de nuevo.');
  }
};

export const agregarProducto = async (formData: FormData) => {
  try {
    const parametrosRaw = formData.get('parametros');
    if (parametrosRaw) {
      try {
        // Mantener el mismo nombre de variable
        const parametros = JSON.parse(parametrosRaw as string);

        // Validar que sea un array con la estructura correcta
        if (Array.isArray(parametros)) {
          const parametrosValidados = parametros.filter(p =>
            p && typeof p === 'object' &&
            'nombre' in p &&
            'cantidad' in p
          );

          // Volver a usar el mismo nombre de formData
          formData.set('parametros', JSON.stringify(parametrosValidados));
        }
      } catch (parseError) {
        console.error('Error al parsear parametros:', parseError);
        // En caso de error, mantener un array vacío
        formData.set('parametros', JSON.stringify([]));
      }
    }

    // No es necesario modificar esta parte, ya que formData ya incluirá el campo "porcentajeGanancia"
    const response = await api.post('/productos', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error al agregar producto:', error);
    throw new Error('Error al agregar el producto');
  }
};


export const editarProducto = async (id: string, formData: FormData) => {
  try {
    // Procesar los parámetros como ya lo estás haciendo
    const parametrosRaw = formData.get('parametros');
    if (parametrosRaw) {
      try {
        const parametros = JSON.parse(parametrosRaw as string);
        if (Array.isArray(parametros)) {
          const parametrosValidados = parametros.filter(p =>
            p && typeof p === 'object' &&
            'nombre' in p &&
            'cantidad' in p
          );
          formData.set('parametros', JSON.stringify(parametrosValidados));
        }
      } catch (parseError) {
        console.error('Error al parsear parametros en edición:', parseError);
        formData.set('parametros', JSON.stringify([]));
      }
    }

    // Procesar agregos - EXISTENTE
    const agregosRaw = formData.get('agregos');
    if (agregosRaw) {
      try {
        const agregos = JSON.parse(agregosRaw as string);
        if (Array.isArray(agregos)) {
          const agregosValidados = agregos.filter(a =>
            a && typeof a === 'object' &&
            'nombre' in a &&
            'precio' in a &&
            a.nombre.trim() !== ''
          );
          formData.set('agregos', JSON.stringify(agregosValidados));
        }
      } catch (parseError) {
        console.error('Error al parsear agregos en edición:', parseError);
        formData.set('agregos', JSON.stringify([]));
      }
    }

    // Procesar costos - NUEVO
    const costosRaw = formData.get('costos');
    if (costosRaw) {
      try {
        const costos = JSON.parse(costosRaw as string);
        if (Array.isArray(costos)) {
          const costosValidados = costos.filter(c =>
            c && typeof c === 'object' &&
            'nombre' in c &&
            'precio' in c &&
            c.nombre.trim() !== ''
          );
          formData.set('costos', JSON.stringify(costosValidados));
        }
      } catch (parseError) {
        console.error('Error al parsear costos en edición:', parseError);
        formData.set('costos', JSON.stringify([]));
      }
    }

    const response = await api.put(`/productos/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error al editar producto:', error);
    throw new Error('Error al editar el producto');
  }
};


// Reemplazar la función existente
// En api.ts, reemplaza la función existente
export const entregarProducto = async (
  productoId: string,
  cantidad: number,
  parametros?: Array<{ nombre: string; cantidad: number }>,
  esCocina: boolean = false
) => {
  try {
    const response = await api.post('/transacciones', {
      productoId,
      cantidad,
      tipo: 'Entrega',
      parametros,
      esCocina
    });
    return response.data;
  } catch (error) {
    console.error('Error al entregar producto:', error);
    throw new Error('Error al entregar el producto');
  }
};



export const getTransacciones = async () => {
  const response = await api.get('/transacciones');
  return response.data;
};

export const eliminarProducto = async (productId: string) => {
  try {
    const response = await api.delete(`/productos/${productId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
};

export const crearBajaTransaccion = async (productoId: string, vendedorId: string, cantidad: number) => {
  try {
    const response = await api.post('/transacciones', {
      productoId,
      vendedorId,
      cantidad,
      tipo: 'Baja'
    });
    return response.data;
  } catch (error) {
    console.error('Error creating Baja transaction:', error);
    throw error;
  }
};

export const realizarVenta = async (
  productoId: string,
  cantidad: number,
  fecha: string,
  parametros?: VentaParametro[],
  vendedorId?: string
): Promise<Venta> => {
  if (!vendedorId) {
    throw new Error('Se requiere ID del vendedor');
  }

  try {
    const requestBody = { productoId, cantidad, fecha, parametros, vendedorId };
    console.log('Enviando datos de venta:', requestBody);

    const response = await api.post('/ventas', requestBody);
    return response.data;
  } catch (error) {
    console.error('Error al realizar la venta:', error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Error al realizar la venta: ${error.response.data.error || error.response.data.message || 'Ocurrió un error'}`);
    }
    throw new Error('Error al realizar la venta');
  }
};

export const editarVenta = async (
  ventaId: string,
  productoId: string,
  cantidad: number,
  fecha: string,
  parametros?: VentaParametro[],
  vendedorId?: string
): Promise<Venta> => {
  if (!vendedorId) {
    throw new Error('Se requiere ID del vendedor');
  }

  try {
    const requestBody = {
      productoId,
      cantidad,
      fecha,
      parametros,
      vendedorId
    };
    console.log('Enviando datos de edición de venta:', requestBody);

    const response = await api.put(`/ventas/${ventaId}`, requestBody);
    return response.data;
  } catch (error) {
    console.error('Error al editar la venta:', error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Error al editar la venta: ${error.response.data.error || error.response.data.message || 'Ocurrió un error'}`);
    }
    throw new Error('Error al editar la venta');
  }
};


export const getVentasMes = async (vendedorId: string): Promise<Venta[]> => {
  const response = await api.get(`/ventas?vendedorId=${vendedorId}`);
  return response.data;
};

export const getTransaccionesVendedor = async () => {
  try {
    const response = await api.get('/transacciones/compartidas');
    return response.data;
  } catch (error) {
    console.error('Error al obtener transacciones compartidas:', error);
    throw new Error('No se pudieron obtener las transacciones compartidas');
  }
};

const handleApiError = (error: unknown, context: string) => {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      console.error(`Error de respuesta del servidor (${context}):`, error.response.data);
      console.error('Estado HTTP:', error.response.status);
      if (error.response.status === 403) {
        console.error(`No tienes permiso para ver estos ${context}`);
        return [];
      }
      throw new Error(`Error de autenticación: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      console.error('No se recibió respuesta del servidor');
      throw new Error('No se pudo conectar con el servidor. Por favor, verifica tu conexión a internet.');
    } else {
      console.error('Error al configurar la solicitud:', error.message);
      throw new Error('Error al intentar autenticar. Por favor, intenta de nuevo más tarde.');
    }
  } else {
    console.error('Error desconocido:', error);
    throw new Error('Ocurrió un error inesperado. Por favor, intenta de nuevo.');
  }
};

export const reducirProductoInventario = async (
  productoId: string,
  cantidad: number,
  parametros?: Array<{ nombre: string; cantidad: number }>
) => {
  try {
    const payload = {
      productoId,
      cantidad,
      parametros
    };

    console.log('Enviando datos:', payload); // Para depuración

    const response = await api.put(`/productos/reducir`, payload);
    return response.data;
  } catch (error: any) {
    console.error('Error al reducir la cantidad del producto:', error);
    // Mostrar más detalles del error
    if (error.response) {
      console.error('Respuesta del servidor:', error.response.data);
    }
    throw new Error('No se pudo reducir la cantidad del producto');
  }
};

export const getVentasVendedor = async (vendedorId: string): Promise<Venta[]> => {
  try {
    const response = await api.get<Venta[]>(`/ventas`, {
      params: { vendedorId }
    });
    return response.data;
  } catch (error) {
    console.error('Error al obtener ventas:', error);
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        return []; // Retorna array vacío si no hay ventas
      }
    }
    throw new Error('No se pudieron obtener las ventas');
  }
};

export const editarVendedor = async (vendedorId: string, editedVendor: Partial<Vendedor> & { newPassword?: string }): Promise<void> => {
  try {
    const vendorData: Partial<Vendedor> = { ...editedVendor };

    // If a new password is provided, include it in the request
    if (editedVendor.newPassword) {
      vendorData.password = editedVendor.newPassword;
    }

    // Remove the newPassword field from the request payload
    delete (vendorData as any).newPassword;

    console.log('Enviando datos para actualizar vendedor:', vendedorId, vendorData);
    const response = await api.put(`/users/vendedores?id=${vendedorId}`, vendorData);
    return response.data;
  } catch (error) {
    console.error('Error al editar vendedor:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('Respuesta del servidor:', error.response.data);
    }
    throw new Error(axios.isAxiosError(error) && error.response?.data?.message
      ? error.response.data.message
      : `No se pudo editar el vendedor: ${(error as Error).message}`);
  }
};

export const getTransaccionesProducto = async (productoId: string): Promise<Transaccion[]> => {
  try {
    const response = await api.get<Transaccion[]>(`/transacciones`, {
      params: { productoId }
    });
    return response.data;
  } catch (error) {
    console.error('Error al obtener las transacciones del producto:', error);
    handleApiError(error, 'transacciones del producto');
    throw new Error('No se pudieron obtener las transacciones del producto');
  }
};

export const getVentasProducto = async (
  productoId: string,
  startDate?: string,
  endDate?: string,
  vendedorId?: string
): Promise<Venta[]> => {
  try {
    const params: Record<string, string> = { productoId };
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (vendedorId) params.vendedorId = vendedorId;

    const response = await api.get<Venta[]>(`/ventas`, { params });
    return response.data;
  } catch (error) {
    console.error('Error al obtener las ventas del producto:', error);
    handleApiError(error, 'ventas del producto');
    throw new Error('No se pudieron obtener las ventas del producto');
  }
};

export const deleteSale = async (saleId: string, vendedorId: string): Promise<void> => {
  if (!saleId) {
    throw new Error('El ID de la venta es requerido');
  }

  if (!vendedorId) {
    throw new Error('El ID del vendedor es requerido');
  }

  try {
    await api.delete(`/ventas/${saleId}?vendedorId=${vendedorId}`);
  } catch (error) {
    console.error('Error al eliminar la venta:', error);
    throw new Error('No se pudo eliminar la venta');
  }
};

export default api;

export const createMerma = async (
  producto_id: string,
  usuario_id: string,
  cantidad: number,
  parametros?: { nombre: string; cantidad: number }[]
) => {
  // Si usuario_id está vacío, usamos un valor especial para que el backend sepa que es merma directa
  const id_usuario = usuario_id.trim() === '' ? 'cafeteria' : usuario_id;

  const response = await fetch('/api/merma', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      producto_id,
      usuario_id: id_usuario,
      cantidad,
      parametros
    }),
  });

  if (!response.ok) {
    throw new Error('Error al crear merma');
  }

  return response.json();
};

export const getMermas = async (usuario_id?: string) => {
  const response = await fetch(`/api/merma${usuario_id ? `?usuario_id=${usuario_id}` : ''}`);
  if (!response.ok) {
    throw new Error('Error al obtener mermas');
  }
  const data = await response.json();
  return data;
};

export const deleteMerma = async (productoId: string): Promise<void> => {
  try {
    const response = await fetch(`/api/merma?producto_id=${productoId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al eliminar las mermas');
    }
  } catch (error) {
    console.error('Error en deleteMerma:', error);
    throw error;
  }
};

export const verificarNombreProducto = async (nombre: string): Promise<boolean> => {
  try {
    const response = await api.get(`/productos/verificar-nombre?nombre=${encodeURIComponent(nombre)}`);
    return response.data.exists;
  } catch (error) {
    console.error('Error al verificar nombre del producto:', error);
    throw new Error('Error al verificar el nombre del producto');
  }
};

export const getProductosCafeteria = async () => {
  try {
    const response = await api.get('/cafeteria/productos');
    return response.data;
  } catch (error) {
    console.error('Error al obtener productos de cafetería:', error);
    throw new Error('No se pudieron cargar los productos de cafetería. Por favor, intenta de nuevo.');
  }
};

export const getVendedorProductos = async (vendedorId: string): Promise<LocalProducto[]> => {
  try {
    // Usamos la ruta de productos compartidos que ya existe
    const response = await api.get(`/productos/compartidos`);

    // Aseguramos que la respuesta tenga la estructura correcta
    const productos = response.data.map((producto: any) => ({
      ...producto,
      tieneParametros: producto.tiene_parametros || false,
      tiene_parametros: producto.tiene_parametros || false
    }));

    return productos;
  } catch (error) {
    console.error('Error al obtener productos del vendedor:', error);
    throw new Error('No se pudieron obtener los productos del vendedor');
  }
};

export const getVendedorVentas = async (vendedorId: string): Promise<Venta[]> => {
  try {
    // Usamos la ruta de ventas con el parámetro vendedorId que ya existe
    const response = await api.get(`/ventas`, {
      params: { vendedorId }
    });
    return response.data;
  } catch (error) {
    console.error('Error al obtener ventas del vendedor:', error);
    throw new Error('No se pudieron obtener las ventas del vendedor');
  }
};

export const getVendedorTransacciones = async (vendedorId: string): Promise<Transaccion[]> => {
  try {
    // Usamos la función de transacciones compartidas que ya existe
    const response = await api.get(`/transacciones/compartidas`);
    return response.data;
  } catch (error) {
    console.error('Error al obtener transacciones del vendedor:', error);
    throw new Error('No se pudieron obtener las transacciones del vendedor');
  }
};

export const getAllVentas = async (): Promise<Venta[]> => {
  try {
    const response = await api.get(`/ventas`, {
      params: { all: true }
    });
    return response.data;
  } catch (error) {
    console.error('Error al obtener todas las ventas:', error);
    throw new Error('No se pudieron obtener todas las ventas');
  }
};

// Métodos para manejar gastos

export const getGastos = async (): Promise<Gasto[]> => {
  try {
    const response = await api.get('/gastos');
    return response.data;
  } catch (error) {
    console.error('Error al obtener gastos:', error);
    throw new Error('No se pudieron obtener los gastos');
  }
};

export const crearGasto = async (gasto: Omit<Gasto, 'id'>): Promise<Gasto> => {
  try {
    const response = await api.post('/gastos', gasto);
    return response.data;
  } catch (error) {
    console.error('Error al crear gasto:', error);
    throw new Error('No se pudo crear el gasto');
  }
};

export const eliminarGasto = async (gastoId: string): Promise<void> => {
  try {
    await api.delete(`/gastos?id=${gastoId}`);
  } catch (error) {
    console.error('Error al eliminar gasto:', error);
    throw new Error('No se pudo eliminar el gasto');
  }
};


// Añade estas funciones al final de tu archivo api.ts

export const getBalances = async (): Promise<Balance[]> => {
  try {
    const response = await api.get('/balances');
    return response.data;
  } catch (error) {
    console.error('Error al obtener balances:', error);
    throw new Error('No se pudieron obtener los balances');
  }
};

export const crearBalance = async (balance: Omit<Balance, 'id'> & { gastosDirectosIds?: string[] }): Promise<Balance> => {
  try {
    const response = await api.post('/balances', balance);
    return response.data;
  } catch (error) {
    console.error('Error al crear balance:', error);
    throw new Error('No se pudo crear el balance');
  }
};


export const eliminarBalance = async (balanceId: string): Promise<void> => {
  try {
    await api.delete(`/balances?id=${balanceId}`);
  } catch (error) {
    console.error('Error al eliminar balance:', error);
    throw new Error('No se pudo eliminar el balance');
  }
};

export const editarBalance = async (balanceId: string, balance: Omit<Balance, 'id' | 'fechaCreacion'>): Promise<Balance> => {
  try {
    // ✅ USAR EL ENDPOINT CORRECTO CON EL ID EN LA URL
    const response = await api.put(`/balances/${balanceId}`, balance);
    return response.data;
  } catch (error) {
    console.error('Error al editar balance:', error);

    // ✅ MEJOR MANEJO DE ERRORES
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        throw new Error('Balance no encontrado');
      } else if (error.response?.status === 400) {
        throw new Error(`Error de validación: ${error.response.data.error || 'Datos inválidos'}`);
      } else if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
    }

    throw new Error('No se pudo editar el balance');
  }
};


export const getMenuSections = async (): Promise<MenuSection[]> => {
  try {
    const response = await api.get('/menu/sections');
    return response.data.sections;
  } catch (error) {
    console.error('Error al obtener secciones del menú:', error);
    throw new Error('No se pudieron cargar las secciones del menú');
  }
};

export const saveMenuSectionOrder = async (sections: MenuSection[]): Promise<void> => {
  try {
    await api.put('/menu/sections/order', { sections });
  } catch (error) {
    console.error('Error al guardar orden de secciones:', error);
    throw new Error('No se pudo guardar el orden de las secciones');
  }
};

// En api.ts, agrega esta función
export const eliminarSeccionMenu = async (seccionNombre: string): Promise<void> => {
  try {
    const response = await api.delete(`/menu/sections/${encodeURIComponent(seccionNombre)}`);
    return response.data;
  } catch (error) {
    console.error('Error al eliminar sección:', error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Error al eliminar la sección: ${error.response.data.error || 'Ocurrió un error'}`);
    }
    throw new Error('No se pudo eliminar la sección');
  }
};


export const getAgregos = async (productoId: string): Promise<Agrego[]> => {
  try {
    const response = await api.get(`/productos/${productoId}/agregos`);
    return response.data;
  } catch (error) {
    console.error('Error al obtener agregos:', error);
    throw new Error('No se pudieron cargar los agregos');
  }
};

export const guardarAgregos = async (productoId: string, agregos: Agrego[]): Promise<void> => {
  try {
    await api.put(`/productos/${productoId}/agregos`, { agregos });
  } catch (error) {
    console.error('Error al guardar agregos:', error);
    throw new Error('No se pudieron guardar los agregos');
  }
};

export const getCostos = async (productoId: string): Promise<Costo[]> => {
  try {
    const response = await api.get(`/productos/${productoId}/costos`);
    return response.data;
  } catch (error) {
    console.error('Error al obtener costos:', error);
    throw new Error('No se pudieron cargar los costos');
  }
};

export const guardarCostos = async (productoId: string, costos: Costo[]): Promise<void> => {
  try {
    await api.put(`/productos/${productoId}/costos`, { costos });
  } catch (error) {
    console.error('Error al guardar costos:', error);
    throw new Error('No se pudieron guardar los costos');
  }
};


// Agregar estas funciones al final de api.ts

export const getProductosCocina = async (): Promise<ProductoCocina[]> => {
  try {
    const response = await api.get('/cocina/productos');
    return response.data;
  } catch (error) {
    console.error('Error al obtener productos de cocina:', error);
    throw new Error('No se pudieron cargar los productos de cocina');
  }
};

export const reducirProductoCocina = async (
  productoId: string,
  cantidad: number,
  parametros?: Array<{ nombre: string; cantidad: number }>
): Promise<void> => {
  try {
    const response = await api.post('/cocina/reducir', {
      productoId,
      cantidad,
      parametros
    });
    return response.data;
  } catch (error) {
    console.error('Error al reducir producto de cocina:', error);
    throw new Error('Error al reducir el producto de cocina');
  }
};


export const getGastosFromBalances = async (): Promise<Array<{ fecha: string; gastos: GastoBalance[]; total: number }>> => {
  try {
    const response = await api.get('/balances/gastos');
    return response.data;
  } catch (error) {
    console.error('Error al obtener gastos de balances:', error);
    throw new Error('No se pudieron obtener los gastos de los balances');
  }
};


export const getGastosDetallados = async (): Promise<Array<{
  balanceId: string;
  fechaInicio: string;
  fechaFin: string;
  gastos: GastoBalance[];
  totalGastos: number;
}>> => {
  try {
    const response = await api.get('/balances/gastos-detallados');
    return response.data;
  } catch (error) {
    console.error('Error al obtener gastos detallados:', error);
    throw new Error('No se pudieron obtener los gastos detallados');
  }
};

// Agregar esta nueva función para obtener gastos combinados
export const getGastosCombinados = async (): Promise<Array<{
  fecha: string;
  gastos: Array<{
    nombre: string;
    cantidad: number;
    tipo: 'balance' | 'directo';
    balanceId?: string;
    fechaInicio?: string;
    fechaFin?: string;
    gastoId?: string;
    fechaCreacion?: string;
  }>;
  total: number
}>> => {
  try {
    const response = await api.get('/balances/gastos-combinados');
    return response.data;
  } catch (error) {
    console.error('Error al obtener gastos combinados:', error);
    throw new Error('No se pudieron obtener los gastos combinados');
  }
};


// Funciones para gastos directos
export const createGasto = async (gasto: { nombre: string; cantidad: number }) => {
  try {
    const response = await api.post('/gastos', gasto);
    return response.data;
  } catch (error) {
    console.error('Error al crear gasto:', error);
    throw new Error('No se pudo crear el gasto');
  }
};

// En api.ts - Modificar la función existente
export const deleteGasto = async (id: string) => {
  try {
    // ✅ NUEVO: Usar endpoint específico para eliminar gastos de cocina
    const response = await api.delete(`/gastos/cocina?id=${id}`);
    return response.data;
  } catch (error) {
    console.error('Error al eliminar gasto:', error);
    throw new Error('No se pudo eliminar el gasto');
  }
};


// En api.ts - Agregar esta nueva función
export const enviarProductoAAlmacen = async (
  productoId: string,
  cantidad: number,
  parametros?: Array<{ nombre: string; cantidad: number }>
): Promise<void> => {
  try {
    const response = await api.post('/cocina/enviar-almacen', {
      productoId,
      cantidad,
      parametros
    });
    return response.data;
  } catch (error) {
    console.error('Error al enviar producto a almacén:', error);
    throw new Error('Error al enviar el producto a almacén');
  }
};


// En api.ts - Agregar esta nueva función
export const enviarProductoACafeteria = async (
  productoId: string,
  cantidad: number,
  parametros?: Array<{ nombre: string; cantidad: number }>
): Promise<void> => {
  try {
    const response = await api.post('/cocina/enviar-cafeteria', {
      productoId,
      cantidad,
      parametros
    });
    return response.data;
  } catch (error) {
    console.error('Error al enviar producto a cafetería:', error);
    throw new Error('Error al enviar el producto a cafetería');
  }
};


// Agregar esta función a tu archivo api.ts
export const enviarCafeteriaACocina = async (
  productoId: string,
  cantidad: number,
  parametros?: Array<{ nombre: string; cantidad: number }>
) => {
  const response = await fetch('/api/cafeteria/enviar-cocina', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      productoId,
      cantidad,
      parametros
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.details || errorData.error || 'Error al enviar producto a cocina');
  }

  return response.json();
};
