'use client'

import React, { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import Image from 'next/image'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import {
    GripVertical,
    Save,
    RefreshCw,
    Trash2,
    AlertTriangle
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
import { getMenuSections, saveMenuSectionOrder, eliminarSeccionMenu } from '@/app/services/api'
import { MenuSection } from '@/types'

const MenuSectionComponent = () => {
    const [sections, setSections] = useState<MenuSection[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)
    const [deleting, setDeleting] = useState<string | null>(null)
    const [sectionToDelete, setSectionToDelete] = useState<MenuSection | null>(null)

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

    useEffect(() => {
        fetchSections()
    }, [])

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

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Orden del Menú</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                        <span>Cargando secciones...</span>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Orden del Menú</CardTitle>
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
                </CardHeader>
                <CardContent>
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
                                ⚠️ Tienes cambios sin guardar. No olvides hacer clic en "Guardar Orden".
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Dialog de confirmación para eliminar */}
            <AlertDialog open={sectionToDelete !== null} onOpenChange={() => setSectionToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                            Confirmar eliminación
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                            <p>
                                ¿Estás seguro de que quieres eliminar la sección <strong>"{sectionToDelete?.name}"</strong>?
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
        </>
    )
}

export default MenuSectionComponent