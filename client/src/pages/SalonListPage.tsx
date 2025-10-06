import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import salonImg from '../assets/cards/salonJeux.png';

interface LobbyItem {
  code: string;
  name: string;
  status: 'waiting' | 'playing' | 'finished';
  maxPlayers: number;
  playerCount: number;
  host?: { _id: string; firstName?: string; lastName?: string } | string;
  createdAt?: string;
}

export default function SalonListPage() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const { user } = useAuth();
  const qc = useQueryClient();

  const fetchSalons = async (): Promise<LobbyItem[]> => {
    const res: any = await api.get<LobbyItem[]>('/game?status=waiting,playing');
    if (!res?.data?.success) throw new Error(res?.data?.message || 'Erreur de chargement');
    return (res?.data?.data as LobbyItem[]) || [];
  };

  const { data: salons = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['lobby', 'waiting,playing'],
    queryFn: fetchSalons,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!socket) return;
    const onLobby = () => {
      qc.invalidateQueries({ queryKey: ['lobby', 'waiting,playing'] });
    };
    socket.on('lobby_updated', onLobby);
    return () => {
      socket.off('lobby_updated', onLobby);
    };
  }, [socket, qc]);

  const handleDelete = async (code: string) => {
    const ok = window.confirm('Supprimer ce salon ?');
    if (!ok) return;
    try {
      const res: any = await api.delete(`/game/${code}`);
      if (!res?.data?.success) throw new Error(res?.data?.message || 'Suppression échouée');
      await refetch();
    } catch (e) {
      console.error(e);
      alert('Impossible de supprimer le salon');
    }
  };

  const handleCreate = async (maxPlayers: number) => {
    try {
      const res = await api.post<any>('/game', { maxPlayers, cardsPerPlayer: 6 });
      if (!('data' in res) || !res.data?.success) throw new Error((res as any)?.data?.message || 'Création échouée');
      const code = (res as any).data.data.code;
      // Optionally prompt for name
      const suggested = `Salon de ${user?.firstName ?? 'joueur'}`;
      const name = window.prompt('Nom du salon (optionnel):', suggested);
      if (name && name.trim()) {
        await api.patch(`/game/${code}/name`, { name: name.trim() });
      }
      // Go to the room
      navigate(`/room/${code}`);
    } catch (e) {
      console.error(e);
      alert('Erreur lors de la création du salon');
    }
  };

  const handleRename = async (code: string, current: string) => {
    const name = window.prompt('Nouveau nom du salon:', current || '');
    if (name == null) return;
    try {
      await api.patch(`/game/${code}/name`, { name: name.trim() });
      await refetch();
    } catch (e) {
      console.error(e);
      alert('Impossible de renommer le salon');
    }
  };

  const grid = useMemo(() => salons, [salons]);

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white drop-shadow">Salons en attente</h2>
        <div className="flex gap-2">
          <button className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm" onClick={() => handleCreate(2)}>Créer 2</button>
          <button className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm" onClick={() => handleCreate(3)}>Créer 3</button>
          <button className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm" onClick={() => handleCreate(4)}>Créer 4</button>
        </div>
      </div>

      {(isLoading || isFetching) && <div className="text-white/90">Chargement...</div>}

      {grid.length === 0 && !isLoading && (
        <div className="text-white/80">Aucun salon. Créez-en un pour commencer.</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {grid.map((s) => {
          return (
            <div key={s.code} className="group rounded-xl border border-white/20 bg-white/10 backdrop-blur-md shadow-lg overflow-hidden transition-transform hover:-translate-y-0.5 hover:shadow-xl">
              <div className="relative">
                <img src={salonImg} alt="Salon" className="w-full h-40 object-cover" />
                <div className="absolute top-2 left-2 text-xs px-2 py-1 rounded bg-black/60 text-white">
                  {s.playerCount}/{s.maxPlayers}
                </div>
                <div className="absolute top-2 right-2 text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-indigo-600 text-white">
                  {s.status}
                </div>
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-white drop-shadow cursor-pointer" title="Renommer" onClick={() => handleRename(s.code, s.name)}>
                      {s.name?.trim() ? s.name : `Salon ${s.code}`}
                    </div>
                    <div className="text-xs text-white/80">Code: {s.code}</div>
                  </div>
                  <button onClick={() => navigate(`/room/${s.code}`)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded">Entrer</button>
                </div>
                <div className="flex justify-end mt-2">
                  <button onClick={() => handleDelete(s.code)} className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded">
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
