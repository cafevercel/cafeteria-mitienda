// hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '../app/services/api';

export const useAuth = (vendedorId: string) => {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('No hay token');
        }

        const user = await getCurrentUser();
        console.log('Usuario actual:', user);
        
        if (!user) {
          throw new Error('No se pudo obtener información del usuario');
        }

        if (user.rol !== 'Vendedor') {
          throw new Error('Usuario no autorizado');
        }

        if (user.id.toString() !== vendedorId.toString()) {
          throw new Error('ID de vendedor no coincide');
        }

        setIsAuthenticated(true);
      } catch (error) {
        console.error('Error de autenticación:', error);
        setError(error instanceof Error ? error.message : 'Error de autenticación');
        router.push('/pages/LoginPage');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [vendedorId, router]);

  return { isAuthenticated, isLoading, error };
};
