import React from 'react';
import tableGameImg from '../assets/cards/tableGame.png';
import playerOutImg from '../assets/cards/playerOut.png';
import playerInImg from '../assets/cards/playerIn.png';
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
  status: 'waiting' | 'lobby' | 'playing' | 'finished' | 'ended';
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
  const apiBase = (import.meta as any).env?.VITE_API_URL || '/api';

  const [state, setState] = React.useState<GameState | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [starting, setStarting] = React.useState(false);
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [newTablePlayers, setNewTablePlayers] = React.useState<2|3|4>(2);
  const [joined, setJoined] = React.useState(false);

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
  const isLobbyLike = React.useMemo(() => state?.status === 'lobby' || state?.status === 'waiting', [state?.status]);

  // Affichage du compteur: on exclut l'utilisateur local tant qu'il n'a pas cliqué "Rejoindre"
  const othersCount = React.useMemo(() => {
    if (!state?.players) return 0;
    return state.players.filter(p => p._id !== user?._id).length;
  }, [state?.players, user?._id]);
  const displayedCount = othersCount + (joined ? 1 : 0);

  const handleToggleJoin = () => {
    setJoined(j => !j);
  };

  const startGame = async () => {
    if (!state) return;
    setStarting(true);
    try {
      const token = user?.token || localStorage.getItem('token');
      const resp = await fetch(`${apiBase}/game/${encodeURIComponent(state.code)}/start`, {
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

  const createNewTable = async (players?: 2|3|4) => {
    try {
      const token = user?.token || localStorage.getItem('token');
      const resp = await fetch(`${apiBase}/game`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ maxPlayers: players ?? newTablePlayers })
      });
      if (!resp.ok) throw new Error('Impossible de créer la table');
      const data = await resp.json();
      const newCode = data?.game?.code;
      if (!newCode) throw new Error('Code table manquant');
      setShowCreateModal(false);
      navigate(`/room/${newCode}`);
    } catch (e) {
      console.error(e);
      setError((e as any)?.message || 'Erreur lors de la création de la table');
    }
  };

  // Note: no auto-start; the host must click the "Démarrer la partie" button.

  return (
    <div className="min-h-[calc(100vh-80px)] p-6 text-white">
      {/* User chip + Retour menu (toujours visibles en haut à droite) */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-3">
        <span className="px-3 py-1 rounded-full bg-black/50 border border-white/20 text-sm whitespace-nowrap">
          {user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'Utilisateur' }
        </span>
        <button
          onClick={() => navigate('/')}
          className="px-3 py-1 rounded-lg bg-black/40 hover:bg-black/50 border border-white/20 text-sm"
        >Menu principal</button>
      </div>
      <div className="max-w-3xl mx-auto bg-transparent rounded-2xl p-6">
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
          <div className="bg-black/30 rounded-lg p-3 border border-white/10 text-sm opacity-90">
            Ce salon est anonyme. Le détail des joueurs n'est pas affiché.
          </div>
        </div>

        {/* Tables placeholder and Create Table action */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">Tables <span className="opacity-70 text-sm">(1/8)</span></div>
            <div className="flex items-center gap-2">
              <span className="text-sm opacity-80">Créer: </span>
              {[2,3,4].map(n => (
                <button
                  key={n}
                  onClick={() => createNewTable(n as 2|3|4)}
                  className="w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center"
                  title={`Créer une table ${n} joueurs`}
                >{n}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="relative rounded-xl overflow-hidden cursor-default select-none">
              <img src={tableGameImg} alt="Table" className="w-full h-32 object-contain bg-center bg-no-repeat select-none pointer-events-none" />
              {/* Seat placeholders (mini) + Join button */}
              {typeof state?.maxPlayers === 'number' && state.maxPlayers > 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <div className="flex gap-3">
                    {Array.from({ length: state.maxPlayers }).map((_, i) => (
                      <img
                        key={i}
                        src={i === 0 && joined ? playerInImg : playerOutImg}
                        alt={`Seat ${i+1}`}
                        className="w-7 h-7 sm:w-8 sm:h-8 object-contain drop-shadow-md"
                        draggable={false}
                      />
                    ))}
                  </div>
                  <button
                    onClick={handleToggleJoin}
                    className={`px-3 py-1 rounded-full text-xs text-white shadow focus:outline-none focus:ring-2 ${joined ? 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-300' : 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-300'}`}
                  >{joined ? 'Quitter' : 'Rejoindre'}</button>
                </div>
              )}
              {/* Compteur et code */}
              <div className="absolute left-2 bottom-2 text-xs bg-black/50 text-white px-2 py-1 rounded-full">
                {displayedCount}/{state?.maxPlayers ?? '-'} • Code: {state?.code}
              </div>
              {/* Nom du joueur rejoint collé à droite de la table */}
              {joined && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded-md whitespace-nowrap">
                  {user?.firstName || 'Vous'}
                </div>
              )}
            </div>
            {/* TODO: afficher d'autres tables lorsqu'on aura une API de liste */}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => navigate('/start-game')}
            className="px-4 py-2 rounded bg-black/30 border border-white/30 hover:bg-black/40"
          >Changer</button>

          {isHost && isLobbyLike && (
            <button
              onClick={startGame}
              disabled={starting}
              className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60"
            >{starting ? 'Démarrage...' : 'Démarrer la partie'}</button>
          )}
        </div>

        {error && <div className="mt-4 text-red-300 text-sm">{error}</div>}

        {/* Create Table Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowCreateModal(false)} />
            <div className="relative z-10 w-full max-w-sm bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-5 text-white">
              <div className="text-lg font-semibold mb-3">Nouvelle table</div>
              <div className="text-sm mb-2">Nombre de joueurs</div>
              <div className="flex gap-2 mb-4">
                {[2,3,4].map(n => (
                  <button
                    key={n}
                    className={`px-3 py-2 rounded border transition-colors ${newTablePlayers===n? 'bg-emerald-600 border-white' : 'bg-black/30 border-white/40 hover:bg-black/40'}`}
                    onClick={() => setNewTablePlayers(n as 2|3|4)}
                  >{n}</button>
                ))}
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowCreateModal(false)} className="px-3 py-2 rounded bg-black/30 border border-white/30 hover:bg-black/40">Annuler</button>
                <button onClick={() => createNewTable()} className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-700">Créer</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoomPage;
