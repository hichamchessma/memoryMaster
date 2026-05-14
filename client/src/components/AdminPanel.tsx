import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import toast from 'react-hot-toast'
import { useSocket } from '../context/SocketContext'

interface Props { onClose: () => void }

interface Stats {
  totalUsers: number; totalGuests: number
  activeTables: number; waitingTables: number; finishedTables: number
}
interface UserRow {
  _id: string; firstName: string; lastName: string
  email: string; elo: number; gamesPlayed: number; gamesWon: number; createdAt: string
}
interface TableRow {
  _id: string; code: string; maxPlayers: number
  players: { firstName: string }[]; status: string; createdAt: string
}

type Tab = 'stats' | 'users' | 'tables' | 'actions'

export default function AdminPanel({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('stats')
  const [search, setSearch] = useState('')
  const [editEloId, setEditEloId] = useState<string | null>(null)
  const [editEloVal, setEditEloVal] = useState('')
  const [broadcastMsg, setBroadcastMsg] = useState('')
  const socket = useSocket()
  const qc = useQueryClient()

  const { data: stats } = useQuery<Stats>({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then(r => r.data.data),
    refetchInterval: 10000,
  })

  const { data: users = [] } = useQuery<UserRow[]>({
    queryKey: ['admin-users', search],
    queryFn: () => api.get(`/admin/users?search=${encodeURIComponent(search)}`).then(r => r.data.data),
    enabled: tab === 'users',
  })

  const { data: tables = [] } = useQuery<TableRow[]>({
    queryKey: ['admin-tables'],
    queryFn: () => api.get('/admin/tables').then(r => r.data.data),
    enabled: tab === 'tables',
    refetchInterval: tab === 'tables' ? 5000 : false,
  })

  const deleteUser = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); qc.invalidateQueries({ queryKey: ['admin-stats'] }); toast.success('Joueur supprimé') },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  })

  const updateElo = useMutation({
    mutationFn: ({ id, elo }: { id: string; elo: number }) => api.patch(`/admin/users/${id}/elo`, { elo }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); setEditEloId(null); toast.success('ELO mis à jour') },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  })

  const deleteTable = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/tables/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-tables'] }); qc.invalidateQueries({ queryKey: ['admin-stats'] }); toast.success('Table supprimée') },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  })

  const cleanupGuests = useMutation({
    mutationFn: () => api.post('/admin/cleanup-guests'),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['admin-stats'] }); toast.success(`${r.data.deleted} invité(s) nettoyé(s)`) },
    onError: () => toast.error('Erreur'),
  })

  const broadcast = useMutation({
    mutationFn: () => api.post('/admin/broadcast', { message: broadcastMsg }),
    onSuccess: () => { setBroadcastMsg(''); toast.success('Message diffusé à tous les joueurs') },
    onError: () => toast.error('Erreur'),
  })

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'stats',   label: 'Stats',   icon: '📊' },
    { id: 'users',   label: 'Joueurs', icon: '👥' },
    { id: 'tables',  label: 'Tables',  icon: '🎲' },
    { id: 'actions', label: 'Actions', icon: '⚡' },
  ]

  const statusColor: Record<string, string> = {
    waiting:  'text-yellow-400 bg-yellow-400/10',
    playing:  'text-emerald-400 bg-emerald-400/10',
    finished: 'text-slate-400 bg-slate-400/10',
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-40 animate-fade-in" onClick={onClose}/>

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-[520px] z-50 flex flex-col animate-slide-left"
        style={{ background: 'rgba(8,8,25,0.98)', borderLeft: '1px solid rgba(124,58,237,0.3)', backdropFilter: 'blur(20px)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-purple-900/30">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👑</span>
            <div>
              <h2 className="text-white font-gaming font-black text-lg leading-none">Admin Panel</h2>
              <p className="text-slate-500 text-xs mt-0.5">MemoryMaster Pro</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all flex items-center justify-center">
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-purple-900/30 px-4">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-bold transition-all border-b-2 ${
                tab === t.id
                  ? 'text-purple-400 border-purple-500'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* ── STATS ── */}
          {tab === 'stats' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Joueurs inscrits', value: stats?.totalUsers ?? '…', icon: '👤', color: '#7c3aed' },
                  { label: 'Parties actives',  value: stats?.activeTables ?? '…', icon: '⚔️',  color: '#10b981' },
                  { label: 'Tables ouvertes',  value: stats?.waitingTables ?? '…', icon: '🟢', color: '#f59e0b' },
                  { label: 'Invités en ligne', value: stats?.totalGuests ?? '…', icon: '👻', color: '#6b7280' },
                ].map(s => (
                  <div key={s.label} className="rounded-xl p-4 border border-purple-900/30"
                    style={{ background: `${s.color}15` }}>
                    <div className="text-2xl font-gaming font-black text-white">{s.value}</div>
                    <div className="text-xs text-slate-400 mt-1">{s.icon} {s.label}</div>
                  </div>
                ))}
              </div>
              <div className="rounded-xl p-4 border border-purple-900/30 bg-slate-800/30">
                <p className="text-slate-400 text-xs">Parties terminées (DB) : <span className="text-white font-bold">{stats?.finishedTables ?? '…'}</span></p>
              </div>
            </div>
          )}

          {/* ── USERS ── */}
          {tab === 'users' && (
            <div className="space-y-3">
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="🔍 Rechercher un joueur…"
                className="w-full input-field text-sm"
              />
              {users.length === 0 && (
                <p className="text-center text-slate-500 py-8">Aucun joueur trouvé</p>
              )}
              {users.map(u => (
                <div key={u._id} className="rounded-xl p-3 border border-purple-900/20 bg-slate-800/30 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                      {u.firstName[0]}{u.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm truncate">{u.firstName} {u.lastName}</p>
                      <p className="text-slate-500 text-xs truncate">{u.email}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-yellow-400 font-bold text-sm">⚡ {u.elo}</p>
                      <p className="text-slate-500 text-xs">{u.gamesPlayed} parties</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {editEloId === u._id ? (
                      <div className="flex gap-1 flex-1">
                        <input value={editEloVal} onChange={e => setEditEloVal(e.target.value)}
                          className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white"
                          type="number" placeholder="Nouveau ELO"/>
                        <button onClick={() => updateElo.mutate({ id: u._id, elo: Number(editEloVal) })}
                          className="px-2 py-1 rounded-lg bg-emerald-700/50 text-emerald-300 text-xs font-bold hover:bg-emerald-700 transition-all">✓</button>
                        <button onClick={() => setEditEloId(null)}
                          className="px-2 py-1 rounded-lg bg-slate-700 text-slate-400 text-xs hover:bg-slate-600 transition-all">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditEloId(u._id); setEditEloVal(String(u.elo)) }}
                        className="flex-1 py-1 rounded-lg text-xs font-bold text-cyan-300 border border-cyan-800/50 bg-cyan-900/20 hover:bg-cyan-900/40 transition-all">
                        ✏️ ELO
                      </button>
                    )}
                    <button onClick={() => { if (confirm(`Supprimer ${u.firstName} ?`)) deleteUser.mutate(u._id) }}
                      className="px-3 py-1 rounded-lg text-xs font-bold text-red-400 border border-red-800/50 bg-red-900/20 hover:bg-red-900/40 transition-all">
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── TABLES ── */}
          {tab === 'tables' && (
            <div className="space-y-3">
              {tables.length === 0 && (
                <p className="text-center text-slate-500 py-8">Aucune table</p>
              )}
              {tables.map(t => (
                <div key={t._id} className="rounded-xl p-3 border border-purple-900/20 bg-slate-800/30 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-bold text-sm font-mono">{t.code}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${statusColor[t.status] ?? 'text-slate-400'}`}>
                        {t.status}
                      </span>
                      <span className="text-slate-500 text-xs">{t.maxPlayers} joueurs</span>
                    </div>
                    <p className="text-slate-400 text-xs truncate">
                      {t.players.map(p => p.firstName).join(', ') || '—'}
                    </p>
                  </div>
                  <button onClick={() => { if (confirm('Supprimer cette table ?')) deleteTable.mutate(t._id) }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-400 border border-red-800/50 bg-red-900/20 hover:bg-red-900/40 transition-all flex-shrink-0">
                    🗑
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── ACTIONS ── */}
          {tab === 'actions' && (
            <div className="space-y-4">

              {/* Broadcast */}
              <div className="rounded-xl p-4 border border-purple-900/30 bg-slate-800/30 space-y-3">
                <h3 className="text-white font-bold text-sm">📢 Message à tous les joueurs</h3>
                <textarea
                  value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)}
                  placeholder="Message affiché en toast sur tous les écrans connectés…"
                  rows={3}
                  className="w-full input-field text-sm resize-none"
                />
                <button onClick={() => { if (broadcastMsg.trim()) broadcast.mutate() }}
                  disabled={!broadcastMsg.trim() || broadcast.isPending}
                  className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2">
                  {broadcast.isPending ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Envoi…</> : '📢 Diffuser'}
                </button>
              </div>

              {/* Cleanup guests */}
              <div className="rounded-xl p-4 border border-purple-900/30 bg-slate-800/30 space-y-3">
                <h3 className="text-white font-bold text-sm">👻 Nettoyage des invités</h3>
                <p className="text-slate-400 text-xs">Supprime tous les comptes invités orphelins de la base de données.</p>
                <button onClick={() => cleanupGuests.mutate()}
                  disabled={cleanupGuests.isPending}
                  className="w-full py-2.5 rounded-xl text-sm font-bold text-orange-300 border border-orange-800/50 bg-orange-900/20 hover:bg-orange-900/40 transition-all flex items-center justify-center gap-2">
                  {cleanupGuests.isPending ? <><div className="w-4 h-4 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin"/>Nettoyage…</> : '🧹 Nettoyer les invités'}
                </button>
              </div>

              {/* Info admin */}
              <div className="rounded-xl p-4 border border-yellow-900/30 bg-yellow-900/10 space-y-1.5">
                <h3 className="text-yellow-400 font-bold text-sm">👑 Compte admin</h3>
                <p className="text-slate-400 text-xs">Login : <span className="text-white font-mono">admin</span></p>
                <p className="text-slate-400 text-xs">Mot de passe : <span className="text-white font-mono">admin</span></p>
                <p className="text-slate-500 text-xs mt-2">ELO non affiché dans le classement · Statistiques non enregistrées</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
