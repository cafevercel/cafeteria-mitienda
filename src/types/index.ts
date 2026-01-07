// src/types/index.ts


export interface ProductoCocina {
  id: string;
  producto_id: string;
  nombre: string;
  precio: number;
  precio_compra: number;
  cantidad: number;
  foto?: string | null;
  tiene_parametros: boolean;
  parametros?: Parametro[];
}


export interface VentaSemana {
  fechaInicio: string
  fechaFin: string
  ventas: Venta[]
  total: number
  ganancia: number
}

export interface VentaDia {
  fecha: string
  ventas: Venta[]
  total: number
}

export interface Parametro {
  nombre: string;
  cantidad: number;
}

export interface Agrego {
  id?: number;  // Cambiar a number ya que es SERIAL
  producto_id?: number;  // Cambiar a number
  nombre: string;
  precio: number;
}

export interface AgregoForm {
  id?: number | string // ✅ Agregar ID opcional
  nombre: string
  precio: number
}

export interface Costo {
  id?: number;
  producto_id?: number;
  nombre: string;
  precio: number;
}

export interface CostoForm {
  id?: number | string // ✅ Agregar ID opcional
  nombre: string
  precio: number
}

// Actualizar la interface Producto
export interface Producto {
  id: string;
  nombre: string;
  precio: number;
  precio_compra?: number;
  cantidad: number;
  foto?: string | null;
  tiene_parametros: boolean;
  tiene_agrego?: boolean;
  tiene_costo?: boolean;      // ← NUEVO
  tieneParametros?: boolean;
  parametros?: Parametro[]
  agregos?: Agrego[];
  costos?: Costo[];           // ← NUEVO
  porcentajeGanancia?: number;
  seccion?: string;
}

export interface VentaParametro {
  nombre: string;
  cantidad: number;
}

export interface Venta {
  id: string;
  producto: string;
  producto_nombre: string;
  producto_foto: string;
  cantidad: number;
  precio_unitario: number;
  total: number;
  vendedor: string;
  fecha: string;
  parametros?: VentaParametro[];
  ganancia_unitaria?: number; // Ganancia por unidad (precio venta - precio compra)
  ganancia_total?: number; // Ganancia total de la venta (ganancia_unitaria * cantidad)
}

export interface Gasto {
  id: string;
  nombre: string;
  cantidad: number;
  fecha: string;
}

export interface Vendedor {
  id: string;
  nombre: string;
  productos: Producto[];
  rol: string;
  telefono?: string;
  password: string;
  activo?: boolean;
}

export interface Usuario {
  id: string;
  nombre: string;
  rol: 'Almacen' | 'Vendedor';
  telefono?: string;
  activo?: boolean;
}

// Agregar nueva interface para los parámetros de transacción
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
  parametros?: TransaccionParametro[]; // Ya existía
  es_cocina?: boolean; // ✅ AGREGADA - Indica si la transacción es relacionada con cocina
}


export interface Entrega {
  id: string;
  fecha: string;
  producto: Producto;
  cantidad: number;
  vendedor: Vendedor;
}

export interface Merma {
  id: string;
  producto: Producto;
  cantidad: number;
  fecha: string;
  usuario_id: number;
  usuario_nombre: string;
}

export interface TransferProductParams {
  productId: string;
  fromVendorId: string;
  toVendorId: string;
  cantidad: number;
  parametros?: Array<{ nombre: string; cantidad: number }>;
}

// Añade estas interfaces al final de tu archivo types/index.ts

export interface GastoBalance {
  nombre: string;
  cantidad: number | string;
}

export interface IngresoBalance {
  nombre: string;
  cantidad: number | string;
}

// Actualizar la interface Balance
export interface Balance {
  id: string;
  fechaInicio: string;
  fechaFin: string;
  gananciaBruta: number;
  gastos: GastoBalance[];
  totalGastos: number;
  ingresos: IngresoBalance[];  // ← NUEVO
  totalIngresos: number;       // ← NUEVO
  gananciaNeta: number;
  fechaCreacion: string;
}

export interface MenuSection {
  name: string;
  product_count: number;
  sample_image: string | null;
  orden: number;
}

// Tipos para la funcionalidad de contabilidad de vendedores
export interface GastoVendedor {
  id: number;
  nombre: string;
  cantidad: number;
  fecha: string;
  vendedor_id?: string; // Opcional para compatibilidad
  mes?: number; // Opcional para compatibilidad
  anio?: number; // Opcional para compatibilidad
}

export interface VendedorConSalario extends Vendedor {
  salario?: number;
}

export interface CalculoContabilidadVendedor {
  vendedorId: string;
  vendedorNombre: string;
  ventaTotal: number;
  gananciaBruta: number;
  gastos: number;
  gastosMerma: number;
  salario: number;
  resultado: number;
  detalles: {
    ventas: Array<{
      producto: string;
      cantidad: number;
      precioVenta: number;
      precioCompra: number;
      gananciaProducto: number;
    }>;
    gastosDesglosados: Array<{
      nombre: string;
      valorMensual: number;
      diasSeleccionados: number;
      valorProrrateado: number;
    }>;
    mermaDesglosada: Array<{
      producto: string;
      cantidad: number;
      precio: number;
      total: number;
      fecha: string;
    }>;
  };
}

// Interface para Empleados (asociados a puntos de venta/usuarios)
export interface Empleado {
  id: string;
  nombre: string;
  usuario_id: string; // Punto de venta al que pertenece
  password: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface NewEmpleado {
  nombre: string;
  usuario_id: string;
  password: string;
  activo: boolean;
}