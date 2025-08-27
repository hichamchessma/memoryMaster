import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

type GamePlayer = {
  _id: string;
  firstName: string;
  lastName: string;
  elo?: number;
  position: number;
  score: number;
  isEliminated: boolean;
  hasBombom?: boolean;
  cardsCount: number;
};

type GameState = {
  code: string;
  status: 'lobby' | 'playing' | 'ended';
  currentPlayerIndex: number;
  maxPlayers: number;
  cardsPerPlayer: number;
  host: { _id: string; firstName: string; lastName: string };
  players: GamePlayer[];
  drawPileCount: number;
};

const RoomPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [state, setState] = React.useState<GameState | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [starting, setStarting] = React.useState(false);

  React.useEffect(() => {
    if (!socket || !code || !user?._id) return;

    const handleUpdated = (gs: GameState) => {
      setState(gs);
      if (gs.status === 'playing') {
        navigate(`/game/${gs.code}`);
      }
    };

    const handleDisconnectedPlayer = ({ userId }: { userId: string }) => {
      // Optionally show a toast, kept minimal here
      console.log('Player disconnected', userId);
    };

    socket.emit('join_game', { gameCode: code, userId: user._id });
    socket.on('game_updated', handleUpdated);
    socket.on('player_disconnected', handleDisconnectedPlayer);
    socket.on('error', (e: any) => setError(e?.message ?? 'Erreur socket'));

    return () => {
      socket.off('game_updated', handleUpdated);
      socket.off('player_disconnected', handleDisconnectedPlayer);
      socket.off('error');
      socket.emit('leave_game');
    };
  }, [socket, code, user?._id, navigate]);

  const isHost = React.useMemo(() => state && user?._id && state.host?._id === user._id, [state, user?._id]);

  const startGame = async () => {
    if (!state) return;
    setStarting(true);
    try {
      const token = user?.token || localStorage.getItem('token');
      const resp = await fetch(`/api/game/${encodeURIComponent(state.code)}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (!resp.ok) throw new Error('Impossible de démarrer la partie');
    } catch (e: any) {
      setError(e.message || 'Erreur inconnue');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] p-6 text-white">
      <div className="max-w-3xl mx-auto bg-white/10 border border-white/20 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Salon #{code}</h1>
          <div className="text-sm opacity-80">Statut: {state?.status ?? '...'}</div>
        </div>

        <div className="mb-4">
          <div className="text-sm opacity-80">Code de la partie</div>
          <div className="text-xl font-mono select-all">{code}</div>
        </div>

        <div className="mb-6">
          <div className="font-semibold mb-2">Joueurs ({state?.players.length ?? 0}/{state?.maxPlayers ?? '-'})</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {state?.players.map(p => (
              <div key={p._id} className="bg-black/30 rounded-lg p-3 border border-white/10">
                <div className="font-semibold">{p.firstName} {p.lastName}</div>
                <div className="text-xs opacity-70">Place {p.position} • Cartes: {p.cardsCount}</div>
              </div>
            ))}
            {!state && <div className="opacity-70">Chargement des joueurs...</div>}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => navigate('/start-game')}
            className="px-4 py-2 rounded bg-black/30 border border-white/30 hover:bg-black/40"
          >Changer</button>

          {isHost && state?.status === 'lobby' && (
            <button
              onClick={startGame}
              disabled={starting}
              className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60"
            >{starting ? 'Démarrage...' : 'Démarrer la partie'}</button>
          )}
        </div>

        {error && <div className="mt-4 text-red-300 text-sm">{error}</div>}
      </div>
    </div>
  );
};

export default RoomPage;
