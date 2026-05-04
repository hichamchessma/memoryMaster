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
  user: { firstName: string; lastName: string; elo: number; avatar?: string | null }
  onProfileClick: () => void
}

export default function TopBar({ view, user, onProfileClick }: Props) {
  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-purple-900/30"
      style={{ background: 'rgba(8,8,20,0.9)', backdropFilter: 'blur(12px)' }}>

      {/* Title */}
      <h1 className="text-lg font-gaming font-bold text-white">
        {TITLES[view]}
      </h1>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* ELO */}
        <div className="elo-badge hidden sm:flex">
          ⚡ {user.elo} ELO
        </div>

        {/* Win rate */}
        <div className="hidden md:flex items-center gap-1 text-sm text-slate-400">
          <span>Joueur</span>
          <span className="text-purple-400 font-semibold">{user.firstName}</span>
        </div>

        {/* Avatar */}
        <button onClick={onProfileClick}
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white transition-all hover:ring-2 hover:ring-purple-400"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
          {user.avatar ? (
            <img src={user.avatar} className="w-full h-full rounded-full object-cover" alt="avatar"/>
          ) : initials}
        </button>
      </div>
    </header>
  )
}
