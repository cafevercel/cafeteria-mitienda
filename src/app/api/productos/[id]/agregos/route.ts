import { neon } from "@neondatabase/serverless"
import { NextResponse } from "next/server"

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
const sql = databaseUrl ? neon(databaseUrl) : null

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    if (!sql) {
        return NextResponse.json(
            { error: "Database not configured" },
            { status: 500 }
        )
    }

    try {
        const productoId = params.id

        const agregos = await sql`
      SELECT id, producto_id, nombre, precio
      FROM agregos
      WHERE producto_id = ${productoId}
      ORDER BY created_at ASC
    `

        return NextResponse.json(agregos)
    } catch (error) {
        console.error("Error fetching agregos:", error)
        return NextResponse.json(
            { error: "Error al obtener agregos" },
            { status: 500 }
        )
    }
}

export async function PUT(
    request: Request,
    { params }: { params: { id: string } }
) {
    if (!sql) {
        return NextResponse.json(
            { error: "Database not configured" },
            { status: 500 }
        )
    }

    try {
        const productoId = params.id
        const { agregos } = await request.json()

        await sql`BEGIN`

        try {
            // Eliminar agregos existentes
            await sql`DELETE FROM agregos WHERE producto_id = ${productoId}`

            // Insertar nuevos agregos
            if (Array.isArray(agregos) && agregos.length > 0) {
                for (const agrego of agregos) {
                    await sql`
            INSERT INTO agregos (producto_id, nombre, precio)
            VALUES (${productoId}, ${agrego.nombre}, ${agrego.precio || 0})
          `
                }
            }

            await sql`COMMIT`

            return NextResponse.json({ success: true })
        } catch (error) {
            await sql`ROLLBACK`
            throw error
        }
    } catch (error) {
        console.error("Error saving agregos:", error)
        return NextResponse.json(
            { error: "Error al guardar agregos" },
            { status: 500 }
        )
    }
}
