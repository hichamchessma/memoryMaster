import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useSocket } from '../context/SocketContext';
import salonImg from '../assets/cards/salonJeux.png';

const LobbyPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [creatingTable, setCreatingTable] = React.useState<2|3|4 | null>(null);
  const qc = useQueryClient();
  const { socket } = useSocket();

  // --- Liste des tables actives (toutes visibles) ---
  type TableItem = {
    _id: string;
    code: string;
    maxPlayers: 2 | 3 | 4;
    players: Array<{ _id: string; firstName: string; lastName: string; position: number }>;
    status: 'waiting' | 'playing' | 'finished';
    hostId: string;
    createdAt: string;
  };

  const fetchTables = async (): Promise<TableItem[]> => {
    // Vérifier que l'utilisateur est authentifié avant de faire la requête
    if (!user?.token && !sessionStorage.getItem('token') && !localStorage.getItem('token')) {
      console.log('Aucun token disponible, requête annulée');
      return [];
    }

    const res: any = await api.get<TableItem[]>('/game/tables?status=waiting,playing');
    const ok = res?.data?.success;
    if (!ok) throw new Error(res?.data?.error || 'Erreur de chargement');
    return (res?.data?.data as TableItem[]) || [];
  };

  const { data: tables = [], isLoading: isTablesLoading, isFetching: isTablesFetching, error: tablesError } = useQuery({
    queryKey: ['tables', 'waiting,playing'],
    queryFn: fetchTables,
    enabled: !!user || !!sessionStorage.getItem('token') || !!localStorage.getItem('token'), // Seulement si authentifié
    refetchInterval: 5000, // Polling de secours
  });

  // Événements Socket.IO pour mises à jour temps réel
  React.useEffect(() => {
    if (!socket) return;
    const onTableUpdate = () => qc.invalidateQueries({ queryKey: ['tables', 'waiting,playing'] });
    socket.on('table_updated', onTableUpdate);
    socket.on('table_created', onTableUpdate);
    socket.on('table_deleted', onTableUpdate);
    socket.on('player_joined_table', onTableUpdate);
    socket.on('player_left_table', onTableUpdate);
    socket.on('game_started', (data: { tableCode: string }) => {
      navigate(`/game/${data.tableCode}`);
    });
    return () => {
      socket.off('table_updated', onTableUpdate);
      socket.off('table_created');
      socket.off('table_deleted');
      socket.off('player_joined_table');
      socket.off('player_left_table');
      socket.off('game_started');
    };
  }, [socket, qc, navigate]);

  // Créer une nouvelle table
  const handleCreateTable = async (maxPlayers: 2|3|4) => {
    setError(null);
    setCreatingTable(maxPlayers);
    try {
      console.log('Tentative de création de table pour', maxPlayers, 'joueurs');
      console.log('Utilisateur actuel:', user);
      console.log('Token dans user:', user?.token);
      console.log('Token dans sessionStorage:', sessionStorage.getItem('token'));
      console.log('Token dans localStorage:', localStorage.getItem('token'));

      const response = await api.post('/game/tables', { maxPlayers });
      console.log('Réponse serveur complète:', response);
      console.log('Réponse data:', response.data);
      console.log('Réponse data._id:', response.data?._id);
      console.log('Réponse data.data:', response.data?.data);
      console.log('Réponse data.data._id:', response.data?.data?._id);
      const tableId = response.data?.data?._id;
      if (!tableId) {
        console.error('Pas d\'ID trouvé dans la réponse:', response.data);
        throw new Error('ID de table manquant');
      }
      // Rediriger vers la table créée
      navigate(`/table/${tableId}`);
    } catch (e: any) {
      console.error('Erreur lors de la création de table:', e);
      setError(e.error || e.message || 'Erreur inconnue');
    } finally {
      setCreatingTable(null);
    }
  };

  // Rejoindre une table existante
  const handleJoinTable = async (tableId: string) => {
    setError(null);
    try {
      socket?.emit('join_table', { tableId, userId: user?._id });
      navigate(`/table/${tableId}`);
    } catch (e: any) {
      setError(e.message || 'Erreur lors de la connexion à la table');
    }
  };

  // Quitter une table
  const handleLeaveTable = async (tableId: string) => {
    try {
      socket?.emit('leave_table', { tableId, userId: user?._id });
    } catch (e: any) {
      setError(e.message || 'Erreur lors du départ de la table');
    }
  };

  // Supprimer une table (seulement l'hôte)
  const handleDeleteTable = async (tableId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette table ?')) return;
    try {
      const response = await api.delete(`/game/tables/${tableId}`);
      if (response.data?.success) {
        qc.invalidateQueries({ queryKey: ['tables', 'waiting,playing'] });
      }
    } catch (e: any) {
      setError(e.error || e.message || 'Erreur lors de la suppression');
    }
  };

  // Vérifier si l'utilisateur est dans une table
  const isUserInTable = (table: TableItem) => {
    return table.players.some(p => p._id === user?._id);
  };

  // Vérifier si l'utilisateur est l'hôte
  const isUserHost = (table: TableItem) => {
    return table.hostId === user?._id;
  };

  // Places disponibles
  const getAvailableSeats = (table: TableItem) => {
    return table.maxPlayers - table.players.length;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-900 relative overflow-hidden">
      {/* Particules flottantes */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-float opacity-20"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${2 + Math.random() * 4}px`,
              height: `${2 + Math.random() * 4}px`,
              background: `radial-gradient(circle, rgba(${120 + Math.random() * 135}, ${119 + Math.random() * 136}, ${198 + Math.random() * 57}, 0.8), transparent)`,
              animationDelay: `${Math.random() * 8}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold text-white mb-4">
              Salon Global - Memory Master
            </h1>
            <p className="text-xl text-gray-300">
              Créez ou rejoignez une table pour jouer !
            </p>
          </div>

          {/* Erreur */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300">
              {error}
            </div>
          )}

          {/* Création de table */}
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-semibold text-white mb-4">Créer une nouvelle table</h2>
            <div className="flex justify-center gap-4">
              {[2, 3, 4].map(num => (
                <button
                  key={num}
                  onClick={() => handleCreateTable(num as 2|3|4)}
                  disabled={creatingTable === num}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-gray-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 hover:scale-105"
                >
                  {creatingTable === num ? 'Création...' : `${num} joueurs`}
                </button>
              ))}
            </div>
          </div>

          {/* Liste des tables */}
          <div className="mb-8">
            <h2 className="text-3xl font-semibold text-white mb-6">Tables Actives</h2>
            {(isTablesLoading || isTablesFetching) && <div className="text-gray-300">Chargement des tables...</div>}
            {tablesError && <div className="text-red-300">Erreur de chargement des tables: {tablesError.message}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tables.map((table) => (
                <div key={table._id} className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20">
                  <div className="relative mb-4">
                    <img src={salonImg} alt="Table" className="w-full h-32 object-cover rounded" />
                    <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                      {table.players.length}/{table.maxPlayers}
                    </div>
                  </div>
                  <div className="mb-4">
                    <h3 className="font-semibold text-white">Table {table.maxPlayers} joueurs</h3>
                    <p className="text-sm text-gray-300">Code: {table.code}</p>
                    <p className="text-sm text-gray-300">
                      Statut: {table.status === 'waiting' ? 'En attente' : table.status === 'playing' ? 'En cours' : 'Terminée'}
                    </p>
                  </div>
                  <div className="mb-4">
                    <p className="text-sm text-gray-300">Joueurs assis:</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {table.players.map((player) => (
                        <span key={player._id} className="bg-blue-600 text-white text-xs px-2 py-1 rounded">
                          {player.firstName} {player.lastName}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-col">
                    <button
                      onClick={() => navigate(`/table/${table._id}`)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded"
                    >
                      {isUserInTable(table) ? 'Voir la table' : `Rejoindre (${getAvailableSeats(table)} places)`}
                    </button>
                    {isUserHost(table) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTable(table._id);
                        }}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded"
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {!isTablesLoading && !isTablesFetching && tables.length === 0 && (
                <div className="col-span-full text-center text-gray-300">
                  Aucune table active pour le moment. Créez la première !
                </div>
              )}
            </div>
          </div>

          {/* Actions supplémentaires */}
          <div className="text-center">
            <button
              onClick={() => navigate('/training')}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-xl"
            >
              Mode Entraînement
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default LobbyPage;
