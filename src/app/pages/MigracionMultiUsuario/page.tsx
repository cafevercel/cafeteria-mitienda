'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';

interface MigrationStats {
    total_productos: number;
    usuarios_con_productos: number;
    productos_sin_usuario: number;
}

interface UserSummary {
    usuario: string;
    rol: string;
    total_productos: number;
    cantidad_total: number;
}

interface MigrationResponse {
    success: boolean;
    message: string;
    estadisticas?: MigrationStats;
    resumen_por_usuario?: UserSummary[];
    error?: string;
    details?: string;
}

interface StatusResponse {
    migrado: boolean;
    message: string;
    resumen?: UserSummary[];
}

export default function MigracionMultiUsuarioPage() {
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(false);
    const [result, setResult] = useState<MigrationResponse | null>(null);
    const [status, setStatus] = useState<StatusResponse | null>(null);

    const checkStatus = async () => {
        setChecking(true);
        try {
            const response = await fetch('/api/migration/multiusuario');
            const data = await response.json();
            setStatus(data);
        } catch (error) {
            console.error('Error verificando estado:', error);
            setStatus({
                migrado: false,
                message: 'Error al verificar estado'
            });
        } finally {
            setChecking(false);
        }
    };

    const executeMigration = async () => {
        if (!confirm('⚠️ ADVERTENCIA: Esta acción modificará la estructura de la base de datos.\n\n¿Estás seguro de que quieres continuar?\n\nAsegúrate de tener un backup de la base de datos.')) {
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const response = await fetch('/api/migration/multiusuario', {
                method: 'POST',
            });

            const data = await response.json();
            setResult(data);

            if (data.success) {
                // Actualizar estado después de migración exitosa
                await checkStatus();
            }
        } catch (error) {
            console.error('Error ejecutando migración:', error);
            setResult({
                success: false,
                message: 'Error al ejecutar la migración',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-6 max-w-4xl">
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold">Migración Multi-Usuario</h1>
                    <p className="text-gray-600 mt-2">
                        Migrar sistema de cafetería/cocina a sistema multi-usuario
                    </p>
                </div>

                {/* Información de la migración */}
                <Card>
                    <CardHeader>
                        <CardTitle>¿Qué hace esta migración?</CardTitle>
                        <CardDescription>
                            Información sobre los cambios que se aplicarán
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <h3 className="font-semibold">Cambios que se aplicarán:</h3>
                            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                                <li>Se agregará la columna <code className="bg-gray-100 px-1 rounded">usuario_id</code> a la tabla <code className="bg-gray-100 px-1 rounded">usuario_productos</code></li>
                                <li>Se crearán dos usuarios: <strong>Cafetería</strong> y <strong>Cocina</strong></li>
                                <li>Todos los productos actuales de <code className="bg-gray-100 px-1 rounded">usuario_productos</code> se asignarán a <strong>Cafetería</strong></li>
                                <li>Los productos de la tabla <code className="bg-gray-100 px-1 rounded">cocina</code> se migrarán a <strong>Cocina</strong></li>
                                <li>Los parámetros de <code className="bg-gray-100 px-1 rounded">cocina_parametros</code> se migrarán a <code className="bg-gray-100 px-1 rounded">usuario_producto_parametros</code></li>
                                <li>Las tablas <code className="bg-gray-100 px-1 rounded">cocina</code> y <code className="bg-gray-100 px-1 rounded">cocina_parametros</code> se renombrarán a <code className="bg-gray-100 px-1 rounded">*_old</code></li>
                            </ul>
                        </div>

                        <Alert className="bg-yellow-50 border-yellow-200">
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            <AlertDescription className="text-yellow-800">
                                <strong>Importante:</strong> Asegúrate de tener un backup de la base de datos antes de ejecutar esta migración.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>

                {/* Verificar estado */}
                <Card>
                    <CardHeader>
                        <CardTitle>Estado Actual</CardTitle>
                        <CardDescription>
                            Verifica si la migración ya fue ejecutada
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button
                            onClick={checkStatus}
                            disabled={checking}
                            variant="outline"
                            className="w-full"
                        >
                            {checking ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Verificando...
                                </>
                            ) : (
                                'Verificar Estado'
                            )}
                        </Button>

                        {status && (
                            <div className="mt-4">
                                {status.migrado ? (
                                    <Alert className="bg-green-50 border-green-200">
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                        <AlertDescription className="text-green-800">
                                            <strong>Migración completada:</strong> {status.message}
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    <Alert className="bg-blue-50 border-blue-200">
                                        <AlertDescription className="text-blue-800">
                                            <strong>Pendiente:</strong> {status.message}
                                        </AlertDescription>
                                    </Alert>
                                )}

                                {status.resumen && status.resumen.length > 0 && (
                                    <div className="mt-4">
                                        <h4 className="font-semibold mb-2">Resumen por Usuario:</h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-4 py-2 text-left">Usuario</th>
                                                        <th className="px-4 py-2 text-left">Rol</th>
                                                        <th className="px-4 py-2 text-right">Productos</th>
                                                        <th className="px-4 py-2 text-right">Cantidad Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {status.resumen.map((user, idx) => (
                                                        <tr key={idx} className="border-t">
                                                            <td className="px-4 py-2">{user.usuario}</td>
                                                            <td className="px-4 py-2">{user.rol}</td>
                                                            <td className="px-4 py-2 text-right">{user.total_productos}</td>
                                                            <td className="px-4 py-2 text-right">{user.cantidad_total}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Ejecutar migración */}
                {!status?.migrado && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Ejecutar Migración</CardTitle>
                            <CardDescription>
                                Inicia el proceso de migración a sistema multi-usuario
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Button
                                onClick={executeMigration}
                                disabled={loading}
                                className="w-full"
                                variant="default"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Ejecutando migración...
                                    </>
                                ) : (
                                    'Ejecutar Migración'
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Resultado de la migración */}
                {result && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Resultado de la Migración</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {result.success ? (
                                <div className="space-y-4">
                                    <Alert className="bg-green-50 border-green-200">
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                        <AlertDescription className="text-green-800">
                                            <strong>¡Éxito!</strong> {result.message}
                                        </AlertDescription>
                                    </Alert>

                                    {result.estadisticas && (
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="bg-blue-50 p-4 rounded-lg">
                                                <div className="text-2xl font-bold text-blue-700">
                                                    {result.estadisticas.total_productos}
                                                </div>
                                                <div className="text-sm text-blue-600">Total Productos</div>
                                            </div>
                                            <div className="bg-green-50 p-4 rounded-lg">
                                                <div className="text-2xl font-bold text-green-700">
                                                    {result.estadisticas.usuarios_con_productos}
                                                </div>
                                                <div className="text-sm text-green-600">Usuarios con Productos</div>
                                            </div>
                                            <div className="bg-gray-50 p-4 rounded-lg">
                                                <div className="text-2xl font-bold text-gray-700">
                                                    {result.estadisticas.productos_sin_usuario}
                                                </div>
                                                <div className="text-sm text-gray-600">Sin Usuario</div>
                                            </div>
                                        </div>
                                    )}

                                    {result.resumen_por_usuario && result.resumen_por_usuario.length > 0 && (
                                        <div>
                                            <h4 className="font-semibold mb-2">Resumen por Usuario:</h4>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-4 py-2 text-left">Usuario</th>
                                                            <th className="px-4 py-2 text-left">Rol</th>
                                                            <th className="px-4 py-2 text-right">Productos</th>
                                                            <th className="px-4 py-2 text-right">Cantidad Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {result.resumen_por_usuario.map((user, idx) => (
                                                            <tr key={idx} className="border-t">
                                                                <td className="px-4 py-2">{user.usuario}</td>
                                                                <td className="px-4 py-2">{user.rol}</td>
                                                                <td className="px-4 py-2 text-right">{user.total_productos}</td>
                                                                <td className="px-4 py-2 text-right">{user.cantidad_total}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <Alert className="bg-red-50 border-red-200">
                                    <XCircle className="h-4 w-4 text-red-600" />
                                    <AlertDescription className="text-red-800">
                                        <strong>Error:</strong> {result.error || result.message}
                                        {result.details && (
                                            <div className="mt-2 text-sm">
                                                <strong>Detalles:</strong> {result.details}
                                            </div>
                                        )}
                                    </AlertDescription>
                                </Alert>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
