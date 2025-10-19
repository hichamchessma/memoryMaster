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

  // Polling automatique pour garantir la synchronisation
  React.useEffect(() => {
    if (!tableId) return;

    const fetchTableData = async () => {
      try {
        const response = await api.get(`/game/tables/${tableId}`);
        if (response.data?.success) {
          setTable(response.data.data);
        }
      } catch (e: any) {
        console.error('Erreur rechargement table:', e);
      }
    };

    // Polling toutes les 2 secondes
    const interval = setInterval(fetchTableData, 2000);

    return () => clearInterval(interval);
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
  const canDelete = true; // Tout le monde est admin pour les tests

  const joinTable = async () => {
    if (!user?._id) return;
    try {
      const response = await api.post(`/game/tables/${tableId}/join`, { socketId: socket?.id });
      if (response.data?.success) {
        setTable(response.data.data);
        
        // Rediriger vers la page appropriée selon le nombre de joueurs
        if (response.data.data.maxPlayers === 2) {
          navigate('/game/2players', { 
            state: { 
              tableId: response.data.data._id,
              tableCode: response.data.data.code,
              players: response.data.data.players,
              currentUserId: user._id
            } 
          });
        }
        // TODO: Ajouter les redirections pour 3 et 4 joueurs
        // else if (response.data.data.maxPlayers === 3) {
        //   navigate('/game/3players', { state: {...} });
        // }
        // else if (response.data.data.maxPlayers === 4) {
        //   navigate('/game/4players', { state: {...} });
        // }
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated background particles */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,246,0.15),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(59,130,246,0.15),transparent_50%)]"></div>
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white opacity-10"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${2 + Math.random() * 4}px`,
              height: `${2 + Math.random() * 4}px`,
              animation: `float ${5 + Math.random() * 10}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>
      
      {/* Animations CSS */}
      <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          25% { transform: translateY(-20px) translateX(10px); }
          50% { transform: translateY(-10px) translateX(-10px); }
          75% { transform: translateY(-30px) translateX(5px); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 2s ease-in-out infinite;
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>

      <div className="relative z-10 p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-block bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 p-1 rounded-xl shadow-xl">
              <div className="bg-slate-900 px-6 py-2 rounded-lg">
                <h1 className="text-3xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent mb-1">
                  Table {table.maxPlayers} Joueurs
                </h1>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs text-gray-400 font-semibold">CODE</span>
                  <span className="text-xl font-mono font-bold text-yellow-400">{table.code}</span>
                  <button 
                    onClick={() => navigator.clipboard.writeText(table.code)}
                    className="px-2 py-0.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded text-xs font-bold transition-all"
                  >
                    📋
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Erreur */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300">
              {error}
            </div>
          )}

          {/* Table Display */}
          <div className="relative bg-gradient-to-br from-slate-800/90 via-purple-900/50 to-slate-800/90 backdrop-blur-xl rounded-2xl p-6 border-2 border-purple-500/30 mb-6 shadow-[0_15px_40px_rgba(139,92,246,0.4)]">
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-blue-600/20 blur-xl -z-10"></div>
            
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-500 rounded-2xl blur-lg opacity-40"></div>
                <img src={tableGameImg} alt="Table de jeu" className="relative w-56 h-32 object-contain drop-shadow-xl" />
              </div>
            </div>

            {/* Sièges visuels avec images cliquables */}
            <div className={`flex justify-center items-center gap-6 ${table.maxPlayers === 4 ? 'grid grid-cols-2 gap-8' : 'flex-row'}`}>
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
                        }
                        // isCurrentUser : sera utilisé pour ouvrir le profil plus tard
                      }}
                      disabled={!!player}
                      className={`relative transition-all duration-300 ${
                        isCurrentUser 
                          ? 'scale-110 animate-pulse-slow cursor-default' 
                          : player && !isCurrentUser 
                            ? 'cursor-not-allowed opacity-60' 
                            : 'cursor-pointer hover:scale-105'
                      }`}
                    >
                      {/* Effet lumineux pour le joueur actif */}
                      {isCurrentUser && (
                        <>
                          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400 blur-2xl opacity-75 animate-pulse"></div>
                          <div className="absolute -inset-3 rounded-full border-4 border-yellow-400 animate-spin-slow"></div>
                          <div className="absolute -inset-1 rounded-full border-2 border-yellow-300 opacity-50"></div>
                        </>
                      )}
                      
                      {/* Conteneur circulaire pour l'image */}
                      <div className={`relative z-10 w-24 h-24 rounded-full overflow-hidden border-3 ${
                        isCurrentUser 
                          ? 'border-yellow-400 shadow-[0_0_25px_rgba(251,191,36,0.8)]' 
                          : player 
                            ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' 
                            : 'border-gray-600 shadow-[0_0_8px_rgba(75,85,99,0.3)]'
                      } transition-all duration-300`}>
                        <img 
                          src={player ? playerInImg : playerOutImg} 
                          alt={player ? 'Siège occupé' : 'Siège libre'} 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </button>
                    {player ? (
                      <div className="flex flex-col items-center gap-1">
                        <span className={`font-semibold text-sm mt-1 ${
                          isCurrentUser 
                            ? 'text-yellow-400 font-bold text-base' 
                            : 'text-white'
                        }`}>
                          {player.firstName} {player.lastName}
                        </span>
                        {isCurrentUser && (
                          <span className="bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400 text-black text-xs px-3 py-1 rounded-full font-black shadow-lg animate-pulse">
                            ⭐ VOUS ⭐
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm font-medium">Place {position}</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="text-center mt-6 space-y-2">
              <div className="inline-flex items-center gap-2 bg-slate-800/80 px-4 py-2 rounded-xl border border-purple-500/30">
                <span className="text-xl font-bold text-white">
                  {table.players.length}/{table.maxPlayers}
                </span>
                <span className="text-gray-400 text-sm font-medium">JOUEURS</span>
              </div>
              {availableSeats > 0 ? (
                <div className="inline-flex items-center gap-2 bg-green-500/20 px-4 py-1.5 rounded-lg border border-green-500/30">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div>
                  <p className="text-green-400 text-sm font-bold">
                    {availableSeats} place{availableSeats > 1 ? 's' : ''} disponible{availableSeats > 1 ? 's' : ''}
                  </p>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 bg-red-500/20 px-4 py-1.5 rounded-lg border border-red-500/30">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                  <p className="text-red-400 text-sm font-bold">TABLE COMPLÈTE</p>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="text-center flex gap-3 justify-center flex-wrap">
            {isUserInTable && isHost && table.status === 'waiting' && table.players.length >= 2 && (
              <button
                onClick={startGame}
                className="group relative bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-black py-3 px-8 rounded-xl shadow-[0_8px_25px_rgba(34,197,94,0.4)] hover:shadow-[0_12px_35px_rgba(34,197,94,0.6)] transform hover:scale-105 transition-all duration-300"
              >
                <span className="relative z-10 flex items-center gap-2 text-sm">
                  🎮 DÉMARRER
                </span>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-green-400 to-emerald-500 opacity-0 group-hover:opacity-20 blur-lg transition-opacity"></div>
              </button>
            )}
            {canDelete && (
              <button
                onClick={deleteTable}
                className="group relative bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-black py-3 px-8 rounded-xl shadow-[0_8px_25px_rgba(239,68,68,0.4)] hover:shadow-[0_12px_35px_rgba(239,68,68,0.6)] transform hover:scale-105 transition-all duration-300"
              >
                <span className="relative z-10 flex items-center gap-2 text-sm">
                  🗑️ SUPPRIMER
                </span>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-400 to-rose-500 opacity-0 group-hover:opacity-20 blur-lg transition-opacity"></div>
              </button>
            )}
          </div>

          {/* Bouton retour */}
          <div className="text-center mt-6">
            <button
              onClick={() => navigate('/lobby')}
              className="group relative bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-2 px-6 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
            >
              <span className="flex items-center gap-2 text-sm">
                ← Retour au salon
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TablePage;
