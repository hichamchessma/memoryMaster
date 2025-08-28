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
    <div className="homepage-bg relative min-h-screen flex items-center justify-center">
      <div className="homepage-overlay absolute inset-0" />
      <div className="relative z-10 w-full max-w-xl mx-auto px-6">
        <div className="rounded-2xl border border-white/20 bg-black/35 backdrop-blur px-6 py-10 text-white text-center animate-fadein">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-3">Memory Master</h1>
          <p className="text-base sm:text-lg opacity-90 mb-8">Le jeu de mémoire, simple et intense. Créez une partie ou entraînez-vous.</p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
            <button
              disabled={loadingGuest}
              onClick={continueAsGuest}
              className="btn-secondary disabled:opacity-60"
            >{loadingGuest ? 'Chargement...' : 'Continuer en invité'}</button>

            <button
              className="btn-main"
              onClick={() => { window.scrollTo(0,0); navigate('/training'); }}
            >S'entraîner</button>
          </div>

          <div className="flex items-center justify-center gap-3">
            <div ref={googleBtnRef} className="scale-90" />
            <button
              onClick={() => navigate('/start-game')}
              className="px-4 py-2 rounded-full border border-white/30 bg-white/10 hover:bg-white/20 text-sm"
            >Créer / Rejoindre une partie</button>
          </div>

          {error && <p className="mt-4 text-red-300 text-sm">{error}</p>}
        </div>
        <div className="mt-4 text-center text-white/70 text-xs">© {new Date().getFullYear()} MemoryMaster</div>
      </div>
    </div>
  );
};

export default HomePage;
