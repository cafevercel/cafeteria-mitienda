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
import { Wallet, Plus, X, Calendar, ChevronRight, FileText, Trash2, Edit, Eye } from 'lucide-react'
import { toast } from "@/hooks/use-toast"

interface VentaDia {
  fecha: string
  ventas: Venta[]
  total: number
  ganancia: number
}

interface GastoExistente {
  id: string
  nombre: string
  cantidad: number
  fecha: string
  fechaCreacion?: string
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
    if (fechaInicio === fechaFin) {
      return formatDate(fechaInicio)
    }
    return `${formatDate(fechaInicio)} - ${formatDate(fechaFin)}`
  } catch (error) {
    console.error('Error al formatear rango de fechas:', error)
    return 'Fechas inválidas'
  }
}

const normalizarFecha = (fechaString: string): string => {
  if (!fechaString) return fechaString;

  const fecha = new Date(fechaString + 'T00:00:00');
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export default function BalanceSection() {
  const [ventasDiarias, setVentasDiarias] = useState<VentaDia[]>([])
  const [balances, setBalances] = useState<Balance[]>([])
  const [gastosExistentes, setGastosExistentes] = useState<GastoExistente[]>([])
  const [gastosDelPeriodo, setGastosDelPeriodo] = useState<GastoExistente[]>([])
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
        // Cargar ventas, productos, gastos y balances existentes
        const [ventas, inventario, gastos, balancesData] = await Promise.all([
          getAllVentas(),
          getInventario(),
          getGastos(),
          getBalances()
        ])

        // Agrupar ventas por día y calcular ganancias
        const ventasPorDia = calcularVentasDiarias(ventas, inventario)
        setVentasDiarias(ventasPorDia)
        setBalances(balancesData)

        // Procesar gastos existentes
        const gastosFormateados = gastos.map(gasto => ({
          id: gasto.id.toString(),
          nombre: gasto.nombre,
          cantidad: gasto.cantidad,
          fecha: normalizarFecha(gasto.fecha.split('T')[0]),
          fechaCreacion: gasto.fecha
        }))
        setGastosExistentes(gastosFormateados)
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

  // Efecto para cargar gastos del período cuando cambien las fechas
  useEffect(() => {
    if (fechaInicio && fechaFin) {
      const gastosFiltrados = gastosExistentes.filter(gasto => {
        return gasto.fecha >= fechaInicio && gasto.fecha <= fechaFin
      })
      setGastosDelPeriodo(gastosFiltrados)

      // Si no estamos en modo edición, cargar automáticamente los gastos
      if (!modoEdicion) {
        const gastosFormateados = gastosFiltrados.map(gasto => ({
          nombre: gasto.nombre,
          cantidad: gasto.cantidad.toString()
        }))

        // Si hay gastos del período, agregarlos a los gastos nuevos
        if (gastosFormateados.length > 0) {
          setGastosNuevos([...gastosFormateados, { nombre: '', cantidad: '' }])
        }
      }
    } else {
      setGastosDelPeriodo([])
    }
  }, [fechaInicio, fechaFin, gastosExistentes, modoEdicion])

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
      const fechaKey = normalizarFecha(venta.fecha.split('T')[0])

      if (!ventasPorDia[fechaKey]) {
        ventasPorDia[fechaKey] = {
          fecha: fechaKey,
          ventas: [],
          total: 0,
          ganancia: 0
        }
      }

      const producto = productos.find(p => p.id === venta.producto)
      const precioCompra = producto?.precio_compra || 0
      const precioVenta = parseFloat(venta.precio_unitario.toString())

      let gananciaUnitaria = precioVenta - precioCompra

      if (producto?.porcentajeGanancia) {
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
      const diaSeleccionado = ventasDiarias.find(dia => dia.fecha === fechaInicio)
      return diaSeleccionado ? diaSeleccionado.ganancia : 0
    } else {
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

  const calcularTotalGastosExistentes = (gastos: GastoExistente[]): number => {
    return gastos.reduce((sum, gasto) => sum + gasto.cantidad, 0)
  }

  const crearNuevoBalance = async () => {
    const fechaInicioNormalizada = normalizarFecha(fechaInicio)
    const fechaFinNormalizada = normalizarFecha(fechaFin)

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
      const gananciaNeta = gananciaBruta + totalIngresos - totalGastos

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
        ingresos: ingresosProcesados,
        totalIngresos,
        gananciaNeta,
        fechaCreacion: new Date().toISOString()
      }

      const balanceGuardado = await crearBalance(nuevoBalance)
      setBalances(prevBalances => [balanceGuardado, ...prevBalances])

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

    const esDiaUnico = balance.fechaInicio === balance.fechaFin
    setTipoSeleccion(esDiaUnico ? 'dia' : 'periodo')

    setFechaInicio(balance.fechaInicio)
    setFechaFin(balance.fechaFin)

    if (esDiaUnico) {
      setFechaSeleccionada(balance.fechaInicio)
    }
    setGastosNuevos(balance.gastos.map(g => ({
      nombre: g.nombre,
      cantidad: g.cantidad.toString()
    })))
    setPaso(1)
    setDetalleDialogOpen(false)
    setCrearDialogOpen(true)
    setIngresosNuevos(balance.ingresos?.map(i => ({
      nombre: i.nombre,
      cantidad: i.cantidad.toString()
    })) || [{ nombre: '', cantidad: '' }])
  }

  const guardarEdicion = async () => {
    if (!editandoBalance) return;

    const fechaInicioNormalizada = normalizarFecha(fechaInicio)
    const fechaFinNormalizada = normalizarFecha(fechaFin)

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

      const balanceGuardado = await editarBalance(editandoBalance.id, balanceActualizado)

      setBalances(prevBalances =>
        prevBalances.map(balance =>
          balance.id === editandoBalance.id ? balanceGuardado : balance
        )
      )

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
    setTipoSeleccion('periodo')
    setFechaSeleccionada('')
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
      setTipoSeleccion('periodo')
      setFechaSeleccionada('')
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
      {/* Dialog para ver detalle de balance */}
      <Dialog open={detalleDialogOpen} onOpenChange={setDetalleDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              Balance {balanceSeleccionado && formatRangoFechas(balanceSeleccionado.fechaInicio, balanceSeleccionado.fechaFin)}
            </DialogTitle>
          </DialogHeader>

          {balanceSeleccionado && (
            <div className="flex-1 overflow-y-auto space-y-4 py-2">
              <div className="text-sm text-gray-600 border-b pb-2 flex-shrink-0">
                <span className="font-medium">
                  {balanceSeleccionado.fechaInicio === balanceSeleccionado.fechaFin
                    ? `Balance del día ${formatDate(balanceSeleccionado.fechaInicio)}`
                    : `Balance del período ${formatDate(balanceSeleccionado.fechaInicio)} al ${formatDate(balanceSeleccionado.fechaFin)}`
                  }
                </span>
              </div>

              <div className="flex justify-between items-center border-b pb-2 flex-shrink-0">
                <span className="font-medium">Ganancia Bruta:</span>
                <span className="text-green-600 font-semibold">${formatPrice(balanceSeleccionado.gananciaBruta)}</span>
              </div>

              <div className="flex-shrink-0">
                <h3 className="font-medium mb-2">Ingresos Extras:</h3>
                <div className="space-y-2 pl-2 max-h-[150px] overflow-y-auto border rounded-md p-2 bg-gray-50">
                  {(balanceSeleccionado.ingresos && Array.isArray(balanceSeleccionado.ingresos)
                    ? balanceSeleccionado.ingresos
                    : []
                  ).length > 0 ? (
                    (balanceSeleccionado.ingresos || []).map((ingreso, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-sm">{ingreso.nombre}</span>
                        <span className="text-blue-600 text-sm">+${formatPrice(ingreso.cantidad)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm">Sin ingresos extras</p>
                  )}
                </div>
                <div className="flex justify-between items-center border-t mt-2 pt-2">
                  <span className="font-medium">Total Ingresos:</span>
                  <span className="text-blue-600 font-semibold">+${formatPrice(balanceSeleccionado.totalIngresos || 0)}</span>
                </div>
              </div>

              <div className="flex-shrink-0">
                <h3 className="font-medium mb-2">Gastos:</h3>
                <div className="space-y-2 pl-2 max-h-[150px] overflow-y-auto border rounded-md p-2 bg-gray-50">
                  {balanceSeleccionado.gastos.map((gasto, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-sm">{gasto.nombre}</span>
                      <span className="text-red-600 text-sm">-${formatPrice(gasto.cantidad)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center border-t mt-2 pt-2">
                  <span className="font-medium">Total Gastos:</span>
                  <span className="text-red-600 font-semibold">-${formatPrice(balanceSeleccionado.totalGastos)}</span>
                </div>
              </div>

              <Separator className="flex-shrink-0" />

              <div className="flex justify-between items-center pt-2 flex-shrink-0">
                <span className="font-bold text-lg">Ganancia Neta:</span>
                <span className={`text-2xl font-bold ${balanceSeleccionado.gananciaNeta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${formatPrice(balanceSeleccionado.gananciaNeta)}
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="flex-shrink-0 mt-4 flex flex-col sm:flex-row gap-2 sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => balanceSeleccionado && iniciarEdicion(balanceSeleccionado)}
              className="w-full sm:w-auto"
            >
              <Edit className="h-4 w-4 mr-2" /> Editar Balance
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmarEliminarDialogOpen(true)}
              className="w-full sm:w-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Eliminar Balance
            </Button>
          </DialogFooter>

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

              {/* Mostrar gastos existentes del período */}
              {gastosDelPeriodo.length > 0 && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="h-4 w-4 text-blue-600" />
                    <h4 className="font-medium text-blue-800">
                      Gastos ya registrados en este {tipoSeleccion === 'dia' ? 'día' : 'período'}:
                    </h4>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {gastosDelPeriodo.map((gasto, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <span className="text-blue-700">{gasto.nombre}</span>
                        <span className="text-blue-600 font-medium">${formatPrice(gasto.cantidad)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center border-t border-blue-200 mt-2 pt-2">
                    <span className="font-medium text-blue-800">Total:</span>
                    <span className="font-bold text-blue-600">
                      ${formatPrice(calcularTotalGastosExistentes(gastosDelPeriodo))}
                    </span>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    Estos gastos se incluirán automáticamente en el siguiente paso.
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

              {/* Mostrar información de gastos precargados */}
              {!modoEdicion && gastosDelPeriodo.length > 0 && (
                <div className="mb-4 p-2 bg-blue-50 rounded border border-blue-200">
                  <p className="text-xs text-blue-600">
                    Se han cargado automáticamente {gastosDelPeriodo.length} gasto(s) ya registrado(s) para este período.
                  </p>
                </div>
              )}

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

              <DialogFooter className="mt-4 flex flex-col sm:flex-row gap-2 sm:justify-between">
                <Button
                  variant="outline"
                  onClick={() => setPaso(1)}
                  className="w-full sm:w-auto"
                >
                  Anterior
                </Button>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  {modoEdicion && (
                    <Button
                      variant="outline"
                      onClick={cancelarEdicion}
                      className="w-full sm:w-auto"
                    >
                      Cancelar
                    </Button>
                  )}
                  <Button
                    onClick={() => setPaso(3)}
                    className="w-full sm:w-auto"
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

              <DialogFooter className="mt-4 flex flex-col sm:flex-row gap-2 sm:justify-between">
                <Button
                  variant="outline"
                  onClick={() => setPaso(2)}
                  className="w-full sm:w-auto"
                >
                  Anterior
                </Button>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  {modoEdicion && (
                    <Button
                      variant="outline"
                      onClick={cancelarEdicion}
                      className="w-full sm:w-auto"
                    >
                      Cancelar
                    </Button>
                  )}
                  <Button
                    onClick={modoEdicion ? guardarEdicion : crearNuevoBalance}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto"
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
