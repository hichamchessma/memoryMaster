import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

interface Props {
  onPlay: () => void
  user: { firstName: string; elo: number; gamesPlayed: number; gamesWon: number }
}

export default function HomeView({ onPlay, user }: Props) {
  const winRate = user.gamesPlayed > 0 ? Math.round((user.gamesWon / user.gamesPlayed) * 100) : 0

  const { data: leaders } = useQuery({
    queryKey: ['leaderboard-preview'],
    queryFn: () => api.get('/auth/leaderboard').then(r => r.data.data?.slice(0, 3)),
    staleTime: 60_000,
  })

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Welcome hero */}
      <div className="glass rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 opacity-5"
          style={{ background: 'radial-gradient(circle, #7c3aed, transparent)' }}/>
        <div className="relative z-10">
          <p className="text-slate-400 text-sm font-medium mb-1">Bienvenue de retour,</p>
          <h2 className="text-4xl font-gaming font-black text-white mb-1">
            {user.firstName} <span className="text-yellow-400">👑</span>
          </h2>
          <p className="text-slate-400 mb-6">Prêt à dominer la table ?</p>
          <button onClick={onPlay} className="btn-gold text-base px-8 py-3">
            ⚡ Jouer maintenant
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'ELO', value: user.elo, icon: '⚡', color: 'text-yellow-400' },
          { label: 'Parties', value: user.gamesPlayed, icon: '🎮', color: 'text-purple-400' },
          { label: 'Victoires', value: user.gamesWon, icon: '🏆', color: 'text-emerald-400' },
          { label: 'Win Rate', value: `${winRate}%`, icon: '📈', color: 'text-cyan-400' },
        ].map(s => (
          <div key={s.label} className="glass rounded-xl p-5 text-center">
            <div className="text-3xl mb-1">{s.icon}</div>
            <div className={`text-2xl font-gaming font-black ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Game modes */}
      <div>
        <h3 className="text-white font-bold mb-4 text-lg">Modes de jeu</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: '⚔️', title: '2 Joueurs', desc: 'Duel intense, tête à tête', players: '2', color: 'from-purple-900/60 to-violet-900/40', border: 'border-purple-500/30' },
            { icon: '🔺', title: '3 Joueurs', desc: 'Triangulation stratégique', players: '3', color: 'from-blue-900/60 to-indigo-900/40', border: 'border-blue-500/30' },
            { icon: '💥', title: '4 Joueurs', desc: 'Chaos et bluff maximum', players: '4', color: 'from-rose-900/60 to-pink-900/40', border: 'border-rose-500/30' },
          ].map(m => (
            <button key={m.title} onClick={onPlay}
              className={`bg-gradient-to-br ${m.color} border ${m.border} rounded-xl p-5 text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-lg glass-2`}>
              <div className="text-3xl mb-3">{m.icon}</div>
              <div className="font-gaming font-bold text-white text-lg">{m.title}</div>
              <div className="text-slate-400 text-sm mt-1">{m.desc}</div>
              <div className="mt-3 flex items-center gap-1">
                {[...Array(parseInt(m.players))].map((_, i) => (
                  <div key={i} className="w-6 h-6 rounded-full bg-white/20 border border-white/30 text-xs flex items-center justify-center">👤</div>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Top 3 preview */}
      {leaders && leaders.length > 0 && (
        <div>
          <h3 className="text-white font-bold mb-4 text-lg">🏆 Top joueurs</h3>
          <div className="glass rounded-xl overflow-hidden">
            {leaders.map((p: any, i: number) => (
              <div key={p._id} className={`flex items-center gap-4 px-5 py-3 ${i < leaders.length-1 ? 'border-b border-purple-900/30' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  i === 0 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' :
                  i === 1 ? 'bg-slate-400/20 text-slate-300 border border-slate-400/40' :
                            'bg-amber-700/20 text-amber-600 border border-amber-700/40'
                }`}>{i+1}</div>
                <span className="flex-1 text-white font-medium">{p.firstName} {p.lastName}</span>
                <div className="elo-badge text-xs">⚡ {p.elo}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
