import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types/index';
import api from '../lib/api';

// Extension de l'interface User pour inclure le token
declare global {
  namespace App {
    interface User {
      token?: string;
    }
  }
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (userData: User) => void;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Vérifier l'état d'authentification au chargement
  useEffect(() => {
    // DEV ONLY (opt-in): auto-login d'un utilisateur fictif si VITE_ENABLE_DEV_AUTOLOGIN === 'true'
    const devAutologinEnabled = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_AUTOLOGIN === 'true';
    if (devAutologinEnabled && !localStorage.getItem('token')) {
      const devUser = {
        _id: 'dev-user-id',
        firstName: 'Dev',
        lastName: 'User',
        email: 'dev@memorymaster.local',
        age: 30,
        nationality: 'FR',
        elo: 1000,
        totalPoints: 0,
        avatar: '',
        token: 'dev-token',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setUser(devUser as User);
      setIsLoading(false);
      localStorage.setItem('token', 'dev-token');
      return;
    }
    const checkAuth = async () => {
      // Préférence au token d'onglet (invité)
      const token = sessionStorage.getItem('token') || localStorage.getItem('token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      // DEV ONLY (opt-in): si token est 'dev-token', injecte le user de dev sans appel API
      if (devAutologinEnabled && token === 'dev-token') {
        const devUser = {
          _id: 'dev-user-id',
          firstName: 'Dev',
          lastName: 'User',
          email: 'dev@memorymaster.local',
          age: 30,
          nationality: 'FR',
          elo: 1000,
          totalPoints: 0,
          avatar: '',
          token: 'dev-token',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setUser(devUser as User);
        setIsLoading(false);
        return;
      }
      try {
        const response: any = await api.get<User>('/auth/me');
        // Supporte plusieurs formes:
        // 1) Réponse brute utilisateur: { _id, firstName, ... }
        if (response && response._id) {
          setUser(response as User);
        }
        // 2) AxiosResponse avec data = user
        else if (response && response.data && response.data._id) {
          setUser(response.data as User);
        }
        // 3) Enveloppe { success, data }
        else if (response && response.success && response.data) {
          setUser(response.data as User);
        } else {
          // Forme inattendue: tenter une restauration invité
          console.warn('Réponse /auth/me inattendue', response);
          const guestRaw = sessionStorage.getItem('guestUser');
          if (guestRaw) {
            try { setUser(JSON.parse(guestRaw) as User); } catch {}
          } else {
            setUser(null);
          }
        }
      } catch (error) {
        // Pas de redirection ici. En cas d'erreur (ex: 401 ou réseau), tenter une restauration invité.
        console.error('Erreur de vérification de l\'authentification:', error);
        const guestRaw = sessionStorage.getItem('guestUser');
        if (guestRaw) {
          try { setUser(JSON.parse(guestRaw) as User); } catch { setUser(null); }
        } else {
          setUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    // Invité => token par onglet (sessionStorage). Utilisateur normal => localStorage.
    if (userData.token) {
      if ((userData as any).role === 'guest') {
        sessionStorage.setItem('token', userData.token);
        sessionStorage.setItem('guestUser', JSON.stringify(userData));
        // S'assurer qu'aucun ancien token persistant ne traîne
        localStorage.removeItem('token');
      } else {
        localStorage.setItem('token', userData.token);
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('guestUser');
      }
    }
  };

  const logout = () => {
    setUser(null);
    // Nettoyer les deux stockages
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('guestUser');
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...userData });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
