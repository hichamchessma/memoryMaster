
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const displayName = user?.firstName || 'Invité';

  return (
    <div className="homepage-bg relative min-h-screen flex items-center justify-center">
      <div className="homepage-overlay absolute inset-0" />
      <div className="relative z-10 w-full max-w-xl mx-auto px-6">
        <div className="rounded-2xl border border-white/20 bg-black/35 backdrop-blur px-6 py-10 text-white text-center animate-fadein">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-2 drop-shadow-[0_2px_16px_rgba(0,0,0,0.6)]">
            Bienvenue{displayName ? `, ${displayName}` : ''} !
          </h1>
          <p className="text-base sm:text-lg opacity-90 mb-8">Que souhaitez-vous faire ?</p>

          <div className="flex flex-col gap-3 max-w-sm mx-auto">
            <button
              className="btn-main w-full"
              onClick={() => navigate('/start-game')}
            >
              Salons
            </button>

            <button
              className="btn-secondary w-full"
              onClick={() => navigate('/scores')}
            >
              Voir les scores
            </button>

            <button
              className="w-full px-5 py-3 rounded-full border border-white/25 bg-white/10 hover:bg-white/20 transition text-white"
              onClick={() => navigate('/training')}
            >
              S'entraîner
            </button>
          </div>

          <button
            onClick={logout}
            className="mt-8 text-sm text-white/80 hover:text-red-300 underline"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
