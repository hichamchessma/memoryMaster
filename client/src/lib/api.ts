import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import type { ApiResponse } from '../types';

// Configuration de base d'Axios
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Intercepteur pour ajouter le token JWT aux requêtes
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les réponses et les erreurs
api.interceptors.response.use(
  (response: AxiosResponse<ApiResponse<any>>) => {
    // Si la réponse contient des données, on les retourne directement
    if (response.data) {
      // Retourner la réponse complète pour préserver le typage Axios
      return {
        ...response,
        data: response.data as ApiResponse<any>
      };
    }
    return response;
  },
  (error: AxiosError<ApiResponse<any>>) => {
    // Gestion des erreurs HTTP
    if (error.response) {
      // Erreur 401 - Non autorisé
      if (error.response.status === 401) {
        // Rediriger vers la page de connexion
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
      
      // Retourner l'erreur avec le message du serveur
      return Promise.reject({
        success: false,
        error: error.response.data?.error || 'Une erreur est survenue',
        status: error.response.status,
      });
    }
    
    // Erreur de réseau
    if (error.request) {
      return Promise.reject({
        success: false,
        error: 'Impossible de se connecter au serveur. Vérifiez votre connexion Internet.',
      });
    }
    
    // Autres erreurs
    return Promise.reject({
      success: false,
      error: 'Une erreur inattendue est survenue',
    });
  }
);

// Méthodes HTTP typées
const http = {
  get: <T = any>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> => api.get(url, config),

  post: <T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> => api.post(url, data, config),

  put: <T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> => api.put(url, data, config),

  delete: <T = any>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> => api.delete(url, config),

  patch: <T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> => api.patch(url, data, config),
};

export default http;
