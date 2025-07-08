// app/api/menu/sections/[seccion]/route.ts
import { neon } from "@neondatabase/serverless"
import { NextResponse } from "next/server"

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
const sql = databaseUrl ? neon(databaseUrl) : null

export async function DELETE(
    request: Request,
    { params }: { params: { seccion: string } }
) {
    if (!sql) {
        return NextResponse.json(
            { error: "Database not configured" },
            { status: 500 }
        )
    }

    try {
        const seccionNombre = decodeURIComponent(params.seccion)

        if (!seccionNombre || seccionNombre.trim() === '') {
            return NextResponse.json(
                { error: "Nombre de sección requerido" },
                { status: 400 }
            )
        }

        console.log(`🗑️ Eliminando sección: ${seccionNombre}`)

        // Comenzar transacción
        await sql`BEGIN`

        try {
            // 1. Actualizar productos para poner NULL en la sección
            const productosActualizados = await sql`
        UPDATE productos 
        SET seccion = NULL 
        WHERE seccion = ${seccionNombre}
        RETURNING id, nombre
      `

            console.log(`📦 Productos actualizados: ${productosActualizados.length}`)

            // 2. Eliminar la sección de la tabla orden_seccion
            const seccionEliminada = await sql`
        DELETE FROM orden_seccion 
        WHERE seccion = ${seccionNombre}
        RETURNING seccion, orden
      `

            console.log(`🗂️ Sección eliminada: ${seccionEliminada.length > 0 ? 'Sí' : 'No'}`)

            await sql`COMMIT`

            return NextResponse.json({
                success: true,
                message: `Sección "${seccionNombre}" eliminada correctamente`,
                productosActualizados: productosActualizados.length,
                seccionEliminada: seccionEliminada.length > 0
            })

        } catch (error) {
            await sql`ROLLBACK`
            throw error
        }

    } catch (error) {
        console.error("❌ Error eliminando sección:", error)
        return NextResponse.json(
            { error: "Error al eliminar la sección" },
            { status: 500 }
        )
    }
}
