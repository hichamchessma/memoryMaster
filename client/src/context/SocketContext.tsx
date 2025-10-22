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
        console.log('🔌 User logged out, disconnecting socket...');
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // Si un socket existe déjà avec le même token, le réutiliser
    if (socketRef.current && (socketRef.current.auth as any)?.token === user.token) {
      console.log('🔌 Reusing existing socket connection');
      setSocket(socketRef.current);
      setIsConnected(socketRef.current.connected);
      return;
    }

    // Créer une nouvelle instance de socket
    console.log('🔌 Creating new socket connection...');
    const socketInstance = io(SOCKET_URL, {
      auth: {
        token: user.token,
      },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    // Gestion des événements de connexion
    const onConnect = () => {
      console.log('✅ Connected to WebSocket server');
      setIsConnected(true);
    };

    const onDisconnect = (reason: string) => {
      console.log('❌ Disconnected from WebSocket server. Reason:', reason);
      setIsConnected(false);
      
      // Si la déconnexion est due à un transport close, tenter de reconnecter
      if (reason === 'transport close' || reason === 'ping timeout') {
        console.log('🔄 Attempting to reconnect...');
      }
    };

    const onReconnect = (attemptNumber: number) => {
      console.log(`🔄 Reconnected after ${attemptNumber} attempts`);
      setIsConnected(true);
    };

    const onReconnectAttempt = (attemptNumber: number) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}...`);
    };

    const onConnectError = (error: Error) => {
      console.error('❌ WebSocket connection error:', error);
      setIsConnected(false);
    };

    // Écouter les événements de connexion
    socketInstance.on('connect', onConnect);
    socketInstance.on('disconnect', onDisconnect);
    socketInstance.on('reconnect', onReconnect);
    socketInstance.on('reconnect_attempt', onReconnectAttempt);
    socketInstance.on('connect_error', onConnectError);

    socketRef.current = socketInstance;
    setSocket(socketInstance);

    // Nettoyage : NE PAS déconnecter le socket, juste retirer les listeners
    return () => {
      if (socketInstance) {
        socketInstance.off('connect', onConnect);
        socketInstance.off('disconnect', onDisconnect);
        socketInstance.off('reconnect', onReconnect);
        socketInstance.off('reconnect_attempt', onReconnectAttempt);
        socketInstance.off('connect_error', onConnectError);
        // NE PAS appeler socketInstance.disconnect() ici !
        // Le socket reste connecté pour les autres pages
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
