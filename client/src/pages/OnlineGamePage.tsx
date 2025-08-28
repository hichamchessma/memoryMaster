import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import TableLayout from '../components/online/TableLayout';
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

  return (
    <div className="min-h-[calc(100vh-80px)] p-6 text-white">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Partie #{gameId}</h1>
          <div className="flex items-center gap-4 text-sm opacity-80">
            <div>Pioche: {state?.drawPileCount ?? 0}</div>
            <button onClick={() => navigate(`/room/${gameId}`)} className="underline">Retour au salon</button>
          </div>
        </div>

        {!state && <div>Chargement...</div>}

        {state && (
          <div className="rounded-2xl border border-white/20 bg-white/5 p-4">
            <TableLayout
              players={mappedPlayers}
              youId={user?._id!}
              currentPlayerIndex={state.currentPlayerIndex}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default OnlineGamePage;
