import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import TableLayout from '../components/online/TableLayout';
import TwoPlayerOnlineTable from '../components/online/TwoPlayerOnlineTable';
import type { OnlinePlayer } from '../components/online/PlayerSeat';

const OnlineGamePage: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [state, setState] = React.useState<any>(null);

  React.useEffect(() => {
    if (!socket || !gameId || !user?._id) return;

    const onUpdate = (gs: any) => setState(gs);
    socket.emit('join_game', { gameCode: gameId, userId: user._id });
    socket.on('game_updated', onUpdate);
    socket.on('error', (e: any) => console.error(e));

    return () => {
      socket.off('game_updated', onUpdate);
      socket.off('error');
      socket.emit('leave_game');
    };
  }, [socket, gameId, user?._id]);

  // Map server players to OnlinePlayer shape
  const mappedPlayers: OnlinePlayer[] = React.useMemo(() => {
    if (!state?.players) return [];
    return state.players.map((p: any) => ({
      _id: p._id ?? p.user ?? p.user?._id ?? String(p.position ?? Math.random()),
      firstName: p.firstName ?? 'Invité',
      lastName: p.lastName ?? 'Guest',
      score: p.score,
      cardsCount: p.cardsCount ?? (p.cards?.length ?? 0),
      isEliminated: p.isEliminated,
    }));
  }, [state?.players]);

  // Fallback: show a proper 2-player layout while waiting for server
  const fallbackPlayers: OnlinePlayer[] = React.useMemo(() => {
    if (!user?._id) return [];
    return [
      {
        _id: user._id,
        firstName: user.firstName ?? 'Vous',
        lastName: user.lastName ?? '',
        cardsCount: 4,
      },
      {
        _id: 'opponent-placeholder',
        firstName: 'Adversaire',
        lastName: '',
        cardsCount: 4,
      },
    ];
  }, [user?._id, user?.firstName, user?.lastName]);

  const playersToRender = (mappedPlayers?.length ?? 0) >= 2 ? mappedPlayers : fallbackPlayers;
  const currentIndex = typeof state?.currentPlayerIndex === 'number' ? state!.currentPlayerIndex : 0;

  // If exactly 2 players, render the online-specific 2P table mirroring Training visuals
  if ((playersToRender?.length ?? 0) === 2) {
    // TwoPlayerOnlineTable accepts optional names; render without props to avoid typing mismatches
    return <TwoPlayerOnlineTable />;
  }

  return (
    <div className="homepage-bg relative min-h-screen">
      <div className="homepage-overlay absolute inset-0" />

      {/* Top banner à la TrainingPage */}
      <div className="relative z-10 w-full text-white">
        <div className="flex items-center justify-between px-6 pt-6 max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <span className="text-lg sm:text-xl font-extrabold drop-shadow-md">Partie #{gameId}</span>
          </div>
          <div className="flex items-center gap-6 text-sm opacity-90">
            <div className="bg-black/60 border border-white/20 px-3 py-1 rounded-full">Pioche: {state?.drawPileCount ?? 0}</div>
            <button onClick={() => navigate(`/room/${gameId}`)} className="underline">Retour au salon</button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 pb-8 mt-4">
          {/* status chip */}
          {!state && (
            <div className="mb-2 flex justify-center">
              <span className="bg-black/60 border border-white/20 text-white text-sm px-3 py-1 rounded-full">Connexion en cours…</span>
            </div>
          )}

          <div className="rounded-2xl border border-white/20 bg-white/5 backdrop-blur p-3">
            <TableLayout
              players={playersToRender}
              youId={user?._id!}
              currentPlayerIndex={currentIndex}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnlineGamePage;
