'use client'

import { useState, useEffect } from 'react'
import { format, parseISO, isValid } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { getAllVentas, getInventario, getGastos, crearBalance, eliminarBalance, getBalances, editarBalance } from '@/app/services/api'
import { Venta, Producto, Gasto, Balance, GastoBalance, IngresoBalance } from '@/types'
import { Wallet, Plus, X, Calendar, ChevronRight, FileText, Trash2, Edit } from 'lucide-react'
import { toast } from "@/hooks/use-toast"

interface VentaDia {
  fecha: string
  ventas: Venta[]
  total: number
  ganancia: number
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

const formatRangoFechas = (fechaInicio: string, fechaFin: string): string => {
  try {
    // Si las fechas son iguales, mostrar solo una fecha
    if (fechaInicio === fechaFin) {
      return formatDate(fechaInicio)
    }
    // Si son diferentes, mostrar el rango
    return `${formatDate(fechaInicio)} - ${formatDate(fechaFin)}`
  } catch (error) {
    console.error('Error al formatear rango de fechas:', error)
    return 'Fechas inválidas'
  }
}

const normalizarFecha = (fechaString: string): string => {
  if (!fechaString) return fechaString;

  // Crear la fecha en la zona horaria local sin conversión UTC
  const fecha = new Date(fechaString + 'T00:00:00');

  // Formatear como YYYY-MM-DD
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}


export default function BalanceSection() {
  const [ventasDiarias, setVentasDiarias] = useState<VentaDia[]>([])
  const [balances, setBalances] = useState<Balance[]>([])
  const [crearDialogOpen, setCrearDialogOpen] = useState(false)
  const [detalleDialogOpen, setDetalleDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [balanceSeleccionado, setBalanceSeleccionado] = useState<Balance | null>(null)
  const [confirmarEliminarDialogOpen, setConfirmarEliminarDialogOpen] = useState(false)
  const [editandoBalance, setEditandoBalance] = useState<Balance | null>(null)
  const [modoEdicion, setModoEdicion] = useState(false)
  const [tipoSeleccion, setTipoSeleccion] = useState<'periodo' | 'dia'>('periodo')
  const [fechaSeleccionada, setFechaSeleccionada] = useState('')
  const [ingresosNuevos, setIngresosNuevos] = useState<IngresoBalance[]>([{ nombre: '', cantidad: '' }])

  // Estados para el nuevo balance
  const [paso, setPaso] = useState(1)
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [gastosNuevos, setGastosNuevos] = useState<GastoBalance[]>([{ nombre: '', cantidad: '' }])

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        // Cargar ventas, productos y balances existentes
        const [ventas, inventario, balancesData] = await Promise.all([
          getAllVentas(),
          getInventario(),
          getBalances()
        ])

        // Agrupar ventas por día y calcular ganancias
        const ventasPorDia = calcularVentasDiarias(ventas, inventario)
        setVentasDiarias(ventasPorDia)
        setBalances(balancesData)
      } catch (err) {
        setError('Error al cargar los datos')
        console.error(err)
        toast({
          title: "Error",
          description: "No se pudieron cargar algunos datos necesarios",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  const agregarIngresoField = () => {
    setIngresosNuevos([...ingresosNuevos, { nombre: '', cantidad: '' }])
  }

  const eliminarIngresoField = (index: number) => {
    const nuevosIngresos = [...ingresosNuevos]
    nuevosIngresos.splice(index, 1)
    setIngresosNuevos(nuevosIngresos)
  }

  const actualizarIngreso = (index: number, campo: 'nombre' | 'cantidad', valor: string) => {
    const nuevosIngresos = [...ingresosNuevos]
    nuevosIngresos[index][campo] = valor
    setIngresosNuevos(nuevosIngresos)
  }

  const calcularTotalIngresos = (ingresos: IngresoBalance[]): number => {
    return ingresos.reduce((sum, ingreso) => {
      const cantidad = typeof ingreso.cantidad === 'string'
        ? parseFloat(ingreso.cantidad) || 0
        : ingreso.cantidad || 0
      return sum + cantidad
    }, 0)
  }

  const calcularVentasDiarias = (ventas: Venta[], productos: Producto[]): VentaDia[] => {
    const ventasPorDia: { [key: string]: VentaDia } = {}

    ventas.forEach(venta => {
      // Usar la función de normalización
      const fechaKey = normalizarFecha(venta.fecha.split('T')[0])

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

      // Obtener el precio de venta y precio de compra
      const precioCompra = producto?.precio_compra || 0
      const precioVenta = parseFloat(venta.precio_unitario.toString())

      // Calcular la ganancia bruta para esta venta
      let gananciaUnitaria = precioVenta - precioCompra

      // Aplicar el descuento del porcentaje de ganancia si existe
      if (producto?.porcentajeGanancia) {
        // El porcentaje se aplica al precio de venta, no a la ganancia
        const descuentoPorcentaje = precioVenta * (producto.porcentajeGanancia / 100)
        gananciaUnitaria = gananciaUnitaria - descuentoPorcentaje
      }

      const gananciaTotal = gananciaUnitaria * venta.cantidad

      ventasPorDia[fechaKey].ventas.push(venta)
      ventasPorDia[fechaKey].total += parseFloat(venta.total.toString())
      ventasPorDia[fechaKey].ganancia += gananciaTotal
    })

    return Object.values(ventasPorDia).sort((a, b) =>
      new Date(b.fecha + 'T00:00:00').getTime() - new Date(a.fecha + 'T00:00:00').getTime()
    )
  }

  const agregarGastoField = () => {
    setGastosNuevos([...gastosNuevos, { nombre: '', cantidad: '' }])
  }

  const eliminarGastoField = (index: number) => {
    const nuevosGastos = [...gastosNuevos]
    nuevosGastos.splice(index, 1)
    setGastosNuevos(nuevosGastos)
  }

  const actualizarGasto = (index: number, campo: 'nombre' | 'cantidad', valor: string) => {
    const nuevosGastos = [...gastosNuevos]
    nuevosGastos[index][campo] = valor
    setGastosNuevos(nuevosGastos)
  }

  const calcularGananciaBruta = (fechaInicio: string, fechaFin: string, tipo: 'periodo' | 'dia' = 'periodo'): number => {
    if (tipo === 'dia') {
      // Para un día específico
      const diaSeleccionado = ventasDiarias.find(dia => dia.fecha === fechaInicio)
      return diaSeleccionado ? diaSeleccionado.ganancia : 0
    } else {
      // Para período (lógica actual)
      return ventasDiarias
        .filter(dia => {
          const fecha = dia.fecha
          return fecha >= fechaInicio && fecha <= fechaFin
        })
        .reduce((sum, dia) => sum + dia.ganancia, 0)
    }
  }


  const calcularTotalGastos = (gastos: GastoBalance[]): number => {
    return gastos.reduce((sum, gasto) => {
      const cantidad = typeof gasto.cantidad === 'string'
        ? parseFloat(gasto.cantidad) || 0
        : gasto.cantidad || 0
      return sum + cantidad
    }, 0)
  }

  const crearNuevoBalance = async () => {
    // Normalizar fechas antes de validar
    const fechaInicioNormalizada = normalizarFecha(fechaInicio)
    const fechaFinNormalizada = normalizarFecha(fechaFin)

    // Validar ingresos
    const ingresosInvalidos = ingresosNuevos.some(
      ingreso => !ingreso.nombre || !ingreso.cantidad || isNaN(parseFloat(ingreso.cantidad.toString()))
    )

    if (ingresosInvalidos) {
      toast({
        title: "Error",
        description: "Todos los ingresos deben tener nombre y cantidad válida",
        variant: "destructive",
      })
      return
    }

    // Validaciones
    if (!fechaInicioNormalizada || !fechaFinNormalizada) {
      toast({
        title: "Error",
        description: "Debe seleccionar fechas de inicio y fin",
        variant: "destructive",
      })
      return
    }

    if (fechaInicioNormalizada > fechaFinNormalizada) {
      toast({
        title: "Error",
        description: "La fecha de inicio no puede ser posterior a la fecha fin",
        variant: "destructive",
      })
      return
    }

    // Validar que todos los gastos tengan nombre y cantidad válida
    const gastosInvalidos = gastosNuevos.some(
      gasto => !gasto.nombre || !gasto.cantidad || isNaN(parseFloat(gasto.cantidad.toString()))
    )

    if (gastosInvalidos) {
      toast({
        title: "Error",
        description: "Todos los gastos deben tener nombre y cantidad válida",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const gananciaBruta = calcularGananciaBruta(fechaInicioNormalizada, fechaFinNormalizada, tipoSeleccion)
      const totalGastos = calcularTotalGastos(gastosNuevos)
      const totalIngresos = calcularTotalIngresos(ingresosNuevos)
      const gananciaNeta = gananciaBruta + totalIngresos - totalGastos  // ← CAMBIO AQUÍ

      const gastosProcesados = gastosNuevos.map(gasto => ({
        nombre: gasto.nombre,
        cantidad: parseFloat(gasto.cantidad.toString())
      }))

      const ingresosProcesados = ingresosNuevos.map(ingreso => ({
        nombre: ingreso.nombre,
        cantidad: parseFloat(ingreso.cantidad.toString())
      }))

      const nuevoBalance = {
        fechaInicio: fechaInicioNormalizada,
        fechaFin: fechaFinNormalizada,
        gananciaBruta,
        gastos: gastosProcesados,
        totalGastos,
        ingresos: ingresosProcesados,  // ← NUEVO
        totalIngresos,                 // ← NUEVO
        gananciaNeta,
        fechaCreacion: new Date().toISOString()
      }

      // Guardar en la base de datos
      const balanceGuardado = await crearBalance(nuevoBalance)

      // Actualizar el estado
      setBalances(prevBalances => [balanceGuardado, ...prevBalances])

      // Resetear el formulario
      setFechaInicio('')
      setFechaFin('')
      setGastosNuevos([{ nombre: '', cantidad: '' }])
      setPaso(1)
      setCrearDialogOpen(false)

      toast({
        title: "Éxito",
        description: "Balance creado correctamente",
      })
    } catch (error) {
      console.error('Error al crear balance:', error)
      toast({
        title: "Error",
        description: "No se pudo crear el balance",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const eliminarBalanceHandler = async () => {
    if (!balanceSeleccionado) return;

    try {
      await eliminarBalance(balanceSeleccionado.id)
      setBalances(balances.filter(balance => balance.id !== balanceSeleccionado.id))
      setBalanceSeleccionado(null)
      setDetalleDialogOpen(false)
      setConfirmarEliminarDialogOpen(false)

      toast({
        title: "Éxito",
        description: "Balance eliminado correctamente",
      })
    } catch (error) {
      console.error('Error al eliminar balance:', error)
      toast({
        title: "Error",
        description: "No se pudo eliminar el balance",
        variant: "destructive",
      })
    }
  }

  const iniciarEdicion = (balance: Balance) => {
    setEditandoBalance(balance)
    setModoEdicion(true)

    // Detectar automáticamente el tipo de balance
    const esDiaUnico = balance.fechaInicio === balance.fechaFin
    setTipoSeleccion(esDiaUnico ? 'dia' : 'periodo')

    setFechaInicio(balance.fechaInicio)
    setFechaFin(balance.fechaFin)

    // Si es un día único, también setear fechaSeleccionada
    if (esDiaUnico) {
      setFechaSeleccionada(balance.fechaInicio)
    }
    setGastosNuevos(balance.gastos.map(g => ({
      nombre: g.nombre,
      cantidad: g.cantidad.toString()
    })))
    setPaso(1)
    setDetalleDialogOpen(false) // Cerrar el dialog de detalle
    setCrearDialogOpen(true) // Abrir el dialog de creación/edición
    setIngresosNuevos(balance.ingresos?.map(i => ({
      nombre: i.nombre,
      cantidad: i.cantidad.toString()
    })) || [{ nombre: '', cantidad: '' }])
  }

  const guardarEdicion = async () => {
    if (!editandoBalance) return;

    // Normalizar fechas antes de validar
    const fechaInicioNormalizada = normalizarFecha(fechaInicio)
    const fechaFinNormalizada = normalizarFecha(fechaFin)

    // Validaciones básicas
    if (!fechaInicioNormalizada || !fechaFinNormalizada) {
      toast({
        title: "Error",
        description: "Debe seleccionar fechas de inicio y fin",
        variant: "destructive",
      })
      return
    }

    if (fechaInicioNormalizada > fechaFinNormalizada) {
      toast({
        title: "Error",
        description: "La fecha de inicio no puede ser posterior a la fecha fin",
        variant: "destructive",
      })
      return
    }

    // Validar gastos
    const gastosInvalidos = gastosNuevos.some(
      gasto => !gasto.nombre || !gasto.cantidad || isNaN(parseFloat(gasto.cantidad.toString()))
    )

    if (gastosInvalidos) {
      toast({
        title: "Error",
        description: "Todos los gastos deben tener nombre y cantidad válida",
        variant: "destructive",
      })
      return
    }

    // Validar ingresos
    const ingresosInvalidos = ingresosNuevos.some(
      ingreso => !ingreso.nombre || !ingreso.cantidad || isNaN(parseFloat(ingreso.cantidad.toString()))
    )

    if (ingresosInvalidos) {
      toast({
        title: "Error",
        description: "Todos los ingresos deben tener nombre y cantidad válida",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const gananciaBruta = calcularGananciaBruta(fechaInicioNormalizada, fechaFinNormalizada, tipoSeleccion)
      const totalGastos = calcularTotalGastos(gastosNuevos)
      const totalIngresos = calcularTotalIngresos(ingresosNuevos)
      const gananciaNeta = gananciaBruta + totalIngresos - totalGastos

      const gastosProcesados = gastosNuevos.map(gasto => ({
        nombre: gasto.nombre,
        cantidad: parseFloat(gasto.cantidad.toString())
      }))

      const ingresosProcesados = ingresosNuevos.map(ingreso => ({
        nombre: ingreso.nombre,
        cantidad: parseFloat(ingreso.cantidad.toString())
      }))

      const balanceActualizado = {
        fechaInicio: fechaInicioNormalizada,
        fechaFin: fechaFinNormalizada,
        gananciaBruta,
        gastos: gastosProcesados,
        totalGastos,
        ingresos: ingresosProcesados,
        totalIngresos,
        gananciaNeta
      }

      // Llamar a la API de edición
      const balanceGuardado = await editarBalance(editandoBalance.id, balanceActualizado)

      // Actualizar el estado
      setBalances(prevBalances =>
        prevBalances.map(balance =>
          balance.id === editandoBalance.id ? balanceGuardado : balance
        )
      )

      // Resetear el formulario
      cancelarEdicion()

      toast({
        title: "Éxito",
        description: "Balance actualizado correctamente",
      })
    } catch (error) {
      console.error('Error al editar balance:', error)
      toast({
        title: "Error",
        description: "No se pudo actualizar el balance",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }


  const cancelarEdicion = () => {
    setEditandoBalance(null)
    setModoEdicion(false)
    setTipoSeleccion('periodo') // Agregar esta línea
    setFechaSeleccionada('') // Agregar esta línea
    setFechaInicio('')
    setFechaFin('')
    setGastosNuevos([{ nombre: '', cantidad: '' }])
    setPaso(1)
    setCrearDialogOpen(false)
    setIngresosNuevos([{ nombre: '', cantidad: '' }])
  }


  const abrirDetalleBalance = (balance: Balance) => {
    setBalanceSeleccionado(balance)
    setDetalleDialogOpen(true)
  }

  const cerrarCrearDialog = () => {
    if (modoEdicion) {
      cancelarEdicion()
    } else {
      setCrearDialogOpen(false)
      setPaso(1)
      setTipoSeleccion('periodo') // Agregar esta línea
      setFechaSeleccionada('') // Agregar esta línea
      setFechaInicio('')
      setFechaFin('')
      setGastosNuevos([{ nombre: '', cantidad: '' }])
      setIngresosNuevos([{ nombre: '', cantidad: '' }])
    }
  }

  if (isLoading) return <div className="flex justify-center items-center h-full">Cargando datos...</div>
  if (error) return <div className="text-red-500">{error}</div>

  return (
    <div className="space-y-4 relative pb-16">
      {/* Lista de balances */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xl flex items-center gap-2">
            <Wallet className="h-6 w-6 text-yellow-500" />
            Cálculos de Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {balances.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No hay cálculos de balance guardados</p>
              <p className="text-sm mt-2">Crea tu primer balance usando el botón +</p>
            </div>
          ) : (
            <div className="space-y-3">
              {balances.map(balance => (
                <div
                  key={balance.id}
                  className="flex justify-between items-center border-b pb-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                  onClick={() => abrirDetalleBalance(balance)}
                >
                  <div>
                    <p className="font-medium">
                      Balance {formatRangoFechas(balance.fechaInicio, balance.fechaFin)}
                    </p>

                    <p className="text-xs text-gray-500">
                      Creado el {formatDate(balance.fechaCreacion)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={balance.gananciaNeta >= 0 ? 'text-green-600' : 'text-red-600'}>
                      ${formatPrice(balance.gananciaNeta)}
                    </span>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Botón flotante para crear nuevo balance */}
      <Button
        className="rounded-full h-14 w-14 fixed bottom-6 right-6 shadow-lg"
        onClick={() => setCrearDialogOpen(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Dialog para ver detalle de balance */}
      <Dialog open={detalleDialogOpen} onOpenChange={setDetalleDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              Balance {balanceSeleccionado && formatRangoFechas(balanceSeleccionado.fechaInicio, balanceSeleccionado.fechaFin)}
            </DialogTitle>
          </DialogHeader>

          {balanceSeleccionado && (
            <div className="space-y-4">
              <div className="text-sm text-gray-600 border-b pb-2">
                <span className="font-medium">
                  {balanceSeleccionado.fechaInicio === balanceSeleccionado.fechaFin
                    ? `Balance del día ${formatDate(balanceSeleccionado.fechaInicio)}`
                    : `Balance del período ${formatDate(balanceSeleccionado.fechaInicio)} al ${formatDate(balanceSeleccionado.fechaFin)}`
                  }
                </span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="font-medium">Ganancia Bruta:</span>
                <span className="text-green-600 font-semibold">${formatPrice(balanceSeleccionado.gananciaBruta)}</span>
              </div>

              <div>
                <h3 className="font-medium mb-2">Ingresos Extras:</h3>
                <div className="space-y-2 pl-2 max-h-[200px] overflow-y-auto">
                  {balanceSeleccionado.ingresos?.map((ingreso, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span>{ingreso.nombre}</span>
                      <span className="text-blue-600">+${formatPrice(ingreso.cantidad)}</span>
                    </div>
                  )) || <p className="text-gray-500 text-sm">Sin ingresos extras</p>}
                </div>
                <div className="flex justify-between items-center border-t mt-2 pt-2">
                  <span className="font-medium">Total Ingresos:</span>
                  <span className="text-blue-600 font-semibold">+${formatPrice(balanceSeleccionado.totalIngresos || 0)}</span>
                </div>
              </div>


              <div>
                <h3 className="font-medium mb-2">Gastos:</h3>
                <div className="space-y-2 pl-2 max-h-[200px] overflow-y-auto">
                  {balanceSeleccionado.gastos.map((gasto, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span>{gasto.nombre}</span>
                      <span className="text-red-600">-${formatPrice(gasto.cantidad)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center border-t mt-2 pt-2">
                  <span className="font-medium">Total Gastos:</span>
                  <span className="text-red-600 font-semibold">-${formatPrice(balanceSeleccionado.totalGastos)}</span>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between items-center pt-2">
                <span className="font-bold text-lg">Ganancia Neta:</span>
                <span className={`text-2xl font-bold ${balanceSeleccionado.gananciaNeta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${formatPrice(balanceSeleccionado.gananciaNeta)}
                </span>
              </div>

              <DialogFooter className="mt-4 flex justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => iniciarEdicion(balanceSeleccionado)}
                >
                  <Edit className="h-4 w-4 mr-2" /> Editar Balance
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmarEliminarDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Eliminar Balance
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog para confirmar eliminación */}
      <Dialog open={confirmarEliminarDialogOpen} onOpenChange={setConfirmarEliminarDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>¿Estás seguro de que deseas eliminar este balance? Esta acción no se puede deshacer.</p>
          </div>
          <DialogFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setConfirmarEliminarDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={eliminarBalanceHandler}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para crear balance */}
      {/* Dialog para crear/editar balance */}
      <Dialog open={crearDialogOpen} onOpenChange={modoEdicion ? cancelarEdicion : cerrarCrearDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {modoEdicion ? 'Editar Balance' : 'Crear Nuevo Balance'}
            </DialogTitle>
          </DialogHeader>

          {paso === 1 && (
            <div className="space-y-4 py-4">
              <h3 className="font-medium">
                Paso 1: {modoEdicion ? 'Modifica' : 'Selecciona'} el tipo de balance
              </h3>

              {/* Selector de tipo */}
              <div className="space-y-3">
                <Label>Tipo de balance</Label>
                <div className="flex gap-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tipoBalance"
                      value="periodo"
                      checked={tipoSeleccion === 'periodo'}
                      onChange={(e) => setTipoSeleccion(e.target.value as 'periodo' | 'dia')}
                      className="w-4 h-4"
                    />
                    <span>Período</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tipoBalance"
                      value="dia"
                      checked={tipoSeleccion === 'dia'}
                      onChange={(e) => setTipoSeleccion(e.target.value as 'periodo' | 'dia')}
                      className="w-4 h-4"
                    />
                    <span>Día</span>
                  </label>
                </div>
              </div>

              {/* Campos de fecha según el tipo seleccionado */}
              {tipoSeleccion === 'periodo' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fechaInicio">Fecha Inicio</Label>
                    <Input
                      id="fechaInicio"
                      type="date"
                      value={fechaInicio}
                      onChange={(e) => setFechaInicio(normalizarFecha(e.target.value))}
                    />
                    <Label htmlFor="fechaFin">Fecha Fin</Label>
                    <Input
                      id="fechaFin"
                      type="date"
                      value={fechaFin}
                      onChange={(e) => setFechaFin(normalizarFecha(e.target.value))}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="fechaSeleccionada">Seleccionar Día</Label>
                  <Input
                    id="fechaSeleccionada"
                    type="date"
                    value={fechaSeleccionada}
                    onChange={(e) => {
                      const fechaNormalizada = normalizarFecha(e.target.value)
                      setFechaSeleccionada(fechaNormalizada)
                      setFechaInicio(fechaNormalizada)
                      setFechaFin(fechaNormalizada)
                    }}
                  />
                </div>
              )}

              {/* Mostrar ganancia bruta calculada */}
              {((tipoSeleccion === 'periodo' && fechaInicio && fechaFin && fechaInicio <= fechaFin) ||
                (tipoSeleccion === 'dia' && fechaSeleccionada)) && (
                  <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-700">
                      <strong>Ganancia Bruta del {tipoSeleccion === 'dia' ? 'día' : 'período'}:</strong>
                      ${formatPrice(calcularGananciaBruta(fechaInicio, fechaFin, tipoSeleccion))}
                    </p>
                  </div>
                )}

              <DialogFooter className="mt-4">
                {modoEdicion && (
                  <Button
                    variant="outline"
                    onClick={cancelarEdicion}
                  >
                    Cancelar
                  </Button>
                )}
                <Button
                  onClick={() => setPaso(2)}
                  disabled={
                    tipoSeleccion === 'periodo'
                      ? (!fechaInicio || !fechaFin)
                      : !fechaSeleccionada
                  }
                >
                  Siguiente
                </Button>
              </DialogFooter>
            </div>
          )}


          {paso === 2 && (
            <div className="space-y-4 py-4">
              <h3 className="font-medium">
                Paso 2: {modoEdicion ? 'Modifica' : 'Registra'} los gastos
              </h3>

              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                {gastosNuevos.map((gasto, index) => (
                  <div key={index} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                    <Input
                      placeholder="Nombre del gasto"
                      value={gasto.nombre}
                      onChange={(e) => actualizarGasto(index, 'nombre', e.target.value)}
                    />
                    <Input
                      type="number"
                      placeholder="0.00"
                      className="w-24"
                      value={gasto.cantidad}
                      onChange={(e) => actualizarGasto(index, 'cantidad', e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => eliminarGastoField(index)}
                      disabled={gastosNuevos.length === 1}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={agregarGastoField}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" /> Agregar otro gasto
              </Button>

              {/* Mostrar resumen de cálculos */}
              {fechaInicio && fechaFin && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Ganancia Bruta:</span>
                    <span className="text-green-600 font-medium">
                      ${formatPrice(calcularGananciaBruta(fechaInicio, fechaFin, tipoSeleccion))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Total Gastos:</span>
                    <span className="text-red-600 font-medium">
                      -${formatPrice(calcularTotalGastos(gastosNuevos))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t pt-2">
                    <span>Ganancia Neta:</span>
                    <span className={calcularGananciaBruta(fechaInicio, fechaFin, tipoSeleccion) - calcularTotalGastos(gastosNuevos) >= 0 ? 'text-green-600' : 'text-red-600'}>
                      ${formatPrice(calcularGananciaBruta(fechaInicio, fechaFin, tipoSeleccion) - calcularTotalGastos(gastosNuevos))}

                    </span>
                  </div>
                </div>
              )}

              <DialogFooter className="mt-4 flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setPaso(1)}
                >
                  Anterior
                </Button>
                <div className="flex gap-2">
                  {modoEdicion && (
                    <Button
                      variant="outline"
                      onClick={cancelarEdicion}
                    >
                      Cancelar
                    </Button>
                  )}
                  <Button
                    onClick={() => setPaso(3)}
                  >
                    Siguiente
                  </Button>
                </div>
              </DialogFooter>
            </div>
          )}

          {paso === 3 && (
            <div className="space-y-4 py-4">
              <h3 className="font-medium">
                Paso 3: {modoEdicion ? 'Modifica' : 'Registra'} los ingresos extras
              </h3>

              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                {ingresosNuevos.map((ingreso, index) => (
                  <div key={index} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                    <Input
                      placeholder="Nombre del ingreso"
                      value={ingreso.nombre}
                      onChange={(e) => actualizarIngreso(index, 'nombre', e.target.value)}
                    />
                    <Input
                      type="number"
                      placeholder="0.00"
                      className="w-24"
                      value={ingreso.cantidad}
                      onChange={(e) => actualizarIngreso(index, 'cantidad', e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => eliminarIngresoField(index)}
                      disabled={ingresosNuevos.length === 1}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={agregarIngresoField}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" /> Agregar otro ingreso
              </Button>

              {/* Resumen final */}
              {fechaInicio && fechaFin && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Ganancia Bruta:</span>
                    <span className="text-green-600 font-medium">
                      ${formatPrice(calcularGananciaBruta(fechaInicio, fechaFin, tipoSeleccion))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Total Ingresos:</span>
                    <span className="text-blue-600 font-medium">
                      +${formatPrice(calcularTotalIngresos(ingresosNuevos))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Total Gastos:</span>
                    <span className="text-red-600 font-medium">
                      -${formatPrice(calcularTotalGastos(gastosNuevos))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t pt-2">
                    <span>Ganancia Neta:</span>
                    <span className={calcularGananciaBruta(fechaInicio, fechaFin, tipoSeleccion) + calcularTotalIngresos(ingresosNuevos) - calcularTotalGastos(gastosNuevos) >= 0 ? 'text-green-600' : 'text-red-600'}>
                      ${formatPrice(calcularGananciaBruta(fechaInicio, fechaFin, tipoSeleccion) + calcularTotalIngresos(ingresosNuevos) - calcularTotalGastos(gastosNuevos))}
                    </span>
                  </div>
                </div>
              )}

              <DialogFooter className="mt-4 flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setPaso(2)}
                >
                  Anterior
                </Button>
                <div className="flex gap-2">
                  {modoEdicion && (
                    <Button
                      variant="outline"
                      onClick={cancelarEdicion}
                    >
                      Cancelar
                    </Button>
                  )}
                  <Button
                    onClick={modoEdicion ? guardarEdicion : crearNuevoBalance}
                    disabled={isSubmitting}
                  >
                    {isSubmitting
                      ? (modoEdicion ? 'Guardando...' : 'Creando...')
                      : (modoEdicion ? 'Guardar Cambios' : 'Crear Balance')
                    }
                  </Button>
                </div>
              </DialogFooter>
            </div>
          )}

        </DialogContent>
      </Dialog>
    </div>
  )
}
