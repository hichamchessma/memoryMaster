import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

interface Player { _id: string; firstName: string; lastName: string; elo: number; gamesPlayed: number; gamesWon: number }

export default function LeaderboardView() {
  const { data, isLoading } = useQuery<Player[]>({
    queryKey: ['leaderboard'],
    queryFn: () => api.get('/auth/leaderboard').then(r => r.data.data),
    staleTime: 30_000,
  })

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="p-6 animate-fade-in">
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-purple-900/30">
          <h2 className="text-xl font-gaming font-black text-white">🏆 Classement ELO</h2>
          <p className="text-slate-400 text-sm mt-0.5">Les meilleurs joueurs Memory Master</p>
        </div>

        {isLoading && (
          <div className="p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-2"/>
            Chargement...
          </div>
        )}

        {data?.map((p, i) => {
          const winRate = p.gamesPlayed > 0 ? Math.round((p.gamesWon / p.gamesPlayed) * 100) : 0
          return (
            <div key={p._id}
              className={`flex items-center gap-4 px-6 py-4 transition-colors hover:bg-purple-900/10 ${i < data.length-1 ? 'border-b border-purple-900/20' : ''} ${i < 3 ? 'bg-gradient-to-r from-yellow-900/10 to-transparent' : ''}`}>

              {/* Rank */}
              <div className="w-10 text-center">
                {i < 3 ? (
                  <span className="text-2xl">{medals[i]}</span>
                ) : (
                  <span className="text-slate-400 font-bold text-lg">#{i+1}</span>
                )}
              </div>

              {/* Avatar */}
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
                {p.firstName[0]}{p.lastName[0]}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white truncate">{p.firstName} {p.lastName}</div>
                <div className="text-xs text-slate-400">{p.gamesPlayed} parties • {winRate}% victoires</div>
              </div>

              {/* ELO */}
              <div className="elo-badge flex-shrink-0">⚡ {p.elo}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
