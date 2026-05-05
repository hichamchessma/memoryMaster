import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import toast from 'react-hot-toast'

interface Props {
  onJoinGame: (tableId: string) => void
  user: { _id: string; firstName: string }
}

interface Table {
  _id: string
  code: string
  maxPlayers: number
  players: { userId: string; firstName: string; lastName: string; isReady: boolean; isHost: boolean }[]
  status: 'waiting' | 'playing' | 'finished'
  hostId: string
  createdAt: string
}

export default function LobbyView({ onJoinGame, user }: Props) {
  const [creating, setCreating] = useState<2|3|4|null>(null)
  const qc = useQueryClient()

  const [vsBot, setVsBot] = useState(false)
  const [cleaning, setCleaning] = useState(false)

  const { data: tables = [], isLoading } = useQuery<Table[]>({
    queryKey: ['tables'],
    queryFn: () => api.get('/tables').then(r => r.data.data),
    refetchInterval: 4000,
  })

  const playVsBot = async () => {
    setVsBot(true)
    try {
      const { data } = await api.post('/tables/vs-bot')
      toast.success('Partie contre le Bot créée !')
      onJoinGame(data.data._id)
    } catch {
      toast.error('Impossible de créer la partie')
    } finally { setVsBot(false) }
  }

  const cleanupMyTables = async () => {
    setCleaning(true)
    try {
      const { data } = await api.delete('/tables/cleanup/mine')
      qc.invalidateQueries({ queryKey: ['tables'] })
      toast.success(`${data.deleted} table(s) nettoyée(s)`)
    } catch { toast.error('Erreur lors du nettoyage') }
    finally { setCleaning(false) }
  }

  const createTable = async (max: 2|3|4) => {
    setCreating(max)
    try {
      const { data } = await api.post('/tables', { maxPlayers: max })
      qc.invalidateQueries({ queryKey: ['tables'] })
      toast.success('Table créée !')
      onJoinGame(data.data._id)
    } catch {
      toast.error('Impossible de créer la table')
    } finally { setCreating(null) }
  }

  const joinTable = async (table: Table) => {
    if (table.status !== 'waiting') { toast.error('Partie déjà commencée'); return }
    if (table.players.length >= table.maxPlayers) { toast.error('Table pleine'); return }
    onJoinGame(table._id)
  }

  const deleteTable = async (tableId: string) => {
    if (!confirm('Supprimer cette table ?')) return
    try {
      await api.delete(`/tables/${tableId}`)
      qc.invalidateQueries({ queryKey: ['tables'] })
      toast.success('Table supprimée')
    } catch { toast.error('Erreur lors de la suppression') }
  }

  const waiting = tables.filter(t => t.status === 'waiting')
  const playing  = tables.filter(t => t.status === 'playing')

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Create table */}
      <div className="glass rounded-2xl p-6">
        <h3 className="text-white font-gaming font-bold text-xl mb-4">✨ Créer une table</h3>
        <div className="flex flex-wrap gap-3">
          {/* Bot button — highlighted */}
          <button onClick={playVsBot} disabled={vsBot}
            className="relative overflow-hidden font-bold rounded-xl px-6 py-3 text-white transition-all duration-300 flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 20px rgba(16,185,129,0.4)' }}>
            {vsBot
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Création...</>
              : <>🤖 Jouer contre le Bot</>
            }
          </button>

          <div className="w-px bg-purple-800/50 self-stretch mx-1"/>

          {([2,3,4] as const).map(n => (
            <button key={n} onClick={() => createTable(n)} disabled={creating !== null}
              className={`btn-primary px-6 py-3 flex items-center gap-2 ${creating === n ? 'opacity-70' : ''}`}>
              {creating === n
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Création...</>
                : <>{['👥','🔺','💥'][n-2]} {n} joueurs</>
              }
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-3">🤖 Le bot joue automatiquement — parfait pour s'entraîner seul</p>
        <div className="mt-3 pt-3 border-t border-purple-900/30 flex items-center gap-2">
          <button onClick={cleanupMyTables} disabled={cleaning}
            className="text-xs text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1">
            {cleaning ? '⏳ Nettoyage...' : '🗑 Nettoyer mes vieilles tables'}
          </button>
        </div>
      </div>

      {/* Tables en attente */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-white font-bold text-lg">🟢 Tables ouvertes</h3>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            {waiting.length}
          </span>
        </div>

        {isLoading && (
          <div className="text-center py-8 text-slate-400">
            <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-2"/>
            Chargement...
          </div>
        )}

        {!isLoading && waiting.length === 0 && (
          <div className="glass rounded-xl p-8 text-center text-slate-400">
            <div className="text-4xl mb-2">🎲</div>
            <p>Aucune table ouverte. Créez la première !</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {waiting.map(table => {
            const taken = table.players.length
            const isInTable = table.players.some(p => p.userId === user._id)
            const isHost = table.hostId === user._id
            return (
              <div key={table._id} className="glass-2 rounded-xl p-5 border border-purple-900/30 hover:border-purple-500/50 transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-gaming font-bold text-white text-lg">
                      {['⚔️','🔺','💥'][table.maxPlayers-2]} {table.maxPlayers} joueurs
                    </span>
                    <div className="text-xs text-slate-500 mt-0.5">Code: <span className="text-purple-400 font-mono">{table.code}</span></div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-white">{taken}/{table.maxPlayers}</div>
                    <div className="text-xs text-slate-400">places</div>
                  </div>
                </div>

                {/* Players */}
                <div className="flex gap-1.5 mb-4">
                  {[...Array(table.maxPlayers)].map((_, i) => {
                    const p = table.players[i]
                    return (
                      <div key={i} className={`flex-1 h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-all ${
                        p ? 'bg-purple-600/40 border border-purple-500/50 text-white' : 'border border-dashed border-slate-600/50 text-slate-600'
                      }`}>
                        {p ? `${p.firstName[0]}${p.firstName[1] || ''}` : '—'}
                      </div>
                    )
                  })}
                </div>

                {/* Host name */}
                <div className="text-xs text-slate-400 mb-3">
                  Hôte: <span className="text-white">{table.players[0]?.firstName || '—'}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {isInTable ? (
                    <button onClick={() => onJoinGame(table._id)} className="btn-gold flex-1 py-2 text-sm">
                      Retourner →
                    </button>
                  ) : taken < table.maxPlayers ? (
                    <button onClick={() => joinTable(table)} className="btn-primary flex-1 py-2 text-sm">
                      Rejoindre →
                    </button>
                  ) : (
                    <div className="flex-1 text-center py-2 text-sm text-slate-500">Table pleine</div>
                  )}
                  {isHost && (
                    <button onClick={() => deleteTable(table._id)} className="btn-danger px-3 py-2 text-sm">🗑</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Parties en cours */}
      {playing.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-white font-bold text-lg">🔴 Parties en cours</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">{playing.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {playing.map(table => (
              <div key={table._id} className="glass-2 rounded-xl p-5 border border-red-900/30 opacity-75">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse"/>
                  <span className="text-white font-bold">{table.maxPlayers} joueurs — En cours</span>
                </div>
                <div className="text-xs text-slate-400">{table.players.map(p => p.firstName).join(' vs ')}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
