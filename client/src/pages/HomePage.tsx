import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCallback, useEffect, useRef, useState } from 'react';

const HomePage = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [loadingGuest, setLoadingGuest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFeature, setCurrentFeature] = useState(0);
  const googleBtnRef = useRef<HTMLDivElement | null>(null);
  const apiBase = (import.meta as any).env?.VITE_API_URL || '/api';

  const features = [
    "🧠 Mémoire & Stratégie",
    "⚡ Parties rapides (5-15 min)",
    "🎯 Bluff & Psychologie",
    "🏆 Classement ELO"
  ];

  // Animation des fonctionnalités
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % features.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [features.length]);

  // Google Identity Services: handler pour recevoir l'id_token
  const handleGoogleCredential = useCallback(async (response: any) => {
    const idToken = response?.credential;
    if (!idToken) return;
    setError(null);

    try {
      const resp = await fetch(`${apiBase}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (!resp.ok) throw new Error('Google login failed');
      const data = await resp.json();
      login({ ...(data || {}), token: data?.token });
      navigate('/dashboard');
    } catch (e: any) {
      setError(e.message || 'Erreur Google');
    } finally {
    }
  }, [login, navigate]);

  // Initialiser Google One Tap et le bouton officiel si la librairie est disponible
  useEffect(() => {
    // @ts-ignore
    const google = (window as any).google;
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!google || !clientId) return;
    try {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredential,
      });
      if (googleBtnRef.current) {
        google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
        });
      }
    } catch (_) { /* noop */ }
  }, [handleGoogleCredential]);

  const continueAsGuest = async () => {
    setError(null);
    setLoadingGuest(true);
    try {
      const resp = await fetch(`${apiBase}/auth/guest`, { method: 'POST' });
      if (!resp.ok) throw new Error('Impossible de continuer en invité');
      const data = await resp.json();
      login({ ...(data || {}), token: data?.token });
      navigate('/dashboard');
    } catch (e: any) {
      setError(e.message || 'Erreur inconnue');
    } finally {
      setLoadingGuest(false);
    }
  };

  const createNewGuestForThisTab = async () => {
    setError(null);
    setLoadingGuest(true);
    try {
      const resp = await fetch(`${apiBase}/auth/guest`, { method: 'POST' });
      if (!resp.ok) throw new Error('Impossible de créer un nouvel invité');
      const data = await resp.json();
      // Remplace l'invité courant (stockage par onglet via AuthContext.login)
      login({ ...(data || {}), token: data?.token });
      // Rester sur la page Home pour que l'utilisateur choisisse son flux
    } catch (e: any) {
      setError(e.message || 'Erreur inconnue');
    } finally {
      setLoadingGuest(false);
    }
  };

  return (
    <div className="homepage-bg relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background overlay avec gradient animé */}
      <div className="homepage-overlay absolute inset-0 bg-gradient-to-br from-black/40 via-purple-900/30 to-black/60" />

      {/* Particules flottantes décoratives */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className={`absolute w-2 h-2 bg-white/20 rounded-full animate-pulse`}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 3}s`
            }}
          />
        ))}
      </div>

      {/* Cards flottantes décoratives */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className={`absolute opacity-10 animate-float`}
            style={{
              left: `${10 + Math.random() * 80}%`,
              top: `${10 + Math.random() * 80}%`,
              animationDelay: `${Math.random() * 5}s`,
              transform: `rotate(${Math.random() * 360}deg) scale(${0.8 + Math.random() * 0.4})`
            }}
          >
            <div className="w-16 h-24 bg-gradient-to-br from-white/20 to-white/5 rounded-lg border border-white/20 backdrop-blur-sm" />
          </div>
        ))}
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center min-h-screen py-12">

          {/* Section gauche - Présentation du jeu */}
          <div className="text-white space-y-8 animate-fadein-left">
            <div className="space-y-4">
              <h1 className="text-6xl sm:text-7xl lg:text-8xl font-black tracking-tight">
                <span className="bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
                  Memory
                </span>
                <br />
                <span className="text-white drop-shadow-lg">
                  Master
                </span>
              </h1>

              {/* Fonctionnalité en vedette animée */}
              <div className="h-8 flex items-center">
                <div className="text-xl font-semibold text-purple-300 transition-all duration-500">
                  {features[currentFeature]}
                </div>
              </div>

              <p className="text-xl sm:text-2xl text-gray-200 leading-relaxed max-w-lg">
                Le jeu de cartes où <span className="text-purple-300 font-semibold">mémoire</span>,
                <span className="text-pink-300 font-semibold"> stratégie</span> et
                <span className="text-yellow-300 font-semibold"> bluff</span> se rencontrent
              </p>
            </div>

            {/* Stats sociales */}
            <div className="flex items-center gap-8 py-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">10k+</div>
                <div className="text-sm text-gray-300">Joueurs</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">50k+</div>
                <div className="text-sm text-gray-300">Parties</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">4.8★</div>
                <div className="text-sm text-gray-300">Note</div>
              </div>
            </div>

            {/* Aperçu du jeu */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-bold mb-3 text-white">Comment jouer ?</h3>
              <div className="space-y-2 text-sm text-gray-200">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  <span>Mémorisez les cartes pendant 10 secondes</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                  <span>Utilisez vos pouvoirs spéciaux (J, Q, K)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                  <span>Minimisez votre score pour gagner</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section droite - Actions du joueur */}
          <div className="animate-fadein-right">
            <div className="bg-black/40 backdrop-blur-xl rounded-3xl border border-white/20 p-8 shadow-2xl">
              <div className="space-y-6">

                {/* Boutons principaux */}
                <div className="space-y-4">
                  <button
                    disabled={loadingGuest}
                    onClick={continueAsGuest}
                    className="group w-full relative overflow-hidden bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-600 disabled:to-gray-600 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg disabled:transform-none disabled:shadow-none"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                    <span className="relative flex items-center justify-center gap-2">
                      {loadingGuest ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Connexion...
                        </>
                      ) : (
                        <>
                          <span className="text-2xl">🚀</span>
                          Jouer maintenant
                        </>
                      )}
                    </span>
                  </button>

                  <button
                    className="group w-full relative overflow-hidden bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg"
                    onClick={() => { window.scrollTo(0,0); navigate('/training'); }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                    <span className="relative flex items-center justify-center gap-2">
                      <span className="text-2xl">🎯</span>
                      Mode Entraînement
                    </span>
                  </button>
                </div>

                {/* Séparateur */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/20"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-black/40 text-gray-300">ou</span>
                  </div>
                </div>

                {/* Boutons secondaires */}
                <div className="space-y-3">
                  <div className="flex items-center justify-center">
                    <div ref={googleBtnRef} className="scale-90 hover:scale-95 transition-transform duration-200" />
                  </div>

                  <button
                    onClick={() => navigate('/start-game')}
                    className="group w-full relative overflow-hidden bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-6 rounded-xl border border-white/30 transition-all duration-300 hover:border-white/50"
                  >
                    <span className="relative flex items-center justify-center gap-2">
                      <span>🏠</span>
                      Créer / Rejoindre une partie
                    </span>
                  </button>
                </div>

                {/* Message d'invité connecté */}
                {user && (user as any).role === 'guest' && (
                  <div className="mt-6 p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-xl">
                    <div className="text-center text-yellow-200 text-sm">
                      <div className="font-semibold">Connecté en invité</div>
                      <div className="mt-2">
                        Bienvenue {(user as any).firstName} !
                      </div>
                      <button
                        disabled={loadingGuest}
                        onClick={createNewGuestForThisTab}
                        className="mt-2 text-xs underline hover:no-underline disabled:opacity-60"
                      >
                        Créer un nouvel invité
                      </button>
                    </div>
                  </div>
                )}

                {/* Message d'erreur */}
                {error && (
                  <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                    <p className="text-red-300 text-sm text-center">{error}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Citation inspirante */}
            <div className="mt-8 text-center">
              <blockquote className="text-gray-300 italic text-sm">
                "La mémoire est le seul paradis d'où nous ne pouvons être chassés."
              </blockquote>
              <cite className="text-gray-400 text-xs mt-1 block">- Jean Paul</cite>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/50 text-xs">
          © {new Date().getFullYear()} MemoryMaster. Tous droits réservés.
        </div>
      </div>

      <style>{`
        @keyframes fadein-left {
          from { opacity: 0; transform: translateX(-50px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadein-right {
          from { opacity: 0; transform: translateX(50px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        .animate-fadein-left { animation: fadein-left 1s ease-out; }
        .animate-fadein-right { animation: fadein-right 1s ease-out; }
        .animate-float { animation: float 6s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default HomePage;
