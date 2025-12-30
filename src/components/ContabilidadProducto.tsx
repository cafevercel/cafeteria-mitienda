'use client'

import { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { FileSpreadsheet, ArrowUpDown, CalendarDays, X, Calendar, ChevronDown } from "lucide-react"
import { getVendedores, getVentasVendedor } from '@/app/services/api'
import { toast } from "@/hooks/use-toast"
import { Vendedor, Venta, Producto } from '@/types'
import React from 'react'

interface ContabilidadProductoProps {
  inventario: Producto[]
}

export default function ContabilidadProducto({ inventario }: ContabilidadProductoProps) {
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [ventasGlobales, setVentasGlobales] = useState<Venta[]>([])
  const [isLoadingContabilidad, setIsLoadingContabilidad] = useState(false)
  const [searchTermContabilidad, setSearchTermContabilidad] = useState("")
  const [sortOrderContabilidad, setSortOrderContabilidad] = useState<'asc' | 'desc'>('desc')
  const [expandedContabilidadProducts, setExpandedContabilidadProducts] = useState<Record<string, boolean>>({})
  const [fechaInicio, setFechaInicio] = useState<Date | null>(null)
  const [fechaFin, setFechaFin] = useState<Date | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)

  // Cargar vendedores
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

  // Cargar todas las ventas
  const fetchAllSales = useCallback(async () => {
    setIsLoadingContabilidad(true)
    try {
      const allSales: Venta[] = []

      for (const vendedor of vendedores) {
        try {
          const ventasVendedor = await getVentasVendedor(vendedor.id)
          const ventasConVendedor = ventasVendedor.map(venta => ({
            ...venta,
            vendedor_nombre: vendedor.nombre,
            vendedor_id: vendedor.id
          }))
          allSales.push(...ventasConVendedor)
        } catch (error) {
          console.error(`Error al obtener ventas del vendedor ${vendedor.nombre}:`, error)
        }
      }

      allSales.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      setVentasGlobales(allSales)
    } catch (error) {
      console.error('Error al obtener todas las ventas:', error)
      toast({
        title: "Error",
        description: "Error al cargar la contabilidad por producto",
        variant: "destructive",
      })
    } finally {
      setIsLoadingContabilidad(false)
    }
  }, [vendedores])

  useEffect(() => {
    fetchVendedores()
  }, [fetchVendedores])

  useEffect(() => {
    if (vendedores.length > 0) {
      fetchAllSales()
    }
  }, [vendedores, fetchAllSales])

  const toggleExpandContabilidad = useCallback((productName: string) => {
    setExpandedContabilidadProducts(prev => ({
      ...prev,
      [productName]: !prev[productName]
    }))
  }, [])

  const getContabilidadData = useCallback(() => {
    const ventasFiltradas = (fechaInicio || fechaFin)
      ? ventasGlobales.filter(venta => {
        const fechaVenta = new Date(venta.fecha)
        const cumpleFechaInicio = !fechaInicio || fechaVenta >= fechaInicio
        const cumpleFechaFin = !fechaFin || fechaVenta <= fechaFin
        return cumpleFechaInicio && cumpleFechaFin
      })
      : ventasGlobales

    const ventasPorProducto = ventasFiltradas.reduce((acc, venta) => {
      const key = venta.producto_nombre

      if (!acc[key]) {
        acc[key] = {
          producto: venta.producto_nombre,
          cantidadTotal: 0,
          montoTotal: 0,
          ventas: [],
          parametros: new Map<string, { cantidad: number; monto: number }>(),
          tieneParametros: false
        }
      }

      if (venta.parametros && venta.parametros.length > 0) {
        acc[key].tieneParametros = true

        venta.parametros.forEach(param => {
          if (param.cantidad > 0) {
            const parametroKey = param.nombre
            const montoParametro = (parseFloat(venta.total.toString()) / venta.parametros!.reduce((sum, p) => sum + p.cantidad, 0)) * param.cantidad

            if (!acc[key].parametros.has(parametroKey)) {
              acc[key].parametros.set(parametroKey, { cantidad: 0, monto: 0 })
            }

            const parametroData = acc[key].parametros.get(parametroKey)!
            parametroData.cantidad += param.cantidad
            parametroData.monto += montoParametro
          }
        })

        const cantidadVenta = venta.parametros.reduce((sum, param) => sum + param.cantidad, 0)
        acc[key].cantidadTotal += cantidadVenta
      } else {
        acc[key].cantidadTotal += venta.cantidad
      }

      acc[key].montoTotal += parseFloat(venta.total.toString())
      acc[key].ventas.push(venta)

      return acc
    }, {} as Record<string, {
      producto: string
      cantidadTotal: number
      montoTotal: number
      ventas: Venta[]
      parametros: Map<string, { cantidad: number; monto: number }>
      tieneParametros: boolean
    }>)

    const resultados = Object.values(ventasPorProducto)
      .filter(item =>
        item.producto.toLowerCase().includes(searchTermContabilidad.toLowerCase())
      )
      .sort((a, b) => {
        if (sortOrderContabilidad === 'asc') {
          return a.montoTotal - b.montoTotal
        } else {
          return b.montoTotal - a.montoTotal
        }
      })

    return resultados
  }, [ventasGlobales, searchTermContabilidad, sortOrderContabilidad, fechaInicio, fechaFin])

  const exportContabilidadToExcel = useCallback(() => {
    const data = getContabilidadData()
    const dataToExport: any[] = []

    if (fechaInicio || fechaFin) {
      let filtroTexto = 'FILTRO APLICADO - '
      if (fechaInicio && fechaFin) {
        filtroTexto += `Desde: ${format(fechaInicio, 'dd/MM/yyyy')} hasta: ${format(fechaFin, 'dd/MM/yyyy')}`
      } else if (fechaInicio) {
        filtroTexto += `Desde: ${format(fechaInicio, 'dd/MM/yyyy')}`
      } else if (fechaFin) {
        filtroTexto += `Hasta: ${format(fechaFin, 'dd/MM/yyyy')}`
      }

      dataToExport.push({
        Producto: filtroTexto,
        Parametro: '-',
        'Cantidad Total Vendida': '-',
        'Monto Total': '-',
        'Número de Ventas': '-'
      })
      dataToExport.push({})
    }

    data.forEach(item => {
      if (item.tieneParametros && item.parametros.size > 0) {
        dataToExport.push({
          Producto: item.producto,
          Parametro: 'TOTAL',
          'Cantidad Total Vendida': item.cantidadTotal,
          'Monto Total': item.montoTotal.toFixed(2),
          'Número de Ventas': item.ventas.length
        })

        Array.from(item.parametros.entries()).forEach(([parametroNombre, parametroData]) => {
          dataToExport.push({
            Producto: `  └─ ${item.producto}`,
            Parametro: parametroNombre,
            'Cantidad Total Vendida': parametroData.cantidad,
            'Monto Total': parametroData.monto.toFixed(2),
            'Número de Ventas': '-'
          })
        })
      } else {
        dataToExport.push({
          Producto: item.producto,
          Parametro: '-',
          'Cantidad Total Vendida': item.cantidadTotal,
          'Monto Total': item.montoTotal.toFixed(2),
          'Número de Ventas': item.ventas.length
        })
      }
    })

    const totalCantidad = data.reduce((sum, item) => sum + item.cantidadTotal, 0)
    const totalMonto = data.reduce((sum, item) => sum + item.montoTotal, 0)

    dataToExport.push({
      Producto: 'TOTAL GENERAL',
      Parametro: '-',
      'Cantidad Total Vendida': totalCantidad,
      'Monto Total': totalMonto.toFixed(2),
      'Número de Ventas': data.reduce((sum, item) => sum + item.ventas.length, 0)
    })

    const ws = XLSX.utils.json_to_sheet(dataToExport)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Contabilidad por producto")

    let fileName = 'contabilidad_global_'
    if (fechaInicio && fechaFin) {
      fileName += `${format(fechaInicio, 'yyyy-MM-dd')}_a_${format(fechaFin, 'yyyy-MM-dd')}_`
    } else if (fechaInicio) {
      fileName += `desde_${format(fechaInicio, 'yyyy-MM-dd')}_`
    } else if (fechaFin) {
      fileName += `hasta_${format(fechaFin, 'yyyy-MM-dd')}_`
    }
    fileName += `${format(new Date(), 'yyyy-MM-dd')}.xlsx`

    XLSX.writeFile(wb, fileName)
  }, [getContabilidadData, fechaInicio, fechaFin])

  const limpiarFiltroFechas = () => {
    setFechaInicio(null)
    setFechaFin(null)
    setShowDatePicker(false)
  }

  const validarRangoFechas = (inicio: Date | null, fin: Date | null): string | null => {
    if (inicio && fin && inicio > fin) {
      return "La fecha de inicio no puede ser posterior a la fecha de fin"
    }
    return null
  }

  const createDisabledMatcher = (fechaComparacion: Date | null, tipo: 'before' | 'after') => {
    return (date: Date): boolean => {
      const today = new Date()
      const minDate = new Date("1900-01-01")

      if (date > today || date < minDate) {
        return true
      }

      if (fechaComparacion) {
        if (tipo === 'before') {
          return date > fechaComparacion
        } else {
          return date < fechaComparacion
        }
      }

      return false
    }
  }

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
        <h2 className="text-xl font-bold">Contabilidad por producto</h2>
        <Button
          onClick={exportContabilidadToExcel}
          className="bg-green-500 hover:bg-green-600 text-white"
          disabled={isLoadingContabilidad}
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Exportar Excel
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumen de Ventas por Producto</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Buscar producto..."
              value={searchTermContabilidad}
              onChange={(e) => setSearchTermContabilidad(e.target.value)}
              className="max-w-sm"
            />

            <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[280px] justify-start text-left font-normal",
                    (!fechaInicio && !fechaFin) && "text-muted-foreground"
                  )}
                >
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {fechaInicio || fechaFin ? (
                    <span className="truncate">
                      {fechaInicio && fechaFin
                        ? `${format(fechaInicio, 'dd/MM/yyyy')} - ${format(fechaFin, 'dd/MM/yyyy')}`
                        : fechaInicio
                          ? `Desde: ${format(fechaInicio, 'dd/MM/yyyy')}`
                          : fechaFin
                            ? `Hasta: ${format(fechaFin, 'dd/MM/yyyy')}`
                            : ""
                      }
                    </span>
                  ) : (
                    "Seleccionar rango de fechas"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-4 space-y-4">
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Seleccionar rango de fechas
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-gray-600">Fecha de inicio:</label>
                    <CalendarComponent
                      mode="single"
                      selected={fechaInicio || undefined}
                      onSelect={(date) => {
                        setFechaInicio(date || null)
                        if (date && fechaFin && date > fechaFin) {
                          setFechaFin(null)
                        }
                      }}
                      disabled={createDisabledMatcher(fechaFin, 'before')}
                      initialFocus
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-gray-600">Fecha de fin:</label>
                    <CalendarComponent
                      mode="single"
                      selected={fechaFin || undefined}
                      onSelect={(date) => {
                        setFechaFin(date || null)
                        if (date && fechaInicio && date < fechaInicio) {
                          setFechaInicio(null)
                        }
                      }}
                      disabled={createDisabledMatcher(fechaInicio, 'after')}
                    />
                  </div>

                  {validarRangoFechas(fechaInicio, fechaFin) && (
                    <div className="text-xs text-red-500 bg-red-50 p-2 rounded">
                      {validarRangoFechas(fechaInicio, fechaFin)}
                    </div>
                  )}

                  <div className="flex space-x-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={limpiarFiltroFechas}
                    >
                      Limpiar
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => setShowDatePicker(false)}
                      disabled={!!validarRangoFechas(fechaInicio, fechaFin)}
                    >
                      Aplicar
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              variant="outline"
              onClick={() => setSortOrderContabilidad(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="flex items-center"
            >
              Ordenar por monto
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </div>

          {(fechaInicio || fechaFin) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center text-blue-700">
                  <Calendar className="mr-2 h-4 w-4" />
                  <span className="text-sm font-medium">
                    {fechaInicio && fechaFin
                      ? `Período: ${format(fechaInicio, 'dd/MM/yyyy')} - ${format(fechaFin, 'dd/MM/yyyy')}`
                      : fechaInicio
                        ? `Desde: ${format(fechaInicio, 'dd/MM/yyyy')}`
                        : fechaFin
                          ? `Hasta: ${format(fechaFin, 'dd/MM/yyyy')}`
                          : ""
                    }
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={limpiarFiltroFechas}
                  className="text-blue-700 hover:text-blue-900"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {isLoadingContabilidad ? (
            <div className="flex justify-center items-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
                <p>Cargando datos de contabilidad...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <div className="border rounded-lg">
                  <div className="max-h-[500px] overflow-y-auto">
                    <table className="w-full border-collapse">
                      <thead className="sticky top-0 bg-white border-b">
                        <tr>
                          <th className="text-left p-3 font-medium">Producto</th>
                          <th className="text-right p-3 font-medium">Cantidad Total</th>
                          <th className="text-right p-3 font-medium">Monto Total</th>
                          <th className="text-right p-3 font-medium">N° Ventas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getContabilidadData().length === 0 ? (
                          <tr>
                            <td colSpan={4} className="text-center py-8 text-gray-500">
                              {searchTermContabilidad
                                ? 'No se encontraron productos que coincidan con la búsqueda.'
                                : (fechaInicio || fechaFin)
                                  ? `No hay datos de ventas en el período seleccionado.`
                                  : 'No hay datos de ventas disponibles.'}
                            </td>
                          </tr>
                        ) : (
                          getContabilidadData().map((item, index) => (
                            <React.Fragment key={index}>
                              <tr
                                className={`border-b hover:bg-gray-50 ${item.tieneParametros ? 'cursor-pointer' : ''
                                  }`}
                                onClick={() => {
                                  if (item.tieneParametros) {
                                    toggleExpandContabilidad(item.producto)
                                  }
                                }}
                              >
                                <td className="p-3">
                                  <div className="flex items-center">
                                    <span className="font-medium">{item.producto}</span>
                                    {item.tieneParametros && (
                                      <ChevronDown
                                        className={`ml-2 h-4 w-4 transition-transform ${expandedContabilidadProducts[item.producto] ? 'rotate-180' : ''
                                          }`}
                                      />
                                    )}
                                  </div>
                                </td>
                                <td className="p-3 text-right font-semibold">{item.cantidadTotal}</td>
                                <td className="p-3 text-right font-semibold text-green-600">
                                  ${item.montoTotal.toFixed(2)}
                                </td>
                                <td className="p-3 text-right">{item.ventas.length}</td>
                              </tr>

                              {item.tieneParametros &&
                                expandedContabilidadProducts[item.producto] &&
                                item.parametros.size > 0 && (
                                  <tr>
                                    <td colSpan={4} className="p-0">
                                      <div className="bg-gray-50 border-t">
                                        <div className="px-6 py-3">
                                          <div className="text-sm font-medium text-gray-700 mb-2">
                                            Desglose por parámetros:
                                          </div>
                                          <div className="space-y-1">
                                            {Array.from(item.parametros.entries())
                                              .sort(([, a], [, b]) => b.monto - a.monto)
                                              .map(([parametroNombre, parametroData], paramIndex) => (
                                                <div
                                                  key={paramIndex}
                                                  className="flex justify-between items-center py-2 px-3 bg-white rounded border"
                                                >
                                                  <div className="flex items-center">
                                                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                                                    <span className="text-sm font-medium">
                                                      {parametroNombre}
                                                    </span>
                                                  </div>
                                                  <div className="flex space-x-6 text-sm">
                                                    <span className="text-gray-600">
                                                      Cantidad: <span className="font-semibold">{parametroData.cantidad}</span>
                                                    </span>
                                                    <span className="text-green-600">
                                                      Monto: <span className="font-semibold">${parametroData.monto.toFixed(2)}</span>
                                                    </span>
                                                  </div>
                                                </div>
                                              ))}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                            </React.Fragment>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-bold text-lg mb-2">
                    Totales Generales
                    {(fechaInicio || fechaFin) && (
                      <span className="text-sm font-normal text-gray-600 ml-2">
                        {fechaInicio && fechaFin
                          ? `(${format(fechaInicio, 'dd/MM/yyyy')} - ${format(fechaFin, 'dd/MM/yyyy')})`
                          : fechaInicio
                            ? `(desde ${format(fechaInicio, 'dd/MM/yyyy')})`
                            : fechaFin
                              ? `(hasta ${format(fechaFin, 'dd/MM/yyyy')})`
                              : ""
                        }
                      </span>
                    )}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Total Productos Vendidos</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {getContabilidadData().reduce((sum, item) => sum + item.cantidadTotal, 0)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Total en Ventas</p>
                      <p className="text-2xl font-bold text-green-600">
                        ${getContabilidadData().reduce((sum, item) => sum + item.montoTotal, 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Ganancia Bruta</p>
                      <p className="text-2xl font-bold text-orange-600">
                        ${getContabilidadData().reduce((sum, item) => {
                          const gananciaProducto = item.ventas.reduce((gananciaSum, venta) => {
                            const producto = inventario.find(p => p.nombre === venta.producto_nombre)
                            if (!producto) return gananciaSum

                            const precioVenta = parseFloat(venta.total.toString())
                            const precioCompra = producto.precio_compra || 0
                            const cantidad = venta.cantidad

                            return gananciaSum + ((precioVenta / cantidad) - precioCompra) * cantidad
                          }, 0)

                          return sum + gananciaProducto
                        }, 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Total de Transacciones</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {getContabilidadData().reduce((sum, item) => sum + item.ventas.length, 0)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}