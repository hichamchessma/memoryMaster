import Logo from '../Logo'

type View = 'home' | 'lobby' | 'game' | 'profile' | 'leaderboard'

interface Props {
  current: View
  onChange: (v: View) => void
  collapsed: boolean
  onToggle: () => void
  onLogout: () => void
  elo: number
  isGuest?: boolean
}

const NAV_ALL: { id: View; icon: string; label: string; guestOnly?: false }[] = [
  { id: 'home',        icon: '🏠', label: 'Accueil'   },
  { id: 'lobby',       icon: '🎮', label: 'Salon'      },
  { id: 'leaderboard', icon: '🏆', label: 'Classement' },
  { id: 'profile',     icon: '👤', label: 'Profil'     },
]

// Les invités n'ont accès qu'à l'accueil et au salon
const GUEST_VIEWS: View[] = ['home', 'lobby']

export default function Sidebar({ current, onChange, collapsed, onToggle, onLogout, elo, isGuest }: Props) {
  const nav = isGuest ? NAV_ALL.filter(n => GUEST_VIEWS.includes(n.id)) : NAV_ALL

  return (
    <aside
      className={`flex flex-col h-screen glass border-r border-purple-900/30 transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'}`}
      style={{ background: 'rgba(8,8,20,0.95)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-purple-900/30 h-16">
        {!collapsed && <Logo size="sm" />}
        <button
          onClick={onToggle}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-purple-900/30 transition-all ml-auto"
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* Badge ELO ou Invité */}
      {!collapsed && (
        <div className="mx-4 mt-4">
          {isGuest ? (
            <div className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700/50 border border-slate-600/40 text-slate-400 text-xs font-bold">
              👻 Session invité
            </div>
          ) : (
            <div className="elo-badge w-full justify-center text-xs">
              ⚡ ELO {elo}
            </div>
          )}
        </div>
      )}

      {/* Nav links */}
      <nav className="flex-1 p-3 space-y-1 mt-4">
        {nav.map(n => (
          <button
            key={n.id}
            onClick={() => onChange(n.id)}
            className={`sidebar-link w-full ${current === n.id ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`}
            title={collapsed ? n.label : undefined}
          >
            <span className="text-xl">{n.icon}</span>
            {!collapsed && <span>{n.label}</span>}
          </button>
        ))}

        {/* Liens désactivés pour les invités (affichés grisés avec tooltip) */}
        {isGuest && !collapsed && (
          <div className="pt-2 border-t border-purple-900/20 space-y-1">
            {NAV_ALL.filter(n => !GUEST_VIEWS.includes(n.id)).map(n => (
              <div
                key={n.id}
                className="sidebar-link w-full opacity-30 cursor-not-allowed"
                title="Créez un compte pour accéder à cette section"
              >
                <span className="text-xl">{n.icon}</span>
                <span>{n.label}</span>
                <span className="ml-auto text-[10px] bg-slate-700 px-1.5 py-0.5 rounded">Compte requis</span>
              </div>
            ))}
          </div>
        )}
      </nav>

      {/* Quitter / Déconnexion */}
      <div className="p-3 border-t border-purple-900/30">
        <button
          onClick={onLogout}
          className={`sidebar-link w-full text-red-400 hover:text-red-300 hover:bg-red-900/20 ${collapsed ? 'justify-center px-2' : ''}`}
          title={collapsed ? (isGuest ? 'Quitter' : 'Déconnexion') : undefined}
        >
          <span className="text-xl">🚪</span>
          {!collapsed && <span>{isGuest ? 'Quitter la session' : 'Déconnexion'}</span>}
        </button>
      </div>
    </aside>
  )
}
