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

type RoomState = {
  code: string;
  name: string;
  tables: GameTable[];
  maxTables: number;
  createdAt: string;
};

const RoomPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();
  const apiBase = (import.meta as any).env?.VITE_API_URL || '/api';

  const [state, setState] = React.useState<RoomState | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [creatingTable, setCreatingTable] = React.useState<2|3|4 | null>(null);
  const [joiningTable, setJoiningTable] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!socket || !code || !user?._id) return;

    const handleRoomUpdated = (roomData: RoomState) => {
      setState(roomData);
    };

    const handleTableCreated = (tableData: GameTable) => {
      setState(prev => prev ? {
        ...prev,
        tables: [...prev.tables, tableData]
      } : null);
    };

    const handlePlayerJoinedTable = ({ tableId, player }: { tableId: string, player: TablePlayer }) => {
      setState(prev => prev ? {
        ...prev,
        tables: prev.tables.map(table =>
          table._id === tableId
            ? { ...table, players: [...table.players, player] }
            : table
        )
      } : null);
    };

    const handlePlayerLeftTable = ({ tableId, playerId }: { tableId: string, playerId: string }) => {
      setState(prev => prev ? {
        ...prev,
        tables: prev.tables.map(table =>
          table._id === tableId
            ? { ...table, players: table.players.filter(p => p._id !== playerId) }
            : table
        )
      } : null);
    };

    const handleGameStarted = ({ tableCode }: { tableCode: string }) => {
      navigate(`/game/${tableCode}`);
    };

    // Observer le salon
    socket.emit('watch_room', { gameCode: code });
    socket.on('room_updated', handleRoomUpdated);
    socket.on('table_created', handleTableCreated);
    socket.on('player_joined_table', handlePlayerJoinedTable);
    socket.on('player_left_table', handlePlayerLeftTable);
    socket.on('game_started', handleGameStarted);
    socket.on('error', (e: any) => setError(e?.message ?? 'Erreur socket'));

    return () => {
      socket.off('room_updated', handleRoomUpdated);
      socket.off('table_created', handleTableCreated);
      socket.off('player_joined_table', handlePlayerJoinedTable);
      socket.off('player_left_table', handlePlayerLeftTable);
      socket.off('game_started', handleGameStarted);
      socket.off('error');
    };
  }, [socket, code, user?._id, navigate]);

  const createTable = async (maxPlayers: 2|3|4) => {
    if ((!user?.token && !localStorage.getItem('token')) || !code) {
      setError('Token d\'authentification manquant ou code salon invalide');
      return;
    }

    setCreatingTable(maxPlayers);
    setError(null);

    try {
      const token = user?.token || localStorage.getItem('token');
      const response = await fetch(`${apiBase}/game/${encodeURIComponent(code)}/tables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ maxPlayers })
      });

      if (!response.ok) throw new Error('Impossible de créer la table');
      // La table sera ajoutée via le socket event 'table_created'
    } catch (e: any) {
      setError(e.message || 'Erreur lors de la création de la table');
    } finally {
      setCreatingTable(null);
    }
  };

  const joinTable = async (tableId: string) => {
    if (!user?._id) return;

    setJoiningTable(tableId);
    setError(null);

    try {
      socket?.emit('join_table', { tableId, userId: user._id });
    } catch (e: any) {
      setError(e.message || 'Erreur lors de la connexion à la table');
    } finally {
      setJoiningTable(null);
    }
  };

  const leaveTable = async (tableId: string) => {
    if (!user?._id) return;

    try {
      socket?.emit('leave_table', { tableId, userId: user._id });
    } catch (e: any) {
      setError(e.message || 'Erreur lors du départ de la table');
    }
  };

  const isUserInTable = (table: GameTable) => {
    return table.players.some(p => p._id === user?._id);
  };

  const getAvailableSeats = (table: GameTable) => {
    return table.maxPlayers - table.players.length;
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background avec effets de profondeur */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 via-violet-900 to-indigo-900" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(120,119,198,0.3),transparent_50%)] bg-[radial-gradient(circle_at_80%_20%,rgba(255,119,198,0.15),transparent_50%)] bg-[radial-gradient(circle_at_40%_80%,rgba(120,198,255,0.1),transparent_50%)]" />

      {/* Particules flottantes sophistiquées */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className={`absolute rounded-full animate-float opacity-20`}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${2 + Math.random() * 4}px`,
              height: `${2 + Math.random() * 4}px`,
              background: `radial-gradient(circle, rgba(${120 + Math.random() * 135}, ${119 + Math.random() * 136}, ${198 + Math.random() * 57}, 0.8), transparent)`,
              animationDelay: `${Math.random() * 8}s`,
              animationDuration: `${6 + Math.random() * 8}s`
            }}
          />
        ))}
      </div>

      {/* Cercles décoratifs en arrière-plan */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-purple-400/10 to-pink-400/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-r from-blue-400/10 to-cyan-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />

      <div className="relative z-10 min-h-screen p-4">
        <div className="max-w-7xl mx-auto">

          {/* Header du salon - Design ultra premium */}
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent rounded-3xl backdrop-blur-sm" />
            <div className="relative bg-gradient-to-br from-black/60 via-gray-900/60 to-black/60 backdrop-blur-xl rounded-3xl p-8 shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5 rounded-3xl" />
              <div className="relative">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <h1 className="text-5xl lg:text-6xl font-black">
                      <span className="bg-gradient-to-r from-white via-purple-200 via-pink-200 to-white bg-clip-text text-transparent animate-pulse">
                        Salon {state?.name || code}
                      </span>
                    </h1>
                    <div className="flex items-center gap-4 text-gray-300">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        <span>Code:</span>
                        <span className="font-mono text-purple-300 select-all bg-black/30 px-2 py-1 rounded">{code}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    {/* Stats du salon */}
                    <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-2xl px-6 py-4">
                      <div className="text-sm text-gray-300 mb-1">Tables actives</div>
                      <div className="text-3xl font-bold text-white">
                        {state?.tables.length ?? 0}<span className="text-lg text-gray-400">/{state?.maxTables ?? 8}</span>
                      </div>
                    </div>

                    {/* Boutons de création rapide - Design premium */}
                    <div className="flex gap-3">
                      {[2, 3, 4].map(num => (
                        <button
                          key={num}
                          onClick={() => createTable(num as 2|3|4)}
                          disabled={creatingTable === num || (state?.tables.length ?? 0) >= (state?.maxTables ?? 8)}
                          className="group relative overflow-hidden bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:via-emerald-500 hover:to-teal-500 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-500 transform hover:scale-110 hover:shadow-2xl disabled:transform-none disabled:scale-100 disabled:shadow-none shadow-lg"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                          <span className="relative flex items-center gap-3 text-lg">
                            {creatingTable === num ? (
                              <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Création...</span>
                              </>
                            ) : (
                              <>
                                <span className="text-2xl">👥</span>
                                <span>{num} joueurs</span>
                              </>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Messages d'erreur - Design premium */}
          {error && (
            <div className="mb-8 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-pink-500/20 rounded-2xl backdrop-blur-sm" />
              <div className="relative bg-red-500/10 backdrop-blur-xl rounded-2xl p-6 border border-red-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
                    <span className="text-red-400 text-lg">⚠️</span>
                  </div>
                  <p className="text-red-300 font-medium">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Grille des tables - Design révolutionnaire */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {state?.tables.map((table, index) => (
              <div
                key={table._id}
                className="group relative animate-fade-in-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {/* Glow effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 rounded-3xl blur opacity-0 group-hover:opacity-20 transition-opacity duration-500" />

                <div className="relative bg-gradient-to-br from-gray-900/90 via-black/90 to-gray-900/90 backdrop-blur-xl rounded-3xl overflow-hidden shadow-2xl border border-white/10 hover:border-purple-400/30 transition-all duration-500 hover:transform hover:scale-105">
                  {/* Header de la table avec effet de profondeur */}
                  <div className="relative p-8">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-pink-500/10" />
                    <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-purple-400/50 to-transparent" />

                    <div className="relative flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full animate-pulse ${
                          table.status === 'waiting' ? 'bg-yellow-400' :
                          table.status === 'playing' ? 'bg-green-400' : 'bg-gray-400'
                        }`} />
                        <h3 className="text-2xl font-bold text-white">
                          Table {table.maxPlayers} joueurs
                        </h3>
                      </div>

                      <div className={`px-4 py-2 rounded-full text-sm font-bold backdrop-blur-sm ${
                        table.status === 'waiting'
                          ? 'bg-yellow-500/20 text-yellow-300'
                          : table.status === 'playing'
                          ? 'bg-green-500/20 text-green-300'
                          : 'bg-gray-500/20 text-gray-300'
                      }`}>
                        {table.status === 'waiting' ? '🕐 En attente' :
                         table.status === 'playing' ? '🎮 En cours' : '✅ Terminée'}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-300">Joueurs:</span>
                        <span className="text-white font-semibold">
                          {table.players.length}/{table.maxPlayers}
                        </span>
                      </div>
                      <div className="bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full">
                        <span className="text-purple-300 font-mono text-xs">
                          Code: {table.code}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Zone de la table avec effet 3D */}
                  <div className="relative p-8 pt-6">
                    <div className="bg-gradient-to-br from-emerald-900/30 via-green-800/20 to-emerald-900/30 rounded-2xl p-6 border border-emerald-500/20 relative overflow-hidden">
                      {/* Effet de lumière sur la table */}
                      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/10" />

                      <img
                        src={tableGameImg}
                        alt="Table de jeu"
                        className="w-full h-32 object-contain mx-auto mb-6 relative z-10 drop-shadow-2xl"
                      />

                      {/* Sièges avec design premium */}
                      <div className="absolute inset-0 flex items-center justify-center z-20">
                        <div className={`grid gap-3 ${
                          table.maxPlayers === 2 ? 'grid-cols-2' :
                          table.maxPlayers === 3 ? 'grid-cols-3' : 'grid-cols-2 grid-rows-2 gap-4'
                        }`}>
                          {Array.from({ length: table.maxPlayers }).map((_, i) => {
                            const player = table.players.find(p => p.position === i + 1);
                            const isCurrentUser = player?._id === user?._id;

                            return (
                              <div
                                key={i}
                                className={`relative w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-300 hover:scale-110 ${
                                  player
                                    ? isCurrentUser
                                      ? 'border-purple-400 bg-gradient-to-br from-purple-500/30 to-purple-600/40 shadow-lg shadow-purple-500/50'
                                      : 'border-green-400 bg-gradient-to-br from-green-500/30 to-green-600/40 shadow-lg shadow-green-500/50'
                                    : 'border-gray-600 bg-gray-800/50 hover:border-gray-500'
                                }`}
                                title={player ? `${player.firstName} ${player.lastName}` : `Siège ${i + 1} libre`}
                              >
                                {player ? (
                                  <span className="text-sm font-bold text-white">
                                    {player.firstName[0]}{player.lastName[0]}
                                  </span>
                                ) : (
                                  <span className="text-lg text-gray-400">?</span>
                                )}

                                {isCurrentUser && (
                                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-400 rounded-full animate-pulse shadow-lg shadow-purple-400/50" />
                                )}

                                {/* Effet de glow pour les sièges occupés */}
                                {player && (
                                  <div className={`absolute inset-0 rounded-full blur-sm opacity-50 ${
                                    isCurrentUser ? 'bg-purple-400' : 'bg-green-400'
                                  }`} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions de la table - Design sophistiqué */}
                  <div className="p-8 pt-6 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getAvailableSeats(table) > 0 ? (
                          <div className="flex items-center gap-2 text-green-400">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                            <span className="font-medium">
                              {getAvailableSeats(table)} place{getAvailableSeats(table) > 1 ? 's' : ''} libre{getAvailableSeats(table) > 1 ? 's' : ''}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-red-400">
                            <div className="w-2 h-2 bg-red-400 rounded-full" />
                            <span className="font-medium">Table complète</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3">
                        {isUserInTable(table) ? (
                          <>
                            <button
                              onClick={() => leaveTable(table._id)}
                              className="group/btn relative overflow-hidden bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white font-bold py-2 px-4 rounded-xl transition-all duration-300 hover:scale-105"
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700" />
                              <span className="relative">Quitter</span>
                            </button>
                            {table.players.find(p => p._id === user?._id)?._id === table.hostId && table.status === 'waiting' && (
                              <button
                                onClick={() => socket?.emit('start_game', { tableId: table._id })}
                                className="group/btn relative overflow-hidden bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold py-2 px-4 rounded-xl transition-all duration-300 hover:scale-105"
                              >
                                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700" />
                                <span className="relative">Démarrer</span>
                              </button>
                            )}
                          </>
                        ) : getAvailableSeats(table) > 0 ? (
                          <button
                            onClick={() => joinTable(table._id)}
                            disabled={joiningTable === table._id}
                            className="group/btn relative overflow-hidden bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-2 px-4 rounded-xl transition-all duration-300 hover:scale-105 disabled:transform-none"
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700" />
                            <span className="relative">
                              {joiningTable === table._id ? 'Connexion...' : 'Rejoindre'}
                            </span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* État vide - Design immersif */}
            {(!state?.tables || state.tables.length === 0) && (
              <div className="col-span-full relative animate-fade-in-up">
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 rounded-3xl blur opacity-20" />

                <div className="relative bg-gradient-to-br from-gray-900/90 via-black/90 to-gray-900/90 backdrop-blur-xl rounded-3xl p-16 text-center shadow-2xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5 rounded-3xl" />

                  <div className="relative">
                    <div className="text-8xl mb-6 animate-bounce">🎲</div>
                    <h3 className="text-4xl font-bold text-white mb-4">
                      Aucune table active
                    </h3>
                    <p className="text-xl text-gray-300 mb-8 max-w-md mx-auto leading-relaxed">
                      Soyez le premier à créer une table et lancez l'aventure Memory Master !
                    </p>

                    <div className="flex justify-center gap-4">
                      {[2, 3, 4].map(num => (
                        <button
                          key={num}
                          onClick={() => createTable(num as 2|3|4)}
                          disabled={creatingTable !== null}
                          className="group relative overflow-hidden bg-gradient-to-br from-purple-600 via-pink-600 to-purple-600 hover:from-purple-500 hover:via-pink-500 hover:to-purple-500 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-500 transform hover:scale-110 hover:shadow-2xl disabled:transform-none disabled:scale-100 shadow-lg"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                          <span className="relative flex items-center gap-3 text-xl">
                            {creatingTable === num ? (
                              <>
                                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Création...</span>
                              </>
                            ) : (
                              <>
                                <span className="text-3xl">👥</span>
                                <span>{num} joueurs</span>
                              </>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions globales - Design épuré */}
          <div className="mt-12 flex justify-center">
            <button
              onClick={() => navigate('/lobby')}
              className="group relative overflow-hidden bg-gradient-to-r from-white/10 to-white/5 hover:from-white/20 hover:to-white/10 text-white font-bold py-4 px-8 rounded-2xl backdrop-blur-sm border border-white/20 transition-all duration-300 hover:border-white/40"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              <span className="relative flex items-center gap-3">
                <span>🏠</span>
                Retour au lobby
              </span>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-15px) rotate(3deg);
          }
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out forwards;
        }

        .animate-float {
          animation: float 8s ease-in-out infinite;
        }

        .group:hover img {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default RoomPage;
