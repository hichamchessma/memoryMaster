import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCallback, useEffect, useRef, useState } from 'react';


const HomePage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loadingGuest, setLoadingGuest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const googleBtnRef = useRef<HTMLDivElement | null>(null);
  const apiBase = (import.meta as any).env?.VITE_API_URL || '/api';

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


  return (
    <div className="homepage-bg relative min-h-screen flex flex-col justify-center items-center">
      <div className="homepage-overlay absolute inset-0" />
      <div className="homepage-content relative z-10 animate-fadein">
        {/* === Contenu principal === */}
      <div className="mx-auto max-w-7xl px-6 pb-24 pt-10 sm:pb-32 lg:flex lg:px-8 lg:py-40">
        <div className="mx-auto max-w-2xl flex-shrink-0 lg:mx-0 lg:max-w-xl lg:pt-8">
          <div className="mt-24 sm:mt-32 lg:mt-16">
            <a href="#" className="inline-flex space-x-6">
              <span className="rounded-full bg-indigo-600/10 px-3 py-1 text-sm font-semibold leading-6 text-indigo-600 ring-1 ring-inset ring-indigo-600/10 dark:bg-indigo-400/10 dark:text-indigo-400 dark:ring-indigo-400/20">
                Nouveauté
              </span>
              <span className="inline-flex items-center space-x-2 text-sm font-medium leading-6 text-gray-600 dark:text-gray-300">
                <span>Découvrez nos dernières fonctionnalités</span>
                <svg viewBox="0 0 16 16" fill="currentColor" className="h-2.5 w-2.5" aria-hidden="true">
                  <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z" />
                </svg>
              </span>
            </a>
          </div>
          <h1 className="mt-10 text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl dark:text-white">
            Le jeu de mémoire ultime entre amis
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
            Rejoignez vos amis dans une aventure palpitante de mémoire et de stratégie. Créez ou rejoignez une partie et prouvez que vous êtes le vrai Memory Master !
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <div ref={googleBtnRef} className="flex" />

            <button
              disabled={loadingGuest}
              onClick={continueAsGuest}
              className="btn-secondary disabled:opacity-60"
            >{loadingGuest ? 'Chargement...' : 'Continuer en invité'}</button>

            <button
              className="btn-main"
              style={{background: 'linear-gradient(90deg, #ff6f00 0%, #ffb300 100%)', color: '#fff'}} 
              onClick={() => { window.scrollTo(0,0); navigate('/training'); }}
            >S'entraîner</button>
          </div>
          {error && (
            <p className="mt-4 text-red-600 text-center">{error}</p>
          )}
          <img
            src="https://example.com/app-screenshot.jpg"
            alt="App screenshot"
            width={2432}
            height={1442}
            className="w-[76rem] rounded-md shadow-2xl ring-1 ring-gray-900/10"
          />
          </div>
        </div>
      </div>
      
      {/* Features */}
      <div className="bg-gray-50 dark:bg-gray-800 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-base font-semibold leading-7 text-indigo-600 dark:text-indigo-400">Jouer en ligne</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              Une expérience de jeu exceptionnelle
            </p>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
              Découvrez pourquoi des milliers de joueurs nous ont choisi pour leurs soirées jeux en ligne.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-2 lg:gap-y-16">
              {[
                {
                  name: 'Multijoueur en temps réel',
                  description: 'Jouez avec vos amis en temps réel, où que vous soyez dans le monde.',
                  icon: '🌐',
                },
                {
                  name: 'Interface intuitive',
                  description: 'Une interface conçue pour une prise en main immédiate et une expérience fluide.',
                  icon: '🎮',
                },
                {
                  name: 'Personnalisation',
                  description: 'Créez des parties personnalisées avec vos propres règles et paramètres.',
                  icon: '⚙️',
                },
                {
                  name: 'Classements',
                  description: 'Montez dans les classements et prouvez que vous êtes le meilleur Memory Master !',
                  icon: '🏆',
                },
              ].map((feature) => (
                <div key={feature.name} className="relative pl-16">
                  <dt className="text-base font-semibold leading-7 text-gray-900 dark:text-white">
                    <div className="absolute left-0 top-1 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white">
                      {feature.icon}
                    </div>
                    {feature.name}
                  </dt>
                  <dd className="mt-2 text-base leading-7 text-gray-600 dark:text-gray-400">
                    {feature.description}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
      
      {/* CTA Section */}
      <div className="bg-indigo-600 dark:bg-indigo-700">
        <div className="mx-auto max-w-2xl py-16 px-4 text-center sm:py-20 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            <span className="block">Prêt à jouer ?</span>
            <span className="block">Connectez-vous avec Google ou jouez en invité.</span>
          </h2>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <div ref={googleBtnRef} />
            <button
              onClick={continueAsGuest}
              className="inline-flex items-center justify-center rounded-md bg-white/10 px-5 py-3 text-base font-medium text-white ring-1 ring-white/20 hover:bg-white/20"
            >
              Continuer en invité
            </button>
          </div>
        </div>
      </div> {/* homepage-content */}
    </div> /* homepage-bg */
  );
};

export default HomePage;
