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
      const token = localStorage.getItem('token');
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
        const response = await api.get<User>('/auth/me');
        if (response.success && response.data) {
          setUser(response.data);
        } else {
          localStorage.removeItem('token');
        }
      } catch (error) {
        console.error('Erreur de vérification de l\'authentification:', error);
        localStorage.removeItem('token');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    // Stocker le token dans le localStorage
    if (userData.token) {
      localStorage.setItem('token', userData.token);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('token');
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
