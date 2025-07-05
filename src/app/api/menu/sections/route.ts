// app/api/menu/sections/route.ts (versión alternativa)
import { neon } from "@neondatabase/serverless"
import { NextResponse } from "next/server"

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
const sql = databaseUrl ? neon(databaseUrl) : null

export async function GET() {
    if (!sql) {
        return NextResponse.json(
            { error: "Database not configured" },
            { status: 500 }
        )
    }

    try {
        console.log("🔍 Fetching sections from productos table...")

        // Verificar si la tabla orden_seccion existe
        const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'orden_seccion'
      )
    `

        let secciones;

        if (tableExists[0].exists) {
            console.log("✅ Table orden_seccion exists, fetching with order...")

            // Obtener secciones con orden, usando ROW_NUMBER para las que no tienen orden
            secciones = await sql`
        WITH section_stats AS (
          SELECT 
            p.seccion as name,
            COUNT(p.id) as product_count,
            MIN(p.foto) as sample_image
          FROM productos p
          WHERE p.seccion IS NOT NULL 
            AND p.seccion != ''
          GROUP BY p.seccion
        ),
        ordered_sections AS (
          SELECT 
            ss.*,
            COALESCE(os.orden, 999 + ROW_NUMBER() OVER (ORDER BY ss.name)) as orden
          FROM section_stats ss
          LEFT JOIN orden_seccion os ON ss.name = os.seccion
        )
        SELECT * FROM ordered_sections
        ORDER BY orden ASC
      `
        } else {
            console.log("⚠️  Table orden_seccion doesn't exist, fetching without order...")
            secciones = await sql`
        SELECT 
          p.seccion as name,
          COUNT(p.id) as product_count,
          MIN(p.foto) as sample_image,
          ROW_NUMBER() OVER (ORDER BY p.seccion) as orden
        FROM productos p
        WHERE p.seccion IS NOT NULL 
          AND p.seccion != ''
        GROUP BY p.seccion
        ORDER BY p.seccion ASC
      `
        }

        console.log(`✅ Found ${secciones.length} sections total`)

        return NextResponse.json({
            sections: secciones.map((s) => ({
                name: s.name,
                product_count: Number.parseInt(s.product_count),
                sample_image: s.sample_image,
                orden: Number.parseInt(s.orden)
            })),
            table_exists: tableExists[0].exists
        })
    } catch (error) {
        console.error("❌ Error fetching sections:", error)
        return NextResponse.json(
            { error: "Error al cargar las secciones" },
            { status: 500 }
        )
    }
}
