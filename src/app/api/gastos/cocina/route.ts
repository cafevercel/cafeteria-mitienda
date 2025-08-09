// api/gastos/cocina/route.ts - Versión completa con tipos corregidos
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ✅ Definir interfaces para mejor tipado
interface ParametroInfo {
    nombre: string;
    cantidad: number;
}

interface GastoInfo {
    id: string;
    nombre: string;
    cantidad: number;
    fecha: string;
}

interface ProductoInfo {
    id: string;
    precio_compra: number;
    tiene_parametros: boolean;
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const gastoId = searchParams.get('id');

        if (!gastoId) {
            return NextResponse.json({
                error: 'Se requiere el ID del gasto'
            }, { status: 400 });
        }

        await query('BEGIN');

        try {
            // 1. Obtener información del gasto antes de eliminarlo
            const gastoResult = await query(`
                SELECT id, nombre, cantidad, fecha
                FROM gastos 
                WHERE id = $1
            `, [gastoId]);

            if (gastoResult.rows.length === 0) {
                await query('ROLLBACK');
                return NextResponse.json({
                    error: 'Gasto no encontrado'
                }, { status: 404 });
            }

            const gasto: GastoInfo = gastoResult.rows[0];

            // 2. Verificar si es un gasto de cocina
            if (!gasto.nombre.includes('Consumo cocina:')) {
                await query('ROLLBACK');
                return NextResponse.json({
                    error: 'Solo se pueden eliminar gastos de cocina'
                }, { status: 400 });
            }

            // 3. Extraer información del producto del nombre del gasto
            const nombreMatch = gasto.nombre.match(/Consumo cocina:\s*([^(]+)/);
            if (!nombreMatch) {
                await query('ROLLBACK');
                return NextResponse.json({
                    error: 'No se pudo identificar el producto del gasto'
                }, { status: 400 });
            }

            const nombreProducto = nombreMatch[1].trim();

            // 4. Buscar el producto por nombre
            const productoResult = await query(`
                SELECT id, precio_compra, tiene_parametros
                FROM productos 
                WHERE nombre = $1
            `, [nombreProducto]);

            if (productoResult.rows.length === 0) {
                await query('ROLLBACK');
                return NextResponse.json({
                    error: `Producto "${nombreProducto}" no encontrado`
                }, { status: 404 });
            }

            const producto: ProductoInfo = productoResult.rows[0];
            const precioCompra = Number(producto.precio_compra) || 0;

            if (precioCompra === 0) {
                await query('ROLLBACK');
                return NextResponse.json({
                    error: 'El producto no tiene precio de compra definido'
                }, { status: 400 });
            }

            // 5. Calcular la cantidad a devolver
            const cantidadDevolver = Number(gasto.cantidad) / precioCompra;

            // 6. Extraer detalles de parámetros si los hay
            const parametrosMatch = gasto.nombre.match(/\(([^)]+)\)/);
            let parametrosInfo: ParametroInfo[] | null = null;

            if (parametrosMatch && producto.tiene_parametros) {
                // ✅ CORRECCIÓN: Agregar tipos explícitos
                const parametrosStr = parametrosMatch[1];
                const parametrosArray = parametrosStr.split(',').map((p: string) => {
                    const [nombre, cantidad] = p.split(':').map((s: string) => s.trim());
                    return {
                        nombre: nombre,
                        cantidad: parseFloat(cantidad) || 0
                    };
                }).filter((p: ParametroInfo) => p.cantidad > 0);

                if (parametrosArray.length > 0) {
                    parametrosInfo = parametrosArray;
                }
            }

            // 7. Devolver cantidad a cocina
            if (producto.tiene_parametros && parametrosInfo) {
                // ✅ CORRECCIÓN: Tipo explícito en for loop
                for (const param of parametrosInfo) {
                    // Verificar si el parámetro existe
                    const paramExistsResult = await query(`
                        SELECT cantidad 
                        FROM cocina_parametros 
                        WHERE producto_id = $1 AND nombre = $2
                    `, [producto.id, param.nombre]);

                    if (paramExistsResult.rows.length > 0) {
                        // Actualizar cantidad existente
                        await query(`
                            UPDATE cocina_parametros 
                            SET cantidad = cantidad + $1
                            WHERE producto_id = $2 AND nombre = $3
                        `, [param.cantidad, producto.id, param.nombre]);
                    } else {
                        // Crear nuevo parámetro
                        await query(`
                            INSERT INTO cocina_parametros (producto_id, nombre, cantidad)
                            VALUES ($1, $2, $3)
                        `, [producto.id, param.nombre, param.cantidad]);
                    }
                }
            } else {
                // Devolver a tabla cocina principal
                const cocinaExistsResult = await query(`
                    SELECT cantidad 
                    FROM cocina 
                    WHERE producto_id = $1
                `, [producto.id]);

                if (cocinaExistsResult.rows.length > 0) {
                    // Actualizar cantidad existente
                    await query(`
                        UPDATE cocina 
                        SET cantidad = cantidad + $1
                        WHERE producto_id = $2
                    `, [cantidadDevolver, producto.id]);
                } else {
                    // Crear nuevo registro en cocina
                    await query(`
                        INSERT INTO cocina (producto_id, cantidad)
                        VALUES ($1, $2)
                    `, [producto.id, cantidadDevolver]);
                }
            }

            // 8. Eliminar el gasto
            await query(`
                DELETE FROM gastos WHERE id = $1
            `, [gastoId]);

            await query('COMMIT');

            return NextResponse.json({
                message: 'Gasto eliminado y cantidad devuelta a cocina exitosamente',
                gasto: {
                    id: gasto.id,
                    nombre: gasto.nombre,
                    cantidad: gasto.cantidad,
                    producto: nombreProducto,
                    cantidadDevuelta: parametrosInfo || cantidadDevolver
                }
            });

        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }

    } catch (error) {
        console.error('Error al eliminar gasto de cocina:', error);
        return NextResponse.json({
            error: 'Error interno del servidor al eliminar gasto'
        }, { status: 500 });
    }
}
