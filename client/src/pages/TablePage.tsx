import React from 'react';
import tableGameImg from '../assets/cards/tableGame.png';
import playerInImg from '../assets/cards/playerIn.png';
import playerOutImg from '../assets/cards/playerOut.png';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../lib/api';

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
  const [loading, setLoading] = React.useState(true);

  // Récupérer les détails de la table
  React.useEffect(() => {
    const fetchTable = async () => {
      if (!tableId) return;

      try {
        setLoading(true);
        const response = await api.get(`/game/tables/${tableId}`);
        if (response.data?.success) {
          setTable(response.data.data);
        } else {
          setError(response.data?.error || 'Erreur lors du chargement de la table');
        }
      } catch (e: any) {
        setError(e.error || e.message || 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    };

    fetchTable();
  }, [tableId]);

  React.useEffect(() => {
    if (!socket || !tableId) return;

    const handleTableUpdated = (updatedTable: any) => {
      console.log('Table mise à jour reçue:', updatedTable);
      // Recharger les données de la table
      const fetchTable = async () => {
        try {
          const response = await api.get(`/game/tables/${tableId}`);
          if (response.data?.success) {
            setTable(response.data.data);
          }
        } catch (e: any) {
          console.error('Erreur rechargement table:', e);
        }
      };
      fetchTable();
    };

    const handleGameStarted = ({ tableCode }: { tableCode: string }) => {
      if (table?.code === tableCode) {
        navigate(`/game/${tableCode}`);
      }
    };

    const handleTableDeleted = ({ tableId: deletedTableId }: { tableId: string }) => {
      if (deletedTableId === tableId) {
        alert('La table a été supprimée par l\'hôte');
        navigate('/lobby');
      }
    };

    // Observer la table spécifique
    if (table?.code) {
      socket.emit('join', table.code);
    }
    socket.on('table_updated', handleTableUpdated);
    socket.on('player_joined_table', handleTableUpdated);
    socket.on('player_left_table', handleTableUpdated);
    socket.on('game_started', handleGameStarted);
    socket.on('table_deleted', handleTableDeleted);

    return () => {
      if (table?.code) {
        socket.emit('leave', table.code);
      }
      socket.off('table_updated', handleTableUpdated);
      socket.off('player_joined_table', handleTableUpdated);
      socket.off('player_left_table', handleTableUpdated);
      socket.off('game_started', handleGameStarted);
      socket.off('table_deleted', handleTableDeleted);
    };
  }, [socket, tableId, table?.code, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Chargement de la table...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <p className="text-red-400 mb-4">Erreur : {error}</p>
          <button
            onClick={() => navigate('/lobby')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded"
          >
            Retour au salon
          </button>
        </div>
      </div>
    );
  }

  if (!table) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <p className="mb-4">Table non trouvée</p>
          <button
            onClick={() => navigate('/lobby')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded"
          >
            Retour au salon
          </button>
        </div>
      </div>
    );
  }

  const isUserInTable = table.players.some(p => p._id === user?._id);
  const availableSeats = table.maxPlayers - table.players.length;
  const isHost = table.hostId === user?._id;

  const joinTable = async () => {
    if (!user?._id) return;
    try {
      const response = await api.post(`/game/tables/${tableId}/join`, { socketId: socket?.id });
      if (response.data?.success) {
        setTable(response.data.data);
      }
    } catch (e: any) {
      setError(e.error || e.message || 'Erreur lors de la connexion à la table');
    }
  };

  const leaveTable = async () => {
    if (!user?._id) return;
    try {
      const response = await api.post(`/game/tables/${tableId}/leave`);
      if (response.data?.success) {
        navigate('/lobby');
      }
    } catch (e: any) {
      setError(e.error || e.message || 'Erreur lors du départ de la table');
    }
  };

  const startGame = async () => {
    if (!user?._id) return;
    try {
      const response = await api.post(`/game/tables/${tableId}/start`);
      if (response.data?.success) {
        navigate(`/game/${table.code}`);
      }
    } catch (e: any) {
      setError(e.error || e.message || 'Erreur lors du démarrage');
    }
  };

  const deleteTable = async () => {
    if (!user?._id || !isHost) return;
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette table ?')) return;
    
    try {
      const response = await api.delete(`/game/tables/${tableId}`);
      if (response.data?.success) {
        navigate('/lobby');
      }
    } catch (e: any) {
      setError(e.error || e.message || 'Erreur lors de la suppression');
    }
  };

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
              <img src={tableGameImg} alt="Table de jeu" className="w-64 h-40 object-contain" />
            </div>

            {/* Sièges visuels avec images cliquables */}
            <div className={`flex justify-center items-center gap-8 ${table.maxPlayers === 4 ? 'grid grid-cols-2 gap-12' : 'flex-row'}`}>
              {Array.from({ length: table.maxPlayers }).map((_, i) => {
                const position = i + 1;
                const player = table.players.find(p => p.position === position);
                const isCurrentUser = player?._id === user?._id;
                
                return (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <button
                      onClick={() => {
                        if (!player && !isUserInTable) {
                          joinTable();
                        } else if (isCurrentUser) {
                          leaveTable();
                        }
                      }}
                      disabled={player && !isCurrentUser}
                      className={`relative transition-transform hover:scale-105 ${
                        player && !isCurrentUser ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                      }`}
                    >
                      <img 
                        src={player ? playerInImg : playerOutImg} 
                        alt={player ? 'Siège occupé' : 'Siège libre'} 
                        className="w-24 h-24 object-contain"
                      />
                    </button>
                    {player ? (
                      <span className="text-white font-semibold text-sm mt-1">
                        {player.firstName} {player.lastName}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">Place {position}</span>
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
          <div className="text-center flex gap-4 justify-center">
            {isUserInTable && isHost && table.status === 'waiting' && table.players.length >= 2 && (
              <button
                onClick={startGame}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg"
              >
                Démarrer le jeu
              </button>
            )}
            {isHost && (
              <button
                onClick={deleteTable}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg"
              >
                Supprimer la table
              </button>
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
