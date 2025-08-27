import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

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

  return (
    <div className="min-h-[calc(100vh-80px)] p-6 text-white">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Partie #{gameId}</h1>
          <button onClick={() => navigate(`/room/${gameId}`)} className="text-sm underline">Retour au salon</button>
        </div>

        {!state && <div>Chargement...</div>}

        {state && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/10 border border-white/20 rounded-xl p-4">
              <div className="opacity-80 text-sm mb-2">Tour du joueur</div>
              <div className="text-lg font-semibold">Index: {state.currentPlayerIndex}</div>
              <div className="opacity-80 text-sm">Pioche restante: {state.drawPileCount}</div>
            </div>

            <div className="bg-white/10 border border-white/20 rounded-xl p-4">
              <div className="font-semibold mb-2">Joueurs</div>
              <div className="space-y-2">
                {state.players.map((p: any) => (
                  <div key={p._id} className="flex items-center justify-between bg-black/30 border border-white/10 rounded px-3 py-2">
                    <div>
                      <div className="font-semibold">{p.firstName} {p.lastName}</div>
                      <div className="text-xs opacity-70">Score: {p.score} • Cartes: {p.cardsCount}</div>
                    </div>
                    {p.isEliminated && <span className="text-xs text-red-300">Éliminé</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="md:col-span-2 bg-white/10 border border-white/20 rounded-xl p-4">
              <div className="opacity-80 text-sm mb-2">Plateau (placeholder)</div>
              <div className="text-sm opacity-70">L'UI finale réutilisera vos composants (`PlayerZone`, etc.) pour N joueurs.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnlineGamePage;
