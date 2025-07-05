// components/MenuSection.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import Image from 'next/image'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import { GripVertical, Save, RefreshCw } from "lucide-react"
import { getMenuSections, saveMenuSectionOrder } from '@/app/services/api'
import { MenuSection } from '@/types';

const MenuSectionComponent = () => {
    const [sections, setSections] = useState<MenuSection[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)

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
                                    className={`space-y-2 ${snapshot.isDraggingOver ? 'bg-blue-50 rounded-lg p-2' : ''
                                        }`}
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

                                                    <div className="text-right">
                                                        <span className="text-sm text-gray-400">
                                                            Posición {index + 1}
                                                        </span>
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
                            ⚠️ Tienes cambios sin guardar. No olvides hacer clic en 'Guardar Orden'.
                        </p>
                    </div>
                )}

            </CardContent>
        </Card>
    )
}

export default MenuSectionComponent
