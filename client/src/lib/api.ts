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

// Compteur de requêtes pour détecter les boucles
let requestCount = 0;
const MAX_REQUESTS = 100; // Limite pour éviter les boucles infinies

// Intercepteur pour ajouter le token JWT aux requêtes
api.interceptors.request.use(
  (config) => {
    requestCount++;
    if (requestCount > MAX_REQUESTS) {
      console.error('TROP DE REQUÊTES ! Boucle infinie détectée.');
      return Promise.reject(new Error('Trop de requêtes - boucle infinie détectée'));
    }

    console.log(`Requête #${requestCount} vers ${config.url}`);

    // Priorité au token invité stocké par onglet
    const sessionToken = sessionStorage.getItem('token');
    const token = sessionToken || localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log(`Token ajouté: ${token.substring(0, 20)}...`);
    } else {
      console.log('Aucun token trouvé');
    }
    return config;
  },
  (error) => {
    console.error('Erreur intercepteur requête:', error);
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les réponses et les erreurs
api.interceptors.response.use(
  (response: AxiosResponse<ApiResponse<any>>) => {
    console.log(`Réponse reçue de ${response.config.url}:`, response.status, response.data);
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
    console.error(`Erreur sur ${error.config?.url}:`, error.response?.status, error.response?.data || error.message);

    // Gestion des erreurs HTTP
    if (error.response) {
      // Erreur 401 - Non autorisé
      if (error.response.status === 401) {
        console.log('Erreur 401 - Nettoyage des tokens');
        // Nettoyer les tokens mais NE PAS rediriger ici.
        // Laisser les composants (ProtectedRoute) gérer la navigation sans casser l'URL courante.
        localStorage.removeItem('token');
        // Ne pas toucher au sessionStorage pour préserver les invités par onglet
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
      console.error('Erreur de réseau - pas de réponse du serveur');
      return Promise.reject({
        success: false,
        error: 'Impossible de se connecter au serveur. Vérifiez votre connexion Internet.',
      });
    }

    // Autres erreurs
    console.error('Erreur inattendue:', error);
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
