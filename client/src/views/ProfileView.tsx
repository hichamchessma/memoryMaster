import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'
import toast from 'react-hot-toast'

interface Props { user: { firstName: string; lastName: string; email: string; elo: number; gamesPlayed: number; gamesWon: number } }

export default function ProfileView({ user }: Props) {
  const { updateUser } = useAuth()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ firstName: user.firstName, lastName: user.lastName })
  const [saving, setSaving] = useState(false)

  const winRate = user.gamesPlayed > 0 ? Math.round((user.gamesWon / user.gamesPlayed) * 100) : 0
  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()

  const save = async () => {
    setSaving(true)
    try {
      const { data } = await api.patch('/auth/profile', form)
      updateUser(data.user)
      setEditing(false)
      toast.success('Profil mis à jour !')
    } catch { toast.error('Erreur lors de la mise à jour') }
    finally { setSaving(false) }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Card profil */}
      <div className="glass rounded-2xl p-8">
        {/* Avatar + info */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-8">
          <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-3xl font-black text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 0 32px rgba(124,58,237,0.4)' }}>
            {initials}
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-2xl font-gaming font-black text-white">{user.firstName} {user.lastName}</h2>
            <p className="text-slate-400 mt-1">{user.email}</p>
            <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
              <div className="elo-badge">⚡ {user.elo} ELO</div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Parties', value: user.gamesPlayed, icon: '🎮' },
            { label: 'Victoires', value: user.gamesWon, icon: '🏆' },
            { label: 'Win Rate', value: `${winRate}%`, icon: '📈' },
          ].map(s => (
            <div key={s.label} className="glass-2 rounded-xl p-4 text-center">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-xl font-gaming font-black text-white">{s.value}</div>
              <div className="text-xs text-slate-400 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Edit form */}
        {!editing ? (
          <button onClick={() => setEditing(true)} className="btn-outline w-full py-3">
            ✏️ Modifier le profil
          </button>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Prénom</label>
                <input className="input-field" value={form.firstName}
                  onChange={e => setForm(f => ({...f, firstName: e.target.value}))} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Nom</label>
                <input className="input-field" value={form.lastName}
                  onChange={e => setForm(f => ({...f, lastName: e.target.value}))} />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={save} disabled={saving} className="btn-primary flex-1 py-3">
                {saving ? 'Enregistrement...' : '✓ Enregistrer'}
              </button>
              <button onClick={() => setEditing(false)} className="btn-outline flex-1 py-3">
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ELO range indicator */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-white font-bold mb-4">Rang ELO</h3>
        <div className="space-y-2">
          {[
            { label: 'Novice',    min: 0,    max: 900,  color: '#94a3b8' },
            { label: 'Initié',   min: 900,  max: 1100, color: '#818cf8' },
            { label: 'Expert',   min: 1100, max: 1300, color: '#7c3aed' },
            { label: 'Maître',   min: 1300, max: 1500, color: '#fbbf24' },
            { label: 'Légende',  min: 1500, max: 9999, color: '#f43f5e' },
          ].map(r => {
            const active = user.elo >= r.min && user.elo < r.max
            return (
              <div key={r.label} className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${active ? 'bg-white/10 border border-white/20' : ''}`}>
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: r.color }}/>
                <span className={`font-medium ${active ? 'text-white' : 'text-slate-500'}`}>{r.label}</span>
                <span className="text-slate-500 text-xs ml-auto">{r.min}–{r.max === 9999 ? '∞' : r.max}</span>
                {active && <span className="text-xs font-bold" style={{ color: r.color }}>← Vous</span>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
