import { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  // Effet pour gérer la connexion/déconnexion du socket
  useEffect(() => {
    // Ne rien faire si l'utilisateur n'est pas authentifié
    if (!isAuthenticated || !user?.token) {
      // Nettoyer la connexion existante si nécessaire
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // Créer une nouvelle instance de socket
    const socketInstance = io(SOCKET_URL, {
      auth: {
        token: user.token,
      },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Gestion des événements de connexion
    const onConnect = () => {
      console.log('Connected to WebSocket server');
      setIsConnected(true);
    };

    const onDisconnect = () => {
      console.log('Disconnected from WebSocket server');
      setIsConnected(false);
    };

    const onConnectError = (error: Error) => {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);
    };

    // Écouter les événements de connexion
    socketInstance.on('connect', onConnect);
    socketInstance.on('disconnect', onDisconnect);
    socketInstance.on('connect_error', onConnectError);

    socketRef.current = socketInstance;
    setSocket(socketInstance);

    // Nettoyage lors du démontage du composant
    return () => {
      if (socketInstance) {
        socketInstance.off('connect', onConnect);
        socketInstance.off('disconnect', onDisconnect);
        socketInstance.off('connect_error', onConnectError);
        socketInstance.disconnect();
      }
      
      if (socketRef.current === socketInstance) {
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
    };
  }, [isAuthenticated, user?.token]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
