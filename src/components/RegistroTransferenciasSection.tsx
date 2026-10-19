'use client'

import React, { useState, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { 
  Search, 
  Download, 
  RefreshCw, 
  CreditCard, 
  DollarSign, 
  Phone, 
  User, 
  Calendar, 
  Store, 
  Filter, 
  X, 
  Eye, 
  CheckCircle2, 
  Building2,
  FileText,
  AlertCircle
} from 'lucide-react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { getRegistroTransferencias, getVendedores, RegistroTransferenciaItem } from '@/app/services/api'
import { toast } from '@/hooks/use-toast'

export default function RegistroTransferenciasSection() {
  const [transferencias, setTransferencias] = useState<RegistroTransferenciaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [vendedores, setVendedores] = useState<Array<{ id: number | string; nombre: string }>>([])
  
  // Filtros
  const [search, setSearch] = useState('')
  const [selectedVendedor, setSelectedVendedor] = useState<string>('todos')
  const [selectedBanco, setSelectedBanco] = useState<string>('todos')
  const [fechaInicio, setFechaInicio] = useState<string>('')
  const [fechaFin, setFechaFin] = useState<string>('')
  
  // Paginación y Resumen
  const [summary, setSummary] = useState({ totalRegistros: 0, totalMonto: 0 })
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [tableNotCreated, setTableNotCreated] = useState(false)

  // Modal de Detalle
  const [selectedItem, setSelectedItem] = useState<RegistroTransferenciaItem | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  // Cargar vendedores para el selector
  useEffect(() => {
    const fetchVendedores = async () => {
      try {
        const vList = await getVendedores()
        setVendedores(vList)
      } catch (err) {
        console.error('Error cargando vendedores:', err)
      }
    }
    fetchVendedores()
  }, [])

  // Cargar transferencias desde el backend
  const fetchTransferencias = async (page = 1) => {
    setLoading(true)
    try {
      const data = await getRegistroTransferencias({
        search,
        vendedorId: selectedVendedor,
        banco: selectedBanco,
        fechaInicio: fechaInicio || undefined,
        fechaFin: fechaFin || undefined,
        page,
        limit: 50
      })

      if (data.tableNotCreated) {
        setTableNotCreated(true)
      } else {
        setTableNotCreated(false)
      }

      setTransferencias(data.transferencias || [])
      setSummary(data.summary || { totalRegistros: 0, totalMonto: 0 })
      setCurrentPage(data.pagination?.page || 1)
      setTotalPages(data.pagination?.totalPages || 1)
    } catch (error: any) {
      console.error('Error cargando registro de transferencias:', error)
      toast({
        title: "Error al cargar transferencias",
        description: error.message || "No se pudieron obtener los datos",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  // Recargar al cambiar filtros clave
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTransferencias(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, selectedVendedor, selectedBanco, fechaInicio, fechaFin])

  // Lista de bancos únicos para el filtro
  const bancosDisponibles = useMemo(() => {
    const defaultBancos = ['Transfermóvil', 'EnZona', 'BANDEC', 'BPA', 'Metropolitano']
    const fromData = transferencias.map(t => t.banco).filter(Boolean)
    return Array.from(new Set([...defaultBancos, ...fromData]))
  }, [transferencias])

  // Desglose por banco para KPI
  const bancoBreakdown = useMemo(() => {
    const counts: Record<string, number> = {}
    transferencias.forEach(t => {
      const b = t.banco || 'Otro'
      counts[b] = (counts[b] || 0) + (Number(t.monto) || 0)
    })
    return counts
  }, [transferencias])

  // Limpiar filtros
  const handleLimpiarFiltros = () => {
    setSearch('')
    setSelectedVendedor('todos')
    setSelectedBanco('todos')
    setFechaInicio('')
    setFechaFin('')
  }

  // Exportar a Excel
  const handleExportExcel = () => {
    if (transferencias.length === 0) {
      toast({
        title: "Sin datos",
        description: "No hay transferencias para exportar con los filtros actuales.",
      })
      return
    }

    const dataToExport = transferencias.map(item => {
      let detallesStr = ''
      try {
        const parsed = typeof item.detalles === 'string' ? JSON.parse(item.detalles) : item.detalles
        if (Array.isArray(parsed)) {
          detallesStr = parsed.map(p => `${p.nombre || p.nombre_producto} (x${p.cantidad})`).join(', ')
        }
      } catch (e) {
        detallesStr = String(item.detalles || '')
      }

      return {
        'ID': item.id,
        'Fecha': item.fecha ? new Date(item.fecha).toLocaleString('es-ES') : '',
        'No. Transacción': item.numero_transaccion,
        'Cliente': item.cliente_nombre,
        'Teléfono': item.cliente_telefono,
        'Banco / Plataforma': item.banco,
        'Monto ($)': Number(item.monto),
        'Punto de Venta': item.vendedor_nombre,
        'Productos / Detalle': detallesStr
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(dataToExport)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Registro Transferencias')
    
    // Auto-ajustar ancho de columnas
    const colWidths = [
      { wch: 8 },  // ID
      { wch: 20 }, // Fecha
      { wch: 20 }, // No. Transacción
      { wch: 25 }, // Cliente
      { wch: 15 }, // Teléfono
      { wch: 18 }, // Banco
      { wch: 12 }, // Monto
      { wch: 20 }, // Punto de Venta
      { wch: 40 }, // Productos
    ]
    worksheet['!cols'] = colWidths

    XLSX.writeFile(workbook, `Registro_Transferencias_${new Date().toISOString().split('T')[0]}.xlsx`)
    toast({
      title: "Exportación completada",
      description: "El archivo Excel se ha descargado correctamente.",
    })
  }

  const parseDetalles = (detalles: any): any[] => {
    if (!detalles) return []
    if (Array.isArray(detalles)) return detalles
    try {
      const parsed = JSON.parse(detalles)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 sm:p-6 rounded-xl border border-orange-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-orange-950 flex items-center gap-2">
            <CreditCard className="h-7 w-7 text-orange-600" />
            Registro Transferencia
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Historial de pagos por transferencia y mixtos registrados por los vendedores.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchTransferencias(currentPage)}
            disabled={loading}
            className="border-orange-200 text-orange-800 hover:bg-orange-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button
            size="sm"
            onClick={handleExportExcel}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {tableNotCreated && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-amber-900 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Tabla no inicializada en Base de Datos</p>
            <p className="text-xs text-amber-800 mt-0.5">
              Ejecute el query del archivo <code className="bg-amber-100 px-1 rounded">src/sql/crear_tabla_registro_transferencias.sql</code> en su base de datos PostgreSQL para comenzar a guardar y visualizar los registros.
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards - Mobile First Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-orange-200 shadow-sm bg-gradient-to-br from-orange-50/50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-orange-700 flex items-center justify-between">
              Monto Total en Transferencias
              <DollarSign className="h-4 w-4 text-orange-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-orange-950">
              ${summary.totalMonto.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-gray-500 mt-1">Suma acumulada según filtros aplicados</p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 shadow-sm bg-gradient-to-br from-amber-50/50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-amber-700 flex items-center justify-between">
              Total de Operaciones
              <CheckCircle2 className="h-4 w-4 text-amber-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              {summary.totalRegistros}
            </div>
            <p className="text-xs text-gray-500 mt-1">Transacciones por transferencia registradas</p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 shadow-sm sm:col-span-2 lg:col-span-1 bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-600 flex items-center justify-between">
              Plataformas Principales
              <Building2 className="h-4 w-4 text-gray-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {Object.keys(bancoBreakdown).length > 0 ? (
                Object.entries(bancoBreakdown).slice(0, 4).map(([banco, monto]) => (
                  <Badge key={banco} variant="secondary" className="bg-orange-100 text-orange-900 border-orange-200 text-xs">
                    {banco}: ${Number(monto).toLocaleString()}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-gray-400">Sin registros</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">Distribución de cobros por banco</p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <Card className="border-orange-200 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Input de Búsqueda Principal */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por cliente, teléfono, no. transacción, banco o vendedor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 border-orange-200 focus:border-orange-500 focus:ring-orange-500 bg-white"
              />
              {search && (
                <button 
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Selector de Vendedor */}
            <div className="w-full md:w-48">
              <Select value={selectedVendedor} onValueChange={setSelectedVendedor}>
                <SelectTrigger className="border-orange-200 bg-white">
                  <SelectValue placeholder="Punto de Venta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los puntos</SelectItem>
                  {vendedores.map(v => (
                    <SelectItem key={v.id} value={v.id.toString()}>
                      {v.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selector de Banco */}
            <div className="w-full md:w-44">
              <Select value={selectedBanco} onValueChange={setSelectedBanco}>
                <SelectTrigger className="border-orange-200 bg-white">
                  <SelectValue placeholder="Todos los bancos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los bancos</SelectItem>
                  {bancosDisponibles.map(b => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Rango de Fechas */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-orange-100">
            <div className="flex items-center gap-2 text-xs text-gray-600 font-medium">
              <Calendar className="h-3.5 w-3.5 text-orange-600" />
              Rango de Fecha:
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="h-8 text-xs border-orange-200 bg-white w-36"
              />
              <span className="text-xs text-gray-400">hasta</span>
              <Input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="h-8 text-xs border-orange-200 bg-white w-36"
              />
            </div>

            {(search || selectedVendedor !== 'todos' || selectedBanco !== 'todos' || fechaInicio || fechaFin) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLimpiarFiltros}
                className="h-8 text-xs text-orange-700 hover:text-orange-900 hover:bg-orange-100 ml-auto"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Limpiar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Vista Móvil (Cards) & Vista Desktop (Tabla) */}
      <Card className="border-orange-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-orange-600 mb-3" />
            <p className="text-gray-500 font-medium">Cargando transferencias...</p>
          </div>
        ) : transferencias.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-700 font-semibold text-lg">No se encontraron registros de transferencias</p>
            <p className="text-sm text-gray-500 mt-1">
              Las ventas por transferencia o mixtas que los vendedores registren en la app aparecerán aquí.
            </p>
          </div>
        ) : (
          <>
            {/* VISTA MÓVIL (Visible en pantallas < md) */}
            <div className="block md:hidden divide-y divide-orange-100">
              {transferencias.map((item) => (
                <div key={item.id} className="p-4 hover:bg-orange-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-orange-50 text-orange-800 border-orange-200 text-xs font-bold">
                          {item.banco}
                        </Badge>
                        <span className="text-xs font-mono font-bold text-gray-700">
                          #{item.numero_transaccion}
                        </span>
                      </div>
                      <p className="font-semibold text-gray-900 mt-1 flex items-center gap-1.5 text-sm">
                        <User className="h-3.5 w-3.5 text-gray-400" />
                        {item.cliente_nombre}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-orange-700">
                        ${Number(item.monto).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-gray-500 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3 text-gray-400" />
                      {item.cliente_telefono || 'Sin teléfono'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Store className="h-3 w-3 text-gray-400" />
                      {item.vendedor_nombre}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-gray-400" />
                      {item.fecha ? new Date(item.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                    </span>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedItem(item)
                        setIsDetailOpen(true)
                      }}
                      className="h-7 text-xs text-orange-700 hover:bg-orange-100"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      Ver Detalle
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* VISTA DESKTOP / TABLET (Visible en pantallas >= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-orange-50/80 text-xs uppercase font-semibold text-orange-900 border-b border-orange-200">
                  <tr>
                    <th className="py-3 px-4">Fecha / Hora</th>
                    <th className="py-3 px-4">No. Transacción</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Teléfono</th>
                    <th className="py-3 px-4">Banco</th>
                    <th className="py-3 px-4 text-right">Monto ($)</th>
                    <th className="py-3 px-4">Punto de Venta</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-orange-100">
                  {transferencias.map((item) => (
                    <tr key={item.id} className="hover:bg-orange-50/40 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-xs text-gray-700 font-medium">
                        {item.fecha ? new Date(item.fecha).toLocaleString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : '-'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-gray-900">
                        {item.numero_transaccion}
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-900">
                        {item.cliente_nombre}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {item.cliente_telefono || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="bg-orange-50/60 text-orange-800 border-orange-200">
                          {item.banco}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-orange-800 whitespace-nowrap">
                        ${Number(item.monto).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        {item.vendedor_nombre}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedItem(item)
                            setIsDetailOpen(true)
                          }}
                          className="h-8 w-8 p-0 text-orange-700 hover:bg-orange-100 rounded-full"
                          title="Ver detalle de la venta"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-orange-100 flex items-center justify-between text-xs text-gray-500">
                <div>
                  Página {currentPage} de {totalPages} ({summary.totalRegistros} registros)
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1 || loading}
                    onClick={() => fetchTransferencias(currentPage - 1)}
                    className="h-8 text-xs border-orange-200 hover:bg-orange-50"
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages || loading}
                    onClick={() => fetchTransferencias(currentPage + 1)}
                    className="h-8 text-xs border-orange-200 hover:bg-orange-50"
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Modal de Detalle de la Operación */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg w-[95%] rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-950 text-lg">
              <CreditCard className="h-5 w-5 text-orange-600" />
              Detalle de Transferencia #{selectedItem?.numero_transaccion}
            </DialogTitle>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4 text-sm mt-2">
              {/* Resumen Principal */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                <div>
                  <span className="text-xs text-gray-500 block">Monto Transferido</span>
                  <span className="text-xl font-black text-orange-900">
                    ${Number(selectedItem.monto).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Banco / Plataforma</span>
                  <Badge className="bg-orange-600 text-white mt-0.5">{selectedItem.banco}</Badge>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Cliente</span>
                  <span className="font-semibold text-gray-900">{selectedItem.cliente_nombre}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Teléfono</span>
                  <span className="font-semibold text-gray-900">{selectedItem.cliente_telefono || 'No indicado'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Punto de Venta</span>
                  <span className="font-medium text-gray-800">{selectedItem.vendedor_nombre}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Fecha y Hora</span>
                  <span className="text-xs text-gray-700">
                    {selectedItem.fecha ? new Date(selectedItem.fecha).toLocaleString('es-ES') : '-'}
                  </span>
                </div>
              </div>

              {/* Detalle de Productos / Carrito */}
              <div>
                <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-orange-600" />
                  Productos en esta Operación
                </h4>
                {(() => {
                  const items = parseDetalles(selectedItem.detalles)
                  if (items.length === 0) {
                    return (
                      <p className="text-xs text-gray-500 italic p-3 bg-gray-50 rounded border text-center">
                        No hay desglose detallado de productos para este registro.
                      </p>
                    )
                  }
                  return (
                    <div className="border border-orange-200 rounded-lg overflow-hidden divide-y divide-orange-100">
                      {items.map((prod: any, idx: number) => (
                        <div key={idx} className="p-2.5 flex items-center justify-between text-xs hover:bg-orange-50/30">
                          <div>
                            <span className="font-semibold text-gray-900">
                              {prod.nombre || prod.nombre_producto || 'Producto'}
                            </span>
                            <span className="text-gray-500 block text-[11px]">
                              Cantidad: {prod.cantidad} {prod.precio ? `× $${Number(prod.precio).toLocaleString()}` : ''}
                            </span>
                          </div>
                          <span className="font-bold text-orange-950">
                            ${((prod.total !== undefined ? prod.total : (prod.precio || 0) * (prod.cantidad || 1))).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsDetailOpen(false)}
              className="border-orange-200 hover:bg-orange-50 w-full sm:w-auto"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
