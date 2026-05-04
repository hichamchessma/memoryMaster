import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'
import toast from 'react-hot-toast'
import Logo from '../components/Logo'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirm: '' })
  const { login } = useAuth()
  const navigate = useNavigate()

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'register' && form.password !== form.confirm) {
      toast.error('Les mots de passe ne correspondent pas'); return
    }
    setLoading(true)
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register'
      const payload = mode === 'login'
        ? { email: form.email, password: form.password }
        : { firstName: form.firstName, lastName: form.lastName, email: form.email, password: form.password }

      const { data } = await api.post(endpoint, payload)
      login(data.user, data.token)
      toast.success(mode === 'login' ? `Bienvenue ${data.user.firstName} !` : 'Compte créé avec succès !')
      navigate('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex game-bg">
      {/* ── Left: Visual ───────────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-purple-900/40 to-black/80" />

        {/* Floating cards decoration */}
        {[...Array(6)].map((_, i) => (
          <div key={i} className="absolute opacity-10 animate-float"
            style={{ left:`${10+i*15}%`, top:`${20+i*10}%`, animationDelay:`${i*0.8}s`, transform:`rotate(${-20+i*8}deg)` }}>
            <div className="w-14 h-20 rounded-lg border border-white/30 bg-white/5 backdrop-blur-sm"/>
          </div>
        ))}

        <div className="relative z-10">
          <Logo size="lg" />
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h1 className="text-5xl font-gaming font-black text-white leading-tight">
              Le jeu de cartes<br/>
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                ultime
              </span>
            </h1>
            <p className="mt-4 text-lg text-slate-300 max-w-md">
              Mémoire, stratégie et bluff. Affrontez jusqu'à 4 joueurs dans des parties intenses et tactiques.
            </p>
          </div>

          {/* Stats */}
          <div className="flex gap-8">
            {[['2-4', 'Joueurs'], ['4', 'Cartes/joueur'], ['∞', 'Tactiques']].map(([v, l]) => (
              <div key={l}>
                <div className="text-3xl font-gaming font-black text-yellow-400">{v}</div>
                <div className="text-sm text-slate-400">{l}</div>
              </div>
            ))}
          </div>

          {/* Features */}
          <div className="space-y-3">
            {['Pouvoirs spéciaux (Valet, Dame, Roi)', 'BomBom & ShowTime — la tension ultime', 'Classement ELO en temps réel'].map(f => (
              <div key={f} className="flex items-center gap-3 text-slate-300">
                <div className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0"/>
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-slate-500 text-sm">
          © {new Date().getFullYear()} Memory Master Pro
        </div>
      </div>

      {/* ── Right: Form ─────────────────────────────────────────────────── */}
      <div className="flex-1 lg:max-w-[480px] flex items-center justify-center p-8"
        style={{ background: 'rgba(8,8,20,0.97)', backdropFilter: 'blur(20px)' }}>
        <div className="w-full max-w-md space-y-8 animate-slide-up">

          {/* Logo (mobile) */}
          <div className="lg:hidden flex justify-center">
            <Logo size="md" />
          </div>

          {/* Tab switcher */}
          <div className="flex rounded-xl overflow-hidden border border-purple-900/50">
            {(['login', 'register'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-3 font-semibold text-sm transition-all ${
                  mode === m
                    ? 'bg-gradient-to-r from-purple-700 to-violet-600 text-white'
                    : 'text-slate-400 hover:text-white bg-transparent'
                }`}>
                {m === 'login' ? 'Connexion' : 'Inscription'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium mb-1 block">Prénom</label>
                  <input className="input-field" placeholder="Hicham" value={form.firstName} onChange={set('firstName')} required />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium mb-1 block">Nom</label>
                  <input className="input-field" placeholder="Ammor" value={form.lastName} onChange={set('lastName')} required />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-slate-400 font-medium mb-1 block">Email</label>
              <input className="input-field" type="email" placeholder="vous@exemple.com" value={form.email} onChange={set('email')} required />
            </div>

            <div>
              <label className="text-xs text-slate-400 font-medium mb-1 block">Mot de passe</label>
              <input className="input-field" type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required minLength={6} />
            </div>

            {mode === 'register' && (
              <div>
                <label className="text-xs text-slate-400 font-medium mb-1 block">Confirmer le mot de passe</label>
                <input className="input-field" type="password" placeholder="••••••••" value={form.confirm} onChange={set('confirm')} required />
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2 mt-2">
              {loading ? (
                <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>{mode === 'login' ? 'Connexion...' : 'Création...'}</>
              ) : (
                mode === 'login' ? '⚡ Se connecter' : '🚀 Créer mon compte'
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500">
            {mode === 'login' ? 'Pas encore de compte ?' : 'Déjà un compte ?'}{' '}
            <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-purple-400 hover:text-purple-300 font-semibold transition-colors">
              {mode === 'login' ? 'S\'inscrire' : 'Se connecter'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
