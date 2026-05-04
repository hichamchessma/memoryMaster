import Logo from '../Logo'

type View = 'home' | 'lobby' | 'game' | 'profile' | 'leaderboard'

interface Props {
  current: View
  onChange: (v: View) => void
  collapsed: boolean
  onToggle: () => void
  onLogout: () => void
  elo: number
}

const NAV: { id: View; icon: string; label: string }[] = [
  { id: 'home',        icon: '🏠', label: 'Accueil'    },
  { id: 'lobby',       icon: '🎮', label: 'Salon'       },
  { id: 'leaderboard', icon: '🏆', label: 'Classement'  },
  { id: 'profile',     icon: '👤', label: 'Profil'      },
]

export default function Sidebar({ current, onChange, collapsed, onToggle, onLogout, elo }: Props) {
  return (
    <aside className={`flex flex-col h-screen glass border-r border-purple-900/30 transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'}`}
      style={{ background: 'rgba(8,8,20,0.95)' }}>

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-purple-900/30 h-16">
        {!collapsed && <Logo size="sm" />}
        <button onClick={onToggle}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-purple-900/30 transition-all ml-auto">
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* ELO badge */}
      {!collapsed && (
        <div className="mx-4 mt-4">
          <div className="elo-badge w-full justify-center text-xs">
            ⚡ ELO {elo}
          </div>
        </div>
      )}

      {/* Nav links */}
      <nav className="flex-1 p-3 space-y-1 mt-4">
        {NAV.map(n => (
          <button key={n.id} onClick={() => onChange(n.id)}
            className={`sidebar-link w-full ${current === n.id ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`}
            title={collapsed ? n.label : undefined}>
            <span className="text-xl">{n.icon}</span>
            {!collapsed && <span>{n.label}</span>}
          </button>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-purple-900/30">
        <button onClick={onLogout}
          className={`sidebar-link w-full text-red-400 hover:text-red-300 hover:bg-red-900/20 ${collapsed ? 'justify-center px-2' : ''}`}
          title={collapsed ? 'Déconnexion' : undefined}>
          <span className="text-xl">🚪</span>
          {!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </aside>
  )
}
