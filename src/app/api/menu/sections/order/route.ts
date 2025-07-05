// app/api/menu/sections/order/route.ts
import { neon } from "@neondatabase/serverless"
import { NextResponse } from "next/server"

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
const sql = databaseUrl ? neon(databaseUrl) : null

export async function PUT(request: Request) {
    if (!sql) {
        return NextResponse.json(
            { error: "Database not configured" },
            { status: 500 }
        )
    }

    try {
        const { sections } = await request.json()

        if (!Array.isArray(sections)) {
            return NextResponse.json(
                { error: "Formato de datos inválido" },
                { status: 400 }
            )
        }

        // Comenzar transacción
        await sql`BEGIN`

        try {
            // Limpiar órdenes existentes
            await sql`DELETE FROM orden_seccion`

            // Insertar nuevos órdenes
            for (let i = 0; i < sections.length; i++) {
                const section = sections[i]
                await sql`
          INSERT INTO orden_seccion (seccion, orden)
          VALUES (${section.name}, ${i + 1})
        `
            }

            await sql`COMMIT`

            return NextResponse.json({
                success: true,
                message: "Orden guardado correctamente"
            })
        } catch (error) {
            await sql`ROLLBACK`
            throw error
        }
    } catch (error) {
        console.error("❌ Error saving section order:", error)
        return NextResponse.json(
            { error: "Error al guardar el orden" },
            { status: 500 }
        )
    }
}
