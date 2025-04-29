import api from './api'
import { AxiosError } from 'axios'

interface User {
  id: string;
  nombre: string;
  rol: string;
}

export const login = async (nombre: string, password: string): Promise<User> => {
  try {
    console.log('Enviando solicitud de login con:', { nombre, password });
    const response = await api.post('/auth/login', { nombre, password }, { 
      withCredentials: true,
      timeout: 10000 // 10 segundos de timeout
    });
    console.log('Respuesta del servidor:', response.data);
    
    if (response.data && response.data.id && response.data.nombre && response.data.rol) {
      return response.data;
    }
    
    throw new Error('No se recibió información de usuario válida');
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.code === 'ECONNABORTED') {
        console.error('Timeout: El servidor tardó demasiado en responder');
        throw new Error('El servidor no responde. Por favor, intenta más tarde.');
      }
      if (error.response) {
        // El servidor respondió con un código de estado fuera del rango 2xx
        console.error('Error en la respuesta del servidor:', error.response.status, error.response.data);
        throw new Error(`Error del servidor: ${error.response.data.message || 'Ocurrió un error desconocido'}`);
      } else if (error.request) {
        // La solicitud se hizo pero no se recibió respuesta
        console.error('No se recibió respuesta del servidor');
        throw new Error('No se pudo conectar con el servidor. Por favor, verifica tu conexión a internet.');
      }
    }
    // Cualquier otro tipo de error
    console.error('Error al configurar la solicitud:', error);
    throw new Error('Ocurrió un error al intentar iniciar sesión. Por favor, intenta de nuevo.');
  }
};

export const logout = async (): Promise<void> => {
  try {
    await api.post('/auth/logout', {}, { withCredentials: true });
    console.log('Usuario ha cerrado sesión');
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    throw error;
  }
};

export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const response = await api.get('/auth/current-user', { withCredentials: true });
    if (response.data && response.data.id && response.data.nombre && response.data.rol) {
      return response.data;
    }
    return null;
  } catch (error) {
    console.error('Error al obtener el usuario actual:', error);
    return null;
  }
};