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
  host?: { firstName: string; lastName: string } | string;
  createdAt?: string;
}

export default function SalonListPage() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const { user } = useAuth();
  const qc = useQueryClient();

  const fetchSalons = async (): Promise<LobbyItem[]> => {
    const res = await api.get<LobbyItem[]>('/game?status=waiting');
    if (!res.success) throw new Error(res.error || 'Erreur de chargement');
    return res.data || [];
  };

  const { data: salons = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['lobby', 'waiting'],
    queryFn: fetchSalons,
  });

  useEffect(() => {
    if (!socket) return;
    const onLobby = () => {
      qc.invalidateQueries({ queryKey: ['lobby', 'waiting'] });
    };
    socket.on('lobby_updated', onLobby);
    return () => {
      socket.off('lobby_updated', onLobby);
    };
  }, [socket, qc]);

  const handleCreate = async (maxPlayers: number) => {
    try {
      const res = await api.post<any>('/game', { maxPlayers, cardsPerPlayer: 6 });
      if (!res.success || !res.data) throw new Error(res.error || 'Création échouée');
      const code = res.data.code;
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
    <div className="container" style={{ padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Salons en attente</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => handleCreate(2)}>Créer 2</button>
          <button onClick={() => handleCreate(3)}>Créer 3</button>
          <button onClick={() => handleCreate(4)}>Créer 4</button>
        </div>
      </div>

      {(isLoading || isFetching) && <div>Chargement...</div>}

      {grid.length === 0 && !isLoading && (
        <div>Aucun salon. Créez-en un pour commencer.</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
        {grid.map((s) => (
          <div key={s.code} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div style={{ position: 'relative' }}>
              <img src={salonImg} alt="Salon" style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 6 }} />
              <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 8px', borderRadius: 4, fontSize: 12 }}>
                {s.playerCount}/{s.maxPlayers}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <div>
                <div style={{ fontWeight: 600, cursor: 'pointer' }} title="Renommer" onClick={() => handleRename(s.code, s.name)}>
                  {s.name?.trim() ? s.name : `Salon ${s.code}`}
                </div>
                <div style={{ fontSize: 12, color: '#666' }}>Code: {s.code}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button onClick={() => navigate(`/room/${s.code}`)}>
                  Rejoindre
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
