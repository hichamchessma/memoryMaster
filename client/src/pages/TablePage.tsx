import React from 'react';
import tableGameImg from '../assets/cards/tableGame.png';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

type TablePlayer = {
  _id: string;
  firstName: string;
  lastName: string;
  position: number;
};

type GameTable = {
  _id: string;
  code: string;
  maxPlayers: 2 | 3 | 4;
  players: TablePlayer[];
  status: 'waiting' | 'playing' | 'finished';
  hostId: string;
  createdAt: string;
};

const TablePage: React.FC = () => {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [table, setTable] = React.useState<GameTable | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!socket || !tableId || !user?._id) return;

    const handleTableUpdated = (updatedTable: GameTable) => {
      if (updatedTable._id === tableId) {
        setTable(updatedTable);
      }
    };

    const handleGameStarted = ({ tableId: startedTableId }: { tableId: string }) => {
      if (startedTableId === tableId) {
        navigate(`/game/${tableId}`);
      }
    };

    // Observer la table spécifique
    socket.emit('watch_table', { tableId });
    socket.on('table_updated', handleTableUpdated);
    socket.on('game_started', handleGameStarted);
    socket.on('error', (e: any) => setError(e?.message ?? 'Erreur socket'));

    return () => {
      socket.off('table_updated', handleTableUpdated);
      socket.off('game_started');
      socket.off('error');
    };
  }, [socket, tableId, user?._id, navigate]);

  const joinTable = async () => {
    if (!user?._id) return;
    try {
      socket?.emit('join_table', { tableId, userId: user._id });
    } catch (e: any) {
      setError(e.message || 'Erreur lors de la connexion à la table');
    }
  };

  const leaveTable = async () => {
    if (!user?._id) return;
    try {
      socket?.emit('leave_table', { tableId, userId: user._id });
    } catch (e: any) {
      setError(e.message || 'Erreur lors du départ de la table');
    }
  };

  const startGame = () => {
    socket?.emit('start_game', { tableId });
  };

  if (!table) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div>Chargement de la table...</div>
      </div>
    );
  }

  const isUserInTable = table.players.some(p => p._id === user?._id);
  const availableSeats = table.maxPlayers - table.players.length;
  const isHost = table.hostId === user?._id;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-900 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(120,119,198,0.3),transparent_50%)]" />

      <div className="relative z-10 p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">
              Table {table.maxPlayers} joueurs
            </h1>
            <p className="text-xl text-gray-300">Code: {table.code}</p>
          </div>

          {/* Erreur */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300">
              {error}
            </div>
          )}

          {/* Table Display */}
          <div className="bg-white/10 backdrop-blur rounded-xl p-8 border border-white/20 mb-8">
            <div className="flex justify-center mb-6">
              <img src={tableGameImg} alt="Table de jeu" className="w-48 h-32 object-contain" />
            </div>

            {/* Sièges */}
            <div className={`grid gap-4 ${table.maxPlayers === 2 ? 'grid-cols-2' : table.maxPlayers === 3 ? 'grid-cols-3' : 'grid-cols-2 grid-rows-2'}`}>
              {Array.from({ length: table.maxPlayers }).map((_, i) => {
                const player = table.players.find(p => p.position === i + 1);
                return (
                  <div
                    key={i}
                    className={`relative w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all ${
                      player ? 'border-green-400 bg-green-500/30' : 'border-gray-600 bg-gray-800/50'
                    }`}
                  >
                    {player ? (
                      <span className="text-sm font-bold text-white">
                        {player.firstName[0]}{player.lastName[0]}
                      </span>
                    ) : (
                      <span className="text-lg text-gray-400">?</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="text-center mt-6">
              <p className="text-lg text-gray-300">
                Joueurs: {table.players.length}/{table.maxPlayers}
              </p>
              {availableSeats > 0 ? (
                <p className="text-green-400 font-semibold">
                  {availableSeats} place{availableSeats > 1 ? 's' : ''} disponible{availableSeats > 1 ? 's' : ''}
                </p>
              ) : (
                <p className="text-red-400 font-semibold">Table complète</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="text-center">
            {isUserInTable ? (
              <div className="flex gap-4 justify-center">
                <button
                  onClick={leaveTable}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl"
                >
                  Quitter la table
                </button>
                {isHost && table.status === 'waiting' && (
                  <button
                    onClick={startGame}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl"
                  >
                    Démarrer le jeu
                  </button>
                )}
              </div>
            ) : availableSeats > 0 ? (
              <button
                onClick={joinTable}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl"
              >
                Rejoindre la table
              </button>
            ) : (
              <p className="text-gray-400">Table pleine</p>
            )}
          </div>

          {/* Bouton retour */}
          <div className="text-center mt-8">
            <button
              onClick={() => navigate('/lobby')}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-xl"
            >
              Retour au salon
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TablePage;
