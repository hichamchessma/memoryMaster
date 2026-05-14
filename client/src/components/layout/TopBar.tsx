import { useState, useEffect } from 'react'
import { useSocket } from '../../context/SocketContext'
import AdminPanel from '../AdminPanel'
import toast from 'react-hot-toast'

type View = 'home' | 'lobby' | 'game' | 'profile' | 'leaderboard'

const TITLES: Record<View, string> = {
  home:        '🏠 Accueil',
  lobby:       '🎮 Salon de jeu',
  game:        '⚔️ Partie en cours',
  profile:     '👤 Mon Profil',
  leaderboard: '🏆 Classement ELO',
}

interface Props {
  view: View
  user: { firstName: string; lastName: string; elo: number; avatar?: string | null; isAdmin?: boolean; isGuest?: boolean }
  onProfileClick: () => void
  isAdmin?: boolean
}

export default function TopBar({ view, user, onProfileClick, isAdmin }: Props) {
  const initials = `${user.firstName[0]}${(user.lastName[0] || user.firstName[1] || '?')}`.toUpperCase()
  const [adminOpen, setAdminOpen] = useState(false)
  const socket = useSocket()

  // Écouter les messages broadcast de l'admin
  useEffect(() => {
    if (!socket) return
    const handler = ({ message }: { message: string }) => {
      toast(message, { icon: '📢', duration: 5000,
        style: { background: '#1e1b4b', color: '#e2e8f0', border: '1px solid rgba(124,58,237,0.4)' } })
    }
    socket.on('admin:message', handler)
    return () => { socket.off('admin:message', handler) }
  }, [socket])

  const handleAvatarClick = () => {
    if (isAdmin) setAdminOpen(true)
    else onProfileClick()
  }

  return (
    <>
      <header className="h-16 flex items-center justify-between px-6 border-b border-purple-900/30"
        style={{ background: 'rgba(8,8,20,0.9)', backdropFilter: 'blur(12px)' }}>

        {/* Title */}
        <h1 className="text-lg font-gaming font-bold text-white">
          {TITLES[view]}
        </h1>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* ELO (masqué pour admin) */}
          {!isAdmin && (
            <div className="elo-badge hidden sm:flex">
              ⚡ {user.elo} ELO
            </div>
          )}

          {/* Nom */}
          <div className="hidden md:flex items-center gap-1 text-sm text-slate-400">
            <span>{isAdmin ? '👑' : 'Joueur'}</span>
            <span className="text-purple-400 font-semibold">{user.firstName}</span>
          </div>

          {/* Avatar — couronne pour admin */}
          <div className="relative">
            <button onClick={handleAvatarClick}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white transition-all hover:ring-2 ${
                isAdmin ? 'hover:ring-yellow-400 ring-2 ring-yellow-500/60' : 'hover:ring-purple-400'
              }`}
              style={{ background: isAdmin
                ? 'linear-gradient(135deg, #b45309, #d97706)'
                : 'linear-gradient(135deg, #7c3aed, #4f46e5)'
              }}
              title={isAdmin ? 'Ouvrir le panel admin' : 'Mon profil'}>
              {user.avatar ? (
                <img src={user.avatar} className="w-full h-full rounded-full object-cover" alt="avatar"/>
              ) : isAdmin ? '👑' : initials}
            </button>
            {/* Pastille admin */}
            {isAdmin && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center text-[9px]">A</span>
            )}
          </div>
        </div>
      </header>

      {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)}/>}
    </>
  )
}
