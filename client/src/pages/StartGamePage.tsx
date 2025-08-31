import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useSocket } from '../context/SocketContext';
import salonImg from '../assets/cards/salonJeux.png';

const StartGamePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Default room uses 2 players; additional tables can be created from RoomPage
  const [joinCode, setJoinCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const apiBase = (import.meta as any).env?.VITE_API_URL || '/api';
  const qc = useQueryClient();
  const { socket } = useSocket();

  const authHeader: HeadersInit = React.useMemo(() => {
    const token = user?.token || localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  }, [user?.token]);

  // --- Lobby list (real-time) ---
  type LobbyItem = {
    code: string;
    name: string;
    status: 'waiting' | 'playing' | 'finished';
    maxPlayers: number;
    playerCount: number;
  };

  const fetchSalons = async (): Promise<LobbyItem[]> => {
    const res: any = await api.get<LobbyItem[]>('/game?status=waiting');
    const ok = res?.data?.success;
    if (!ok) throw new Error(res?.data?.error || 'Erreur de chargement');
    return (res?.data?.data as LobbyItem[]) || [];
  };

  const { data: salons = [], isLoading: isLobbyLoading, isFetching: isLobbyFetching } = useQuery({
    queryKey: ['lobby', 'waiting'],
    queryFn: fetchSalons,
    // Fallback polling in case socket events don't arrive
    refetchInterval: 5000,
  });

  React.useEffect(() => {
    if (!socket) return;
    const onLobby = () => qc.invalidateQueries({ queryKey: ['lobby', 'waiting'] });
    socket.on('lobby_updated', onLobby);
    return () => { socket.off('lobby_updated', onLobby); };
  }, [socket, qc]);

  const handleCreate = async (players?: 2|3|4) => {
    setError(null);
    setLoading(true);
    try {
      const targetPlayers = players ?? 2;
      const resp = await fetch(`${apiBase}/game`, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({ maxPlayers: targetPlayers })
      });
      if (!resp.ok) throw new Error('Impossible de créer la partie');
      const data = await resp.json(); // { success, message, data: { code } }
      const code = data?.data?.code;
      if (!code) throw new Error('Code de partie manquant');
      // Ne plus autofill des joueurs: laisser l'hôte créer/ajouter manuellement
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
      const resp = await fetch(`${apiBase}/game/${encodeURIComponent(joinCode)}/join`, {
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
        <h1 className="text-2xl font-bold mb-4">Salons en ligne</h1>

        <button
          onClick={() => handleCreate()}
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold py-2 rounded mb-6"
        >
          {loading ? 'Création...' : 'Créer un salon'}
        </button>

        {/* bouton supprimé: la liste s'affiche directement */}

        <div className="h-px bg-white/20 my-4" />

        <div className="mb-3">
          <label className="block text-sm mb-2">Rejoindre avec un code</label>
          <input
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.trim())}
            onKeyDown={(e) => { if (e.key === 'Enter' && joinCode && !loading) handleJoin(); }}
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

        <div className="h-px bg-white/20 my-6" />

        <h2 className="text-xl font-semibold mb-3">Salons en attente</h2>
        {(isLobbyLoading || isLobbyFetching) && <div>Chargement des salons...</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {salons.map((s: LobbyItem) => (
            <div key={s.code} className="bg-white/10 border border-white/20 rounded-lg p-3">
              <div className="relative">
                <img src={salonImg} alt="Salon" className="w-full h-32 object-cover rounded" />
                <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                  {s.playerCount}/{s.maxPlayers}
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div>
                  <div className="font-semibold">{s.name?.trim() ? s.name : `Salon ${s.code}`}</div>
                  <div className="text-xs opacity-80">Code: {s.code}</div>
                </div>
                <button
                  onClick={() => navigate(`/room/${s.code}`)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded"
                >
                  Entrer
                </button>
              </div>
            </div>
          ))}
          {!isLobbyLoading && !isLobbyFetching && salons.length === 0 && (
            <div className="text-sm opacity-80">Aucun salon pour le moment.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StartGamePage;
