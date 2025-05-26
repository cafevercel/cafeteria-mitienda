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
import { getAllVentas, getInventario, getGastos, crearBalance, eliminarBalance, getBalances } from '@/app/services/api'
import { Venta, Producto, Gasto, Balance, GastoBalance } from '@/types'
import { Wallet, Plus, X, Calendar, ChevronRight, FileText, Trash2 } from 'lucide-react'
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

  const calcularVentasDiarias = (ventas: Venta[], productos: Producto[]): VentaDia[] => {
    const ventasPorDia: { [key: string]: VentaDia } = {}

    ventas.forEach(venta => {
      const fechaObj = new Date(venta.fecha)
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
      new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
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

  const calcularGananciaBruta = (fechaInicio: string, fechaFin: string): number => {
    return ventasDiarias
      .filter(dia => {
        const fecha = dia.fecha
        return fecha >= fechaInicio && fecha <= fechaFin
      })
      .reduce((sum, dia) => sum + dia.ganancia, 0)
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
    // Validaciones
    if (!fechaInicio || !fechaFin) {
      toast({
        title: "Error",
        description: "Debe seleccionar fechas de inicio y fin",
        variant: "destructive",
      })
      return
    }

    if (fechaInicio > fechaFin) {
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
      const gananciaBruta = calcularGananciaBruta(fechaInicio, fechaFin)
      const totalGastos = calcularTotalGastos(gastosNuevos)
      const gananciaNeta = gananciaBruta - totalGastos

      const gastosProcesados = gastosNuevos.map(gasto => ({
        nombre: gasto.nombre,
        cantidad: parseFloat(gasto.cantidad.toString())
      }))

      const nuevoBalance = {
        fechaInicio,
        fechaFin,
        gananciaBruta,
        gastos: gastosProcesados,
        totalGastos,
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

  const abrirDetalleBalance = (balance: Balance) => {
    setBalanceSeleccionado(balance)
    setDetalleDialogOpen(true)
  }

  const cerrarCrearDialog = () => {
    setCrearDialogOpen(false)
    setPaso(1)
    setFechaInicio('')
    setFechaFin('')
    setGastosNuevos([{ nombre: '', cantidad: '' }])
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
                      Balance {formatDate(balance.fechaInicio)} - {formatDate(balance.fechaFin)}
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
              Balance {balanceSeleccionado && formatDate(balanceSeleccionado.fechaInicio)} - {balanceSeleccionado && formatDate(balanceSeleccionado.fechaFin)}
            </DialogTitle>
          </DialogHeader>

          {balanceSeleccionado && (
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="font-medium">Ganancia Bruta:</span>
                <span className="text-green-600 font-semibold">${formatPrice(balanceSeleccionado.gananciaBruta)}</span>
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

              <DialogFooter className="mt-4">
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
      <Dialog open={crearDialogOpen} onOpenChange={cerrarCrearDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Balance</DialogTitle>
          </DialogHeader>

          {paso === 1 && (
            <div className="space-y-4 py-4">
              <h3 className="font-medium">Paso 1: Selecciona el período</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fechaInicio">Fecha Inicio</Label>
                  <Input
                    id="fechaInicio"
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fechaFin">Fecha Fin</Label>
                  <Input
                    id="fechaFin"
                    type="date"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button
                  onClick={() => setPaso(2)}
                  disabled={!fechaInicio || !fechaFin}
                >
                  Siguiente
                </Button>
              </DialogFooter>
            </div>
          )}

          {paso === 2 && (
            <div className="space-y-4 py-4">
              <h3 className="font-medium">Paso 2: Registra los gastos</h3>

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

              <DialogFooter className="mt-4 flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setPaso(1)}
                >
                  Anterior
                </Button>
                <Button
                  onClick={crearNuevoBalance}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Guardando...' : 'Crear Balance'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
