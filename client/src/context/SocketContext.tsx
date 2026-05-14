import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './AuthContext'

const Ctx = createContext<Socket | null>(null)

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    if (!token) {
      setSocket(prev => { prev?.disconnect(); return null })
      return
    }

    // En production, Express et le client sont sur le même serveur → même origine
    const serverUrl = import.meta.env.DEV ? 'http://localhost:5001' : window.location.origin
    const s = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    })

    s.on('connect', () => setSocket(s))

    return () => {
      s.disconnect()
      setSocket(null)
    }
  }, [token])

  return <Ctx.Provider value={socket}>{children}</Ctx.Provider>
}

export function useSocket() {
  return useContext(Ctx)
}
