import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const StartGamePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [maxPlayers, setMaxPlayers] = React.useState<2 | 3 | 4>(2);
  const [joinCode, setJoinCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const authHeader: HeadersInit = React.useMemo(() => {
    const token = user?.token || localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  }, [user?.token]);

  const handleCreate = async () => {
    setError(null);
    setLoading(true);
    try {
      const resp = await fetch('/api/game', {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({ maxPlayers })
      });
      if (!resp.ok) throw new Error('Impossible de créer la partie');
      const data = await resp.json(); // { success, message, game: { code } }
      const code = data?.game?.code;
      if (!code) throw new Error('Code de partie manquant');
      navigate(`/room/${code}`);
    } catch (e: any) {
      setError(e.message || 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode) return;
    setError(null);
    setLoading(true);
    try {
      const resp = await fetch(`/api/game/${encodeURIComponent(joinCode)}/join`, {
        method: 'POST',
        headers: authHeader
      });
      if (!resp.ok) throw new Error('Impossible de rejoindre la partie');
      navigate(`/room/${joinCode}`);
    } catch (e: any) {
      setError(e.message || 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20 text-white">
        <h1 className="text-2xl font-bold mb-4">Nouvelle partie en ligne</h1>

        <div className="mb-6">
          <label className="block text-sm mb-2">Nombre de joueurs</label>
          <div className="flex gap-2">
            {[2,3,4].map(n => (
              <button
                key={n}
                className={`px-3 py-2 rounded border ${maxPlayers===n? 'bg-emerald-600 border-white' : 'bg-black/30 border-white/40'}`}
                onClick={() => setMaxPlayers(n as 2|3|4)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold py-2 rounded mb-6"
        >
          {loading ? 'Création...' : 'Créer une partie'}
        </button>

        <div className="h-px bg-white/20 my-4" />

        <div className="mb-3">
          <label className="block text-sm mb-2">Rejoindre avec un code</label>
          <input
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.trim())}
            placeholder="Ex: ABC123"
            className="w-full bg-black/30 border border-white/30 rounded px-3 py-2 text-white outline-none"
          />
        </div>
        <button
          onClick={handleJoin}
          disabled={loading || !joinCode}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2 rounded"
        >
          Rejoindre
        </button>

        {error && <div className="mt-4 text-red-300 text-sm">{error}</div>}
      </div>
    </div>
  );
};

export default StartGamePage;
