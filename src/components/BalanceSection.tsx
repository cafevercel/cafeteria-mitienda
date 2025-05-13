'use client'

import { useState, useEffect } from 'react'
import { format, parseISO, isValid } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getAllVentas, getInventario, getGastos, crearGasto, eliminarGasto } from '@/app/services/api'
import { Venta, Producto, Gasto } from '@/types'
import { Wallet, Plus, X, Calendar } from 'lucide-react'
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
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [nuevoGasto, setNuevoGasto] = useState({ nombre: '', cantidad: '' })
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('ganancias')

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        // Cargar ventas, productos y gastos
        const [ventas, inventario, gastosData] = await Promise.all([
          getAllVentas(),
          getInventario(),
          getGastos()
        ])
        
        // Agrupar ventas por día y calcular ganancias
        const ventasPorDia = calcularVentasDiarias(ventas, inventario)
        setVentasDiarias(ventasPorDia)
        setGastos(gastosData)
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

      // Buscar el producto para obtener su precio de compra
      const producto = productos.find(p => p.id === venta.producto)
      
      // Calcular la ganancia bruta para esta venta (precio de venta - precio de compra)
      const precioCompra = producto?.precio_compra || 0
      const precioVenta = parseFloat(venta.precio_unitario.toString())
      const gananciaUnitaria = precioVenta - precioCompra
      const gananciaTotal = gananciaUnitaria * venta.cantidad

      ventasPorDia[fechaKey].ventas.push(venta)
      ventasPorDia[fechaKey].total += parseFloat(venta.total.toString())
      ventasPorDia[fechaKey].ganancia += gananciaTotal
    })

    return Object.values(ventasPorDia).sort((a, b) => 
      new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    )
  }

  const agregarGasto = async () => {
    if (!nuevoGasto.nombre || !nuevoGasto.cantidad || isNaN(parseFloat(nuevoGasto.cantidad))) {
      toast({
        title: "Error",
        description: "Debe proporcionar un nombre y una cantidad válida",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const gastoData = {
        nombre: nuevoGasto.nombre,
        cantidad: parseFloat(nuevoGasto.cantidad),
        fecha: new Date().toISOString()
      }

      // Crear gasto en la base de datos
      const nuevoGastoGuardado = await crearGasto(gastoData)
      
      // Actualizar el estado
      setGastos(prevGastos => [nuevoGastoGuardado, ...prevGastos])
      setNuevoGasto({ nombre: '', cantidad: '' })
      setDialogOpen(false)
      
      toast({
        title: "Éxito",
        description: "Gasto registrado correctamente",
      })
    } catch (error) {
      console.error('Error al registrar gasto:', error)
      toast({
        title: "Error",
        description: "No se pudo registrar el gasto",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const eliminarGastoHandler = async (id: string) => {
    try {
      await eliminarGasto(id)
      setGastos(gastos.filter(gasto => gasto.id !== id))
      toast({
        title: "Éxito",
        description: "Gasto eliminado correctamente",
      })
    } catch (error) {
      console.error('Error al eliminar gasto:', error)
      toast({
        title: "Error",
        description: "No se pudo eliminar el gasto",
        variant: "destructive",
      })
    }
  }

  const calcularGananciaNeta = (): number => {
    const totalGanancias = ventasDiarias.reduce((sum, dia) => sum + dia.ganancia, 0)
    const totalGastos = gastos.reduce((sum, gasto) => sum + gasto.cantidad, 0)
    return totalGanancias - totalGastos
  }

  if (isLoading) return <div className="flex justify-center items-center h-full">Cargando datos...</div>
  if (error) return <div className="text-red-500">{error}</div>

  return (
    <div className="space-y-4">
      {/* Tarjeta de Ganancia Neta */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl flex items-center gap-2">
            <Wallet className="h-6 w-6 text-yellow-500" />
            Ganancia Neta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-3xl font-bold ${calcularGananciaNeta() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${formatPrice(calcularGananciaNeta())}
          </p>
        </CardContent>
      </Card>

      {/* Tabs para Ganancias y Gastos */}
      <Tabs defaultValue="ganancias" onValueChange={setActiveTab} value={activeTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ganancias">Ganancias Brutas</TabsTrigger>
          <TabsTrigger value="gastos">Gastos</TabsTrigger>
        </TabsList>

        {/* Pestaña de Ganancias Brutas */}
        <TabsContent value="ganancias" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ganancias por Día</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ventasDiarias.length === 0 ? (
                  <p className="text-center py-4 text-gray-500">No hay datos de ventas disponibles</p>
                ) : (
                  ventasDiarias.map(dia => (
                    <div 
                      key={dia.fecha} 
                      className="flex justify-between items-center border-b pb-2"
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">{formatDate(dia.fecha)}</span>
                      </div>
                      <span className="text-green-600 font-semibold">${formatPrice(dia.ganancia)}</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pestaña de Gastos */}
        <TabsContent value="gastos" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">Gastos Registrados</CardTitle>
                <Button 
                  onClick={() => setDialogOpen(true)} 
                  size="sm" 
                  className="rounded-full h-8 w-8 p-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {gastos.length === 0 ? (
                  <p className="text-center py-4 text-gray-500">No hay gastos registrados</p>
                ) : (
                  gastos.map(gasto => (
                    <div 
                      key={gasto.id} 
                      className="flex justify-between items-center border-b pb-2"
                    >
                      <div>
                        <p className="font-medium">{gasto.nombre}</p>
                        <p className="text-xs text-gray-500">{formatDate(gasto.fecha)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-red-600 font-semibold">-${formatPrice(gasto.cantidad)}</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => eliminarGastoHandler(gasto.id)} 
                          className="h-6 w-6"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog para Añadir Gasto */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Registrar Nuevo Gasto</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="nombre" className="text-right">
                Nombre
              </Label>
              <Input
                id="nombre"
                placeholder="Descripción del gasto"
                value={nuevoGasto.nombre}
                onChange={(e) => setNuevoGasto({ ...nuevoGasto, nombre: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cantidad" className="text-right">
                Cantidad
              </Label>
              <Input
                id="cantidad"
                type="number"
                placeholder="0.00"
                value={nuevoGasto.cantidad}
                onChange={(e) => setNuevoGasto({ ...nuevoGasto, cantidad: e.target.value })}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={agregarGasto} disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 