import { createContext, useContext, useEffect, useRef, ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './AuthContext'

const Ctx = createContext<Socket | null>(null)

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!token) { socketRef.current?.disconnect(); socketRef.current = null; return }

    const socket = io('http://localhost:5001', {
      auth: { token },
      transports: ['websocket'],
    })
    socketRef.current = socket
    return () => { socket.disconnect(); socketRef.current = null }
  }, [token])

  return <Ctx.Provider value={socketRef.current}>{children}</Ctx.Provider>
}

export function useSocket() {
  return useContext(Ctx)
}
