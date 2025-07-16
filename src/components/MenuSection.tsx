'use client'

import React, { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import Image from 'next/image'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
    GripVertical,
    Save,
    RefreshCw,
    Trash2,
    AlertTriangle,
    Search,
    Edit,
    Package,
    Plus
} from "lucide-react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { getMenuSections, saveMenuSectionOrder, eliminarSeccionMenu, getInventario, editarProducto } from '@/app/services/api'
import { MenuSection, Producto, Agrego, AgregoForm, Costo, CostoForm } from '@/types'

const MenuSectionComponent = () => {
    // Estados para pestañas de orden
    const [sections, setSections] = useState<MenuSection[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)
    const [deleting, setDeleting] = useState<string | null>(null)
    const [sectionToDelete, setSectionToDelete] = useState<MenuSection | null>(null)

    // Estados para pestaña de productos
    const [productos, setProductos] = useState<Producto[]>([])
    const [filteredProductos, setFilteredProductos] = useState<Producto[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [sectionFilter, setSectionFilter] = useState<'all' | 'with' | 'without'>('all')
    const [loadingProductos, setLoadingProductos] = useState(false)

    // Estados para edición de producto
    const [editingProduct, setEditingProduct] = useState<Producto | null>(null)
    const [editingSection, setEditingSection] = useState('')
    const [savingProduct, setSavingProduct] = useState(false)

    // Estados para crear nueva sección
    const [showNewSectionInput, setShowNewSectionInput] = useState(false)
    const [newSectionName, setNewSectionName] = useState('')

    //agregos
    const [editingAgregos, setEditingAgregos] = useState<AgregoForm[]>([])
    const [tieneAgregos, setTieneAgregos] = useState(false)

    //costos adicionales
    const [editingCostos, setEditingCostos] = useState<CostoForm[]>([])
    const [tieneCostos, setTieneCostos] = useState(false)

    const fetchSections = async () => {
        try {
            setLoading(true)
            const data = await getMenuSections()
            setSections(data)
            setHasChanges(false)
        } catch (error) {
            toast({
                title: "Error",
                description: "No se pudieron cargar las secciones",
                variant: "destructive",
            })
        } finally {
            setLoading(false)
        }
    }

    const fetchProductos = async () => {
        try {
            setLoadingProductos(true)
            const data = await getInventario()
            setProductos(data)
        } catch (error) {
            toast({
                title: "Error",
                description: "No se pudieron cargar los productos",
                variant: "destructive",
            })
        } finally {
            setLoadingProductos(false)
        }
    }

    useEffect(() => {
        fetchSections()
        fetchProductos()
    }, [])

    // Filtrar productos basado en búsqueda y filtro de sección
    useEffect(() => {
        let filtered = productos

        // Filtrar por término de búsqueda
        if (searchTerm.trim()) {
            filtered = filtered.filter(producto =>
                producto.nombre.toLowerCase().includes(searchTerm.toLowerCase())
            )
        }

        // Filtrar por sección
        if (sectionFilter === 'with') {
            filtered = filtered.filter(producto => producto.seccion && producto.seccion.trim() !== '')
        } else if (sectionFilter === 'without') {
            filtered = filtered.filter(producto => !producto.seccion || producto.seccion.trim() === '')
        }

        // Ordenar por sección alfabéticamente, luego por nombre de producto
        filtered.sort((a, b) => {
            const seccionA = a.seccion || 'Sin sección'
            const seccionB = b.seccion || 'Sin sección'

            if (seccionA === seccionB) {
                return a.nombre.localeCompare(b.nombre)
            }
            return seccionA.localeCompare(seccionB)
        })

        setFilteredProductos(filtered)
    }, [productos, searchTerm, sectionFilter])

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination) return

        const items = Array.from(sections)
        const [reorderedItem] = items.splice(result.source.index, 1)
        items.splice(result.destination.index, 0, reorderedItem)

        setSections(items)
        setHasChanges(true)
    }

    const handleSaveOrder = async () => {
        try {
            setSaving(true)
            await saveMenuSectionOrder(sections)
            setHasChanges(false)
            toast({
                title: "Éxito",
                description: "Orden de secciones guardado correctamente",
            })
        } catch (error) {
            toast({
                title: "Error",
                description: "No se pudo guardar el orden",
                variant: "destructive",
            })
        } finally {
            setSaving(false)
        }
    }

    const handleDeleteSection = async (section: MenuSection) => {
        try {
            setDeleting(section.name)
            await eliminarSeccionMenu(section.name)

            // Actualizar la lista local
            setSections(prev => prev.filter(s => s.name !== section.name))

            toast({
                title: "Éxito",
                description: `Sección "${section.name}" eliminada correctamente. Los productos han sido movidos a "Sin sección".`,
            })

            setSectionToDelete(null)
            // Recargar productos para reflejar los cambios
            fetchProductos()
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "No se pudo eliminar la sección",
                variant: "destructive",
            })
        } finally {
            setDeleting(null)
        }
    }

    const handleEditProduct = (producto: Producto) => {
        setEditingProduct(producto)
        setEditingSection(producto.seccion || "sin-seccion")

        // Configurar agregos - EXISTENTE
        setTieneAgregos(producto.tiene_agrego || false)
        const agregosForm: AgregoForm[] = (producto.agregos || []).map(agrego => ({
            id: agrego.id,
            nombre: agrego.nombre,
            precio: agrego.precio
        }))
        setEditingAgregos(agregosForm)

        // Configurar costos - NUEVO
        setTieneCostos(producto.tiene_costo || false)
        const costosForm: CostoForm[] = (producto.costos || []).map(costo => ({
            id: costo.id,
            nombre: costo.nombre,
            precio: costo.precio
        }))
        setEditingCostos(costosForm)

        // Reset estados de nueva sección
        setShowNewSectionInput(false)
        setNewSectionName('')
    }

    // Agregar estas funciones después de las funciones de agregos
    const handleAddCosto = () => {
        setEditingCostos(prev => [...prev, { nombre: '', precio: 0 }])
    }

    const handleRemoveCosto = (index: number) => {
        setEditingCostos(prev => prev.filter((_, i) => i !== index))
    }

    const handleCostoChange = (index: number, field: 'nombre' | 'precio', value: string | number) => {
        setEditingCostos(prev => prev.map((costo, i) =>
            i === index ? { ...costo, [field]: value } : costo
        ))
    }


    const handleAddAgrego = () => {
        setEditingAgregos(prev => [...prev, { nombre: '', precio: 0 }])
    }

    const handleRemoveAgrego = (index: number) => {
        setEditingAgregos(prev => prev.filter((_, i) => i !== index))
    }

    const handleAgregoChange = (index: number, field: 'nombre' | 'precio', value: string | number) => {
        setEditingAgregos(prev => prev.map((agrego, i) =>
            i === index ? { ...agrego, [field]: value } : agrego
        ))
    }


    const handleSaveProductSection = async () => {
        if (!editingProduct) return

        // Validaciones existentes...
        if (showNewSectionInput) {
            if (!newSectionName.trim()) {
                toast({
                    title: "Error",
                    description: "El nombre de la nueva sección no puede estar vacío",
                    variant: "destructive",
                })
                return
            }

            const existingSections = uniqueSections.concat(sections.map(s => s.name))
            if (existingSections.some(section => section.toLowerCase() === newSectionName.trim().toLowerCase())) {
                toast({
                    title: "Error",
                    description: "Ya existe una sección con ese nombre",
                    variant: "destructive",
                })
                return
            }

            setEditingSection(newSectionName.trim())
        }

        if (tieneAgregos) {
            const agregosValidos = editingAgregos.filter(a => a.nombre.trim() !== '')
            if (agregosValidos.length === 0) {
                toast({
                    title: "Error",
                    description: "Debe agregar al menos un agrego si marca 'Tiene agregos'",
                    variant: "destructive",
                })
                return
            }
        }

        // NUEVA validación para costos
        if (tieneCostos) {
            const costosValidos = editingCostos.filter(c => c.nombre.trim() !== '')
            if (costosValidos.length === 0) {
                toast({
                    title: "Error",
                    description: "Debe agregar al menos un costo si marca 'Tiene costos adicionales'",
                    variant: "destructive",
                })
                return
            }
        }

        try {
            setSavingProduct(true)

            const formData = new FormData()
            formData.append('nombre', editingProduct.nombre)
            formData.append('precio', editingProduct.precio.toString())
            formData.append('cantidad', editingProduct.cantidad.toString())

            // Determinar la sección a guardar
            let sectionToSave = editingSection
            if (showNewSectionInput && newSectionName.trim()) {
                sectionToSave = newSectionName.trim()
            }

            formData.append('seccion', sectionToSave === "sin-seccion" ? "" : sectionToSave)

            // Agregar información de agregos - EXISTENTE
            formData.append('tiene_agrego', tieneAgregos.toString())
            if (tieneAgregos) {
                const agregosValidos = editingAgregos.filter(a => a.nombre.trim() !== '')
                formData.append('agregos', JSON.stringify(agregosValidos))
            } else {
                formData.append('agregos', JSON.stringify([]))
            }

            // Agregar información de costos - NUEVO
            formData.append('tiene_costo', tieneCostos.toString())
            if (tieneCostos) {
                const costosValidos = editingCostos.filter(c => c.nombre.trim() !== '')
                formData.append('costos', JSON.stringify(costosValidos))
            } else {
                formData.append('costos', JSON.stringify([]))
            }

            if (editingProduct.tiene_parametros) {
                formData.append('tiene_parametros', 'true')
                if (editingProduct.parametros) {
                    formData.append('parametros', JSON.stringify(editingProduct.parametros))
                }
            }

            await editarProducto(editingProduct.id, formData)

            // Actualizar el producto en la lista local
            const newSection = sectionToSave === "sin-seccion" ? "" : sectionToSave
            setProductos(prev => prev.map(p =>
                p.id === editingProduct.id
                    ? {
                        ...p,
                        seccion: newSection,
                        tiene_agrego: tieneAgregos,
                        agregos: tieneAgregos ? editingAgregos
                            .filter(a => a.nombre.trim() !== '')
                            .map(a => ({
                                ...a,
                                producto_id: parseInt(editingProduct.id)
                            } as Agrego)) : [],
                        tiene_costo: tieneCostos,  // NUEVO
                        costos: tieneCostos ? editingCostos
                            .filter(c => c.nombre.trim() !== '')
                            .map(c => ({
                                ...c,
                                producto_id: parseInt(editingProduct.id)
                            } as Costo)) : []  // NUEVO
                    }
                    : p
            ))

            const successMessage = showNewSectionInput
                ? `Nueva sección "${sectionToSave}" creada y producto actualizado`
                : "Producto actualizado correctamente"

            toast({
                title: "Éxito",
                description: successMessage,
            })

            // Reset estados
            setEditingProduct(null)
            setEditingSection('')
            setShowNewSectionInput(false)
            setNewSectionName('')
            setTieneAgregos(false)
            setEditingAgregos([])
            setTieneCostos(false)      // NUEVO
            setEditingCostos([])       // NUEVO

            fetchSections()
        } catch (error) {
            toast({
                title: "Error",
                description: "No se pudo actualizar el producto",
                variant: "destructive",
            })
        } finally {
            setSavingProduct(false)
        }
    }

    // Obtener lista única de secciones para el select
    const uniqueSections = Array.from(new Set(
        productos
            .filter(p => p.seccion && p.seccion.trim() !== '')
            .map(p => p.seccion!)
    )).sort()

    if (loading && loadingProductos) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Gestión del Menú</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                        <span>Cargando...</span>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Gestión del Menú</CardTitle>
                    <p className="text-sm text-gray-600">
                        Gestiona el orden de las secciones y asigna productos a secciones
                    </p>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="orden" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="orden">Orden de Secciones</TabsTrigger>
                            <TabsTrigger value="productos">Productos</TabsTrigger> {/* ← Cambiar nombre */}
                        </TabsList>

                        {/* Pestaña de Orden */}
                        <TabsContent value="orden" className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-medium">Orden del Menú</h3>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={fetchSections}
                                        disabled={loading}
                                    >
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Actualizar
                                    </Button>
                                    <Button
                                        onClick={handleSaveOrder}
                                        disabled={!hasChanges || saving}
                                        className="bg-green-600 hover:bg-green-700"
                                    >
                                        <Save className="h-4 w-4 mr-2" />
                                        {saving ? 'Guardando...' : 'Guardar Orden'}
                                    </Button>
                                </div>
                            </div>

                            <p className="text-sm text-gray-600">
                                Arrastra las secciones para cambiar su orden en el menú
                            </p>

                            {sections.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <p>No hay secciones disponibles</p>
                                </div>
                            ) : (
                                <DragDropContext onDragEnd={handleDragEnd}>
                                    <Droppable droppableId="sections">
                                        {(provided, snapshot) => (
                                            <div
                                                {...provided.droppableProps}
                                                ref={provided.innerRef}
                                                className={`space-y-2 ${snapshot.isDraggingOver ? 'bg-blue-50 rounded-lg p-2' : ''}`}
                                            >
                                                {sections.map((section, index) => (
                                                    <Draggable
                                                        key={section.name}
                                                        draggableId={section.name}
                                                        index={index}
                                                    >
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                className={`flex items-center p-4 bg-white border rounded-lg shadow-sm transition-all ${snapshot.isDragging
                                                                    ? 'shadow-lg rotate-2 bg-blue-50'
                                                                    : 'hover:shadow-md'
                                                                    }`}
                                                            >
                                                                <div
                                                                    {...provided.dragHandleProps}
                                                                    className="mr-3 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
                                                                >
                                                                    <GripVertical className="h-5 w-5" />
                                                                </div>

                                                                <div className="w-12 h-12 relative mr-4 flex-shrink-0">
                                                                    <Image
                                                                        src={section.sample_image || '/placeholder.svg'}
                                                                        alt={section.name}
                                                                        fill
                                                                        className="rounded-md object-cover"
                                                                        onError={(e) => {
                                                                            (e.target as HTMLImageElement).src = '/placeholder.svg'
                                                                        }}
                                                                    />
                                                                </div>

                                                                <div className="flex-1">
                                                                    <h3 className="font-medium text-gray-900">
                                                                        {section.name}
                                                                    </h3>
                                                                    <p className="text-sm text-gray-500">
                                                                        {section.product_count} producto{section.product_count !== 1 ? 's' : ''}
                                                                    </p>
                                                                </div>

                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-sm text-gray-400">
                                                                        Posición {index + 1}
                                                                    </span>

                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => setSectionToDelete(section)}
                                                                        disabled={deleting === section.name}
                                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                                                    >
                                                                        {deleting === section.name ? (
                                                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                                                        ) : (
                                                                            <Trash2 className="h-4 w-4" />
                                                                        )}
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}
                                            </div>
                                        )}
                                    </Droppable>
                                </DragDropContext>
                            )}

                            {hasChanges && (
                                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <p className="text-sm text-yellow-800">
                                        ⚠️ Tienes cambios sin guardar. No olvides hacer clic en Guardar Orden.
                                    </p>
                                </div>
                            )}
                        </TabsContent>

                        {/* Pestaña de Productos - actualizar el título */}
                        <TabsContent value="productos" className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-medium">Gestión de Productos</h3> {/* ← Cambiar título */}
                                <Button
                                    variant="outline"
                                    onClick={fetchProductos}
                                    disabled={loadingProductos}
                                >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Actualizar
                                </Button>
                            </div>

                            {/* Filtros */}
                            <div className="flex gap-4 items-center">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                    <Input
                                        placeholder="Buscar productos..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                                <Select value={sectionFilter} onValueChange={(value: 'all' | 'with' | 'without') => setSectionFilter(value)}>
                                    <SelectTrigger className="w-48">
                                        <SelectValue placeholder="Filtrar por sección" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos los productos</SelectItem>
                                        <SelectItem value="with">Con sección</SelectItem>
                                        <SelectItem value="without">Sin sección</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Lista de productos */}
                            {loadingProductos ? (
                                <div className="flex items-center justify-center py-8">
                                    <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                                    <span>Cargando productos...</span>
                                </div>
                            ) : filteredProductos.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                                    <p>No se encontraron productos</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {filteredProductos.map((producto) => (
                                        <div
                                            key={producto.id}
                                            className="flex items-center p-4 bg-white border rounded-lg shadow-sm hover:shadow-md transition-all"
                                        >
                                            <div className="w-12 h-12 relative mr-4 flex-shrink-0">
                                                <Image
                                                    src={producto.foto || '/placeholder.svg'}
                                                    alt={producto.nombre}
                                                    fill
                                                    className="rounded-md object-cover"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = '/placeholder.svg'
                                                    }}
                                                />
                                            </div>

                                            <div className="flex-1">
                                                <h3 className="font-medium text-gray-900">
                                                    {producto.nombre}
                                                </h3>
                                                <p className="text-sm text-gray-500">
                                                    Cantidad: {producto.cantidad} | Precio: ${producto.precio}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <p className="text-sm font-medium text-gray-700">
                                                        {producto.seccion || 'Sin sección'}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        Sección actual
                                                    </p>
                                                </div>

                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleEditProduct(producto)}
                                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Dialog de confirmación para eliminar sección */}
            <AlertDialog open={sectionToDelete !== null} onOpenChange={() => setSectionToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                            Confirmar eliminación
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                            <p>
                                ¿Estás seguro de que quieres eliminar la sección <strong>{sectionToDelete?.name}</strong>?
                            </p>
                            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                <p className="text-sm text-yellow-800">
                                    <strong>⚠️ Esta acción:</strong>
                                </p>
                                <ul className="text-sm text-yellow-700 mt-1 space-y-1">
                                    <li>• Eliminará la sección del menú</li>
                                    <li>• Los {sectionToDelete?.product_count} productos de esta sección quedarán sin sección asignada</li>
                                    <li>• Esta acción no se puede deshacer</li>
                                </ul>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => sectionToDelete && handleDeleteSection(sectionToDelete)}
                            className="bg-red-600 hover:bg-red-700"
                            disabled={deleting !== null}
                        >
                            {deleting === sectionToDelete?.name ? (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    Eliminando...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Eliminar Sección
                                </>
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Dialog para editar sección de producto */}
            <Dialog open={editingProduct !== null} onOpenChange={() => {
                setEditingProduct(null)
                setTieneAgregos(false)
                setEditingAgregos([])
                setTieneCostos(false)      // NUEVO
                setEditingCostos([])       // NUEVO
            }}>

                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Editar Producto</DialogTitle>
                        <DialogDescription>
                            Edita la sección y agregos del producto {editingProduct?.nombre}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6">
                        {/* Sección existente */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-2 block">
                                Sección
                            </label>
                            <Select
                                value={showNewSectionInput ? "crear-nueva" : (editingSection || "sin-seccion")}
                                onValueChange={(value) => {
                                    if (value === "crear-nueva") {
                                        setShowNewSectionInput(true)
                                    } else {
                                        setEditingSection(value)
                                        setShowNewSectionInput(false)
                                        setNewSectionName('')
                                    }
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona una sección" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="sin-seccion">Sin sección</SelectItem>
                                    {uniqueSections.map((section) => (
                                        <SelectItem key={section} value={section}>
                                            {section}
                                        </SelectItem>
                                    ))}
                                    <SelectItem value="crear-nueva" className="text-blue-600 font-medium">
                                        <div className="flex items-center">
                                            <Plus className="h-4 w-4 mr-2" />
                                            Crear nueva sección
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Input para crear nueva sección - existente */}
                        {showNewSectionInput && (
                            <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <label className="text-sm font-medium text-blue-900 block">
                                    Nombre de la nueva sección
                                </label>
                                <Input
                                    value={newSectionName}
                                    onChange={(e) => setNewSectionName(e.target.value)}
                                    placeholder="Ej: Bebidas, Postres, etc."
                                    className="w-full"
                                />
                                <p className="text-xs text-blue-700">
                                    La nueva sección se creará cuando guardes los cambios
                                </p>
                            </div>
                        )}

                        {/* Sección de Agregos - NUEVO */}
                        <div className="space-y-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="tiene-agregos"
                                    checked={tieneAgregos}
                                    onCheckedChange={(checked) => {
                                        setTieneAgregos(checked as boolean)
                                        if (!checked) {
                                            setEditingAgregos([])
                                        }
                                    }}
                                />
                                <Label htmlFor="tiene-agregos" className="text-sm font-medium">
                                    Tiene agregos
                                </Label>
                            </div>

                            {tieneAgregos && (
                                <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
                                    <div className="flex justify-between items-center">
                                        <h4 className="text-sm font-medium text-green-900">Agregos del producto</h4>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={handleAddAgrego}
                                            className="text-green-600 hover:text-green-700 border-green-300"
                                        >
                                            <Plus className="h-4 w-4 mr-1" />
                                            Agregar
                                        </Button>
                                    </div>

                                    {editingAgregos.length === 0 ? (
                                        <p className="text-sm text-green-700 text-center py-4">
                                            No hay agregos. Haz clic en Agregar para añadir uno.
                                        </p>
                                    ) : (
                                        <div className="space-y-3">
                                            {editingAgregos.map((agrego, index) => (
                                                <div key={index} className="flex gap-2 items-center">
                                                    <Input
                                                        placeholder="Nombre del agrego"
                                                        value={agrego.nombre}
                                                        onChange={(e) => handleAgregoChange(index, 'nombre', e.target.value)}
                                                        className="flex-1"
                                                    />
                                                    <Input
                                                        type="number"
                                                        placeholder="Precio"
                                                        value={agrego.precio}
                                                        onChange={(e) => handleAgregoChange(index, 'precio', parseFloat(e.target.value) || 0)}
                                                        className="w-24"
                                                        step="0.01"
                                                        min="0"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleRemoveAgrego(index)}
                                                        className="text-red-600 hover:text-red-700 border-red-300"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Sección de Costos Adicionales - NUEVO */}
                        <div className="space-y-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="tiene-costos"
                                    checked={tieneCostos}
                                    onCheckedChange={(checked) => {
                                        setTieneCostos(checked as boolean)
                                        if (!checked) {
                                            setEditingCostos([])
                                        }
                                    }}
                                />
                                <Label htmlFor="tiene-costos" className="text-sm font-medium">
                                    Tiene costos adicionales
                                </Label>
                            </div>

                            {tieneCostos && (
                                <div className="space-y-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
                                    <div className="flex justify-between items-center">
                                        <h4 className="text-sm font-medium text-orange-900">Costos adicionales del producto</h4>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={handleAddCosto}
                                            className="text-orange-600 hover:text-orange-700 border-orange-300"
                                        >
                                            <Plus className="h-4 w-4 mr-1" />
                                            Agregar
                                        </Button>
                                    </div>

                                    {editingCostos.length === 0 ? (
                                        <p className="text-sm text-orange-700 text-center py-4">
                                            No hay costos. Haz clic en Agregar para añadir uno.
                                        </p>
                                    ) : (
                                        <div className="space-y-3">
                                            {editingCostos.map((costo, index) => (
                                                <div key={index} className="flex gap-2 items-center">
                                                    <Input
                                                        placeholder="Nombre del costo"
                                                        value={costo.nombre}
                                                        onChange={(e) => handleCostoChange(index, 'nombre', e.target.value)}
                                                        className="flex-1"
                                                    />
                                                    <Input
                                                        type="number"
                                                        placeholder="Precio"
                                                        value={costo.precio}
                                                        onChange={(e) => handleCostoChange(index, 'precio', parseFloat(e.target.value) || 0)}
                                                        className="w-24"
                                                        step="0.01"
                                                        min="0"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleRemoveCosto(index)}
                                                        className="text-red-600 hover:text-red-700 border-red-300"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>


                        {/* Información del producto - existente */}
                        <div className="text-sm text-gray-600 space-y-1">
                            <p><strong>Producto:</strong> {editingProduct?.nombre}</p>
                            <p><strong>Sección actual:</strong> {editingProduct?.seccion || 'Sin sección'}</p>
                            <p><strong>Tiene agregos:</strong> {editingProduct?.tiene_agrego ? 'Sí' : 'No'}</p>
                            <p><strong>Tiene costos:</strong> {editingProduct?.tiene_costo ? 'Sí' : 'No'}</p> {/* NUEVO */}
                            {showNewSectionInput && newSectionName.trim() && (
                                <p><strong>Nueva sección:</strong> {newSectionName.trim()}</p>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setEditingProduct(null)
                                setShowNewSectionInput(false)
                                setNewSectionName('')
                                setTieneAgregos(false)
                                setEditingAgregos([])
                                setTieneCostos(false)      // NUEVO
                                setEditingCostos([])       // NUEVO
                            }}
                            disabled={savingProduct}
                        >
                            Cancelar
                        </Button>

                        <Button
                            onClick={handleSaveProductSection}
                            disabled={savingProduct || (showNewSectionInput && !newSectionName.trim())}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {savingProduct ? (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" />
                                    {showNewSectionInput ? 'Crear y Guardar' : 'Guardar Cambios'}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

export default MenuSectionComponent
