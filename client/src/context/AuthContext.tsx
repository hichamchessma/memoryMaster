import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface User {
  _id: string
  firstName: string
  lastName: string
  email: string
  elo: number
  gamesPlayed: number
  gamesWon: number
  totalPoints: number
  avatar?: string | null
  isGuest?: boolean
  token?: string
}

interface AuthCtx {
  user: User | null
  token: string | null
  login: (user: User, token: string) => void
  loginAsGuest: (user: User, token: string) => void
  logout: () => void
  updateUser: (partial: Partial<User>) => void
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      // Priorité : session invité (onglet) puis compte persistant
      const guest = JSON.parse(sessionStorage.getItem('mm_guest_user') || 'null')
      if (guest) return guest
      return JSON.parse(localStorage.getItem('mm_user') || 'null')
    } catch { return null }
  })

  const [token, setToken] = useState<string | null>(() =>
    sessionStorage.getItem('mm_guest_token') || localStorage.getItem('mm_token')
  )

  const login = useCallback((u: User, t: string) => {
    // Nettoyer d'éventuelles sessions invité avant de connecter un vrai compte
    sessionStorage.removeItem('mm_guest_user')
    sessionStorage.removeItem('mm_guest_token')
    setUser(u); setToken(t)
    localStorage.setItem('mm_user', JSON.stringify(u))
    localStorage.setItem('mm_token', t)
  }, [])

  const loginAsGuest = useCallback((u: User, t: string) => {
    setUser(u); setToken(t)
    sessionStorage.setItem('mm_guest_user', JSON.stringify(u))
    sessionStorage.setItem('mm_guest_token', t)
  }, [])

  const logout = useCallback(() => {
    setUser(null); setToken(null)
    localStorage.removeItem('mm_user')
    localStorage.removeItem('mm_token')
    sessionStorage.removeItem('mm_guest_user')
    sessionStorage.removeItem('mm_guest_token')
  }, [])

  const updateUser = useCallback((partial: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev
      const next = { ...prev, ...partial }
      if (next.isGuest) {
        sessionStorage.setItem('mm_guest_user', JSON.stringify(next))
      } else {
        localStorage.setItem('mm_user', JSON.stringify(next))
      }
      return next
    })
  }, [])

  return (
    <Ctx.Provider value={{ user, token, login, loginAsGuest, logout, updateUser }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
