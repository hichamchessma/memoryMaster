import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'
import toast from 'react-hot-toast'
import Logo from '../components/Logo'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirm: '' })
  const { login, loginAsGuest } = useAuth()
  const navigate = useNavigate()

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  // Google OAuth — flow implicit gives access_token, serveur vérifie via userinfo
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true)
      try {
        const { data } = await api.post('/auth/google', { accessToken: tokenResponse.access_token })
        login(data.user, data.token)
        toast.success(`Bienvenue ${data.user.firstName} !`, { icon: '🔵' })
        navigate('/dashboard')
      } catch (err: any) {
        toast.error(err.response?.data?.error || 'Connexion Google échouée, réessaie')
      } finally {
        setGoogleLoading(false)
      }
    },
    onError: () => toast.error('Connexion Google annulée'),
  })

  const handleGuest = async () => {
    setGuestLoading(true)
    try {
      const { data } = await api.post('/auth/guest')
      loginAsGuest(data.user, data.token)
      toast.success(`Bienvenue ${data.user.firstName} ${data.user.lastName} !`, { icon: '👻' })
      navigate('/dashboard')
    } catch {
      toast.error('Impossible de créer une session invité')
    } finally {
      setGuestLoading(false)
    }
  }

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

          <div className="flex gap-8">
            {[['2-4', 'Joueurs'], ['4', 'Cartes/joueur'], ['∞', 'Tactiques']].map(([v, l]) => (
              <div key={l}>
                <div className="text-3xl font-gaming font-black text-yellow-400">{v}</div>
                <div className="text-sm text-slate-400">{l}</div>
              </div>
            ))}
          </div>

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
        <div className="w-full max-w-md space-y-6 animate-slide-up">

          {/* Logo (mobile) */}
          <div className="lg:hidden flex justify-center">
            <Logo size="md" />
          </div>

          {/* Bouton Google */}
          <button
            onClick={() => googleLogin()}
            disabled={googleLoading}
            className="w-full py-3.5 rounded-xl font-bold text-sm border border-slate-600/60 bg-white hover:bg-gray-50 text-gray-700 transition-all flex items-center justify-center gap-3 shadow-md"
          >
            {googleLoading ? (
              <><div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"/>Connexion...</>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
                </svg>
                Continuer avec Google
              </>
            )}
          </button>

          {/* Séparateur */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-purple-900/50"/>
            <span className="text-xs text-slate-500 font-medium">ou continuer avec email</span>
            <div className="flex-1 h-px bg-purple-900/50"/>
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

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
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

          {/* Séparateur invité */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-purple-900/50"/>
            <span className="text-xs text-slate-500 font-medium">ou</span>
            <div className="flex-1 h-px bg-purple-900/50"/>
          </div>

          {/* Bouton invité */}
          <button
            onClick={handleGuest}
            disabled={guestLoading}
            className="w-full py-3.5 rounded-xl font-bold text-sm border border-slate-600/50 bg-slate-800/50 hover:bg-slate-700/60 text-slate-300 hover:text-white transition-all flex items-center justify-center gap-2"
          >
            {guestLoading ? (
              <><div className="w-4 h-4 border-2 border-slate-400/30 border-t-slate-300 rounded-full animate-spin"/>Création...</>
            ) : (
              <>👻 Jouer en invité — sans inscription</>
            )}
          </button>
          <p className="text-center text-xs text-slate-600">
            Session limitée à cet onglet · pas de stats · pas de classement
          </p>
        </div>
      </div>
    </div>
  )
}
