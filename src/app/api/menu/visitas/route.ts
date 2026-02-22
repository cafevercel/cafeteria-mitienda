// app/api/menu/visitas/route.ts
import { neon } from "@neondatabase/serverless"
import { NextResponse } from "next/server"
import { VisitaMenu } from "@/types"

// Forzar comportamiento dinámico
export const dynamic = 'force-dynamic'
export const revalidate = 0

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
const sql = databaseUrl ? neon(databaseUrl) : null

/**
 * GET - Obtiene estadísticas de visitas
 * Query params:
 * - fecha_inicio (YYYY-MM-DD): Fecha de inicio para filtrar
 * - fecha_fin (YYYY-MM-DD): Fecha de fin para filtrar
 * - url (string): URL específica a filtrar (opcional)
 * - agrupacion: 'dia' | 'mes' | 'total' (default: 'dia')
 */
export async function GET(request: Request) {
    if (!sql) {
        return NextResponse.json(
            { error: "Database not configured" },
            { status: 500 }
        )
    }

    try {
        const { searchParams } = new URL(request.url)
        const fechaInicio = searchParams.get('fecha_inicio')
        const fechaFin = searchParams.get('fecha_fin')
        const url = searchParams.get('url')
        const agrupacion = searchParams.get('agrupacion') || 'dia'

        // Construir query base
        let query = `
            SELECT 
                DATE(fecha) as fecha,
                url,
                COUNT(*) as visitas
            FROM visitas_menu
            WHERE 1=1
        `
        const params: any[] = []

        // Agregar filtros
        if (fechaInicio) {
            query += ` AND DATE(fecha) >= DATE($${params.length + 1})`
            params.push(fechaInicio)
        }
        if (fechaFin) {
            query += ` AND DATE(fecha) <= DATE($${params.length + 1})`
            params.push(fechaFin)
        }
        if (url) {
            query += ` AND url = $${params.length + 1}`
            params.push(url)
        }

        // Agrupar según la agrupación solicitada
        if (agrupacion === 'mes') {
            query = `
                SELECT 
                    DATE_TRUNC('month', fecha) as fecha,
                    url,
                    COUNT(*) as visitas
                FROM visitas_menu
                WHERE 1=1
            `
            // Reagregar filtros (simplificado para este ejemplo)
            if (fechaInicio) {
                query += ` AND DATE(fecha) >= DATE($${params.length + 1})`
                params.push(fechaInicio)
            }
            if (fechaFin) {
                query += ` AND DATE(fecha) <= DATE($${params.length + 1})`
                params.push(fechaFin)
            }
            if (url) {
                query += ` AND url = $${params.length + 1}`
                params.push(url)
            }
            query += ` GROUP BY DATE_TRUNC('month', fecha), url ORDER BY fecha DESC`
        } else if (agrupacion === 'total') {
            query = `
                SELECT 
                    url,
                    COUNT(*) as visitas,
                    MIN(fecha) as primera_visita,
                    MAX(fecha) as ultima_visita
                FROM visitas_menu
                WHERE 1=1
            `
            if (fechaInicio) {
                query += ` AND DATE(fecha) >= DATE($${params.length + 1})`
                params.push(fechaInicio)
            }
            if (fechaFin) {
                query += ` AND DATE(fecha) <= DATE($${params.length + 1})`
                params.push(fechaFin)
            }
            if (url) {
                query += ` AND url = $${params.length + 1}`
                params.push(url)
            }
            query += ` GROUP BY url ORDER BY visitas DESC`
        } else {
            // Agrupación por día (default)
            query += ` GROUP BY DATE(fecha), url ORDER BY fecha DESC, url`
        }

        console.log("🔍 Executing query:", query)
        console.log("📊 Params:", params)

        const result = await sql(query, params)

        // Formatear resultados
        const visitas = result.map((row: any) => ({
            fecha: row.fecha ? (row.fecha instanceof Date ? row.fecha.toISOString().split('T')[0] : String(row.fecha)) : null,
            url: row.url,
            visitas: Number.parseInt(row.visitas),
            primera_visita: row.primera_visita ? (row.primera_visita instanceof Date ? row.primera_visita.toISOString() : String(row.primera_visita)) : undefined,
            ultima_visita: row.ultima_visita ? (row.ultima_visita instanceof Date ? row.ultima_visita.toISOString() : String(row.ultima_visita)) : undefined,
        }))

        return NextResponse.json({
            success: true,
            data: visitas,
            total: visitas.reduce((sum, v) => sum + v.visitas, 0),
            agrupacion
        })

    } catch (error) {
        console.error("❌ Error fetching visitas:", error)

        return NextResponse.json(
            { error: "Error al obtener las visitas", details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        )
    }
}

/**
 * POST - Registra una nueva visita
 * Body: { url: string, ip_address?: string, user_agent?: string, referrer?: string }
 */
export async function POST(request: Request) {
    if (!sql) {
        return NextResponse.json(
            { error: "Database not configured" },
            { status: 500 }
        )
    }

    try {
        const body = await request.json()
        const { url, ip_address, user_agent, referrer } = body as {
            url: string
            ip_address?: string
            user_agent?: string
            referrer?: string
        }

        if (!url) {
            return NextResponse.json(
                { error: "URL es requerida" },
                { status: 400 }
            )
        }

        // Insertar la visita
        const result = await sql`
            INSERT INTO visitas_menu (url, ip_address, user_agent, referrer)
            VALUES (${url}, ${ip_address || null}, ${user_agent || null}, ${referrer || null})
            RETURNING *
        `

        const visita = result[0]

        // Actualizar estadísticas diarias (opcional, para mejorar rendimiento)
        try {
            const fecha = new Date(visita.fecha).toISOString().split('T')[0]
            await sql`
                INSERT INTO visitas_menu_diarias (fecha, url, visitas)
                VALUES (DATE ${fecha}, ${url}, 1)
                ON CONFLICT (fecha, url)
                DO UPDATE SET visitas = visitas_menu_diarias.visitas + 1
            `
        } catch (error) {
            console.error("⚠️  Error actualizando estadísticas diarias:", error)
            // No fallar si esto falla, solo es una optimización
        }

        return NextResponse.json({
            success: true,
            data: {
                id: visita.id,
                url: visita.url,
                fecha: visita.fecha instanceof Date ? visita.fecha.toISOString() : String(visita.fecha),
                ip_address: visita.ip_address,
                user_agent: visita.user_agent,
                referrer: visita.referrer
            }
        }, { status: 201 })

    } catch (error) {
        console.error("❌ Error registering visita:", error)

        return NextResponse.json(
            { error: "Error al registrar la visita", details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        )
    }
}