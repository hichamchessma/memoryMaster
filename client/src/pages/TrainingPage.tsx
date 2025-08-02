import React, { useEffect } from 'react';

interface PlayerZoneProps {
  position: 'top' | 'bottom';
  playerName: string;
}

const PlayerZone: React.FC<PlayerZoneProps> = ({ position, playerName }) => {
  return (
    <div className="flex flex-col items-center h-full">
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-300 to-orange-400 border-4 border-white shadow-lg flex items-center justify-center mb-1">
        <span role="img" aria-label="avatar" className="text-2xl select-none">{position === 'top' ? '👑' : '🧠'}</span>
      </div>
      <div className="text-2xl font-extrabold mb-1 text-white drop-shadow-lg tracking-wide" style={{letterSpacing: '2px'}}>{playerName}</div>
      {/* Territory cards placeholder */}
      <div className="flex space-x-1 mb-1">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div
            key={idx}
            className="w-10 h-14 bg-gray-700 border-2 border-gray-300 rounded-md shadow-md flex items-center justify-center text-lg font-bold text-gray-200 hover:scale-105 hover:shadow-yellow-200/60 transition-transform duration-200 cursor-pointer"
          >
            <span>🃏</span>
          </div>
        ))}
      </div>
      {/* Picture zone placeholder */}
      <div className="w-28 h-28 bg-gradient-to-br from-gray-700 to-gray-900 border-4 border-yellow-400 rounded-2xl shadow-lg opacity-90 flex items-center justify-center">
        <span className="text-3xl text-yellow-200">🃏</span>
      </div>
    </div>
  );
};

const TrainingPage: React.FC = () => {
  // Désactive le scroll global quand la page est montée
  useEffect(() => {
    const originalHtml = document.documentElement.style.overflow;
    const originalBody = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = originalHtml;
      document.body.style.overflow = originalBody;
    };
  }, []);

  return (
    <div
      className="h-screen w-full bg-cover bg-center homepage-bg grid grid-rows-[min-content_minmax(40px,0.9fr)_1.7fr_minmax(40px,0.9fr)] text-gray-200 overflow-hidden relative"
    >
      {/* Titre */}
      <div className="absolute top-0 left-0 w-full flex items-center justify-center z-20" style={{margin:0,padding:0}}>
        <span className="bg-yellow-400 bg-opacity-90 text-gray-900 px-4 py-1 rounded-xl shadow-xl text-xl font-extrabold tracking-widest border-2 border-white drop-shadow-lg uppercase">Mode Entraînement</span>
      </div>

      {/* Joueur 1 (haut) */}
      <div className="row-start-2 row-end-3 flex items-end justify-center min-h-[40px]">
        <PlayerZone position="top" playerName="Joueur 1" />
      </div>
      {/* Plateau (milieu) */}
      <div className="row-start-3 row-end-4 flex justify-center items-center">
        {/* Deck complètement à gauche */}
        <div className="absolute left-6 top-1/2 transform -translate-y-1/2 z-20">
          <div className="w-24 h-36 bg-blue-700 border-4 border-white rounded-2xl shadow-2xl flex flex-col items-center justify-center text-lg font-bold text-white transition-transform duration-200 hover:scale-105 hover:shadow-yellow-300/70 cursor-pointer relative">
            <span className="mb-1">Deck</span>
            <span className="text-3xl">🃏</span>
            <span className="absolute -top-4 right-2 bg-yellow-400 text-gray-900 font-bold px-2 py-1 rounded-full text-xs shadow">Cartes</span>
          </div>
        </div>
        {/* Discard pile center */}
        <div>
          <div className="w-20 h-28 bg-gray-600 border-4 border-yellow-400 rounded-2xl flex flex-col items-center justify-center text-base font-bold shadow-xl transition-transform duration-200 hover:scale-105 hover:shadow-yellow-400/60 cursor-pointer relative">
            <span className="mb-1">Pile</span>
            <span className="text-2xl">🗑️</span>
            <span className="absolute -top-3 left-2 bg-gray-300 text-gray-800 font-bold px-2 py-1 rounded-full text-xs shadow">Défausse</span>
          </div>
        </div>
      </div>
      {/* Joueur 2 (bas) */}
      <div className="row-start-4 row-end-5 flex items-start justify-center min-h-[60px]">
        <PlayerZone position="bottom" playerName="Joueur 2" />
      </div>
    </div>
  );
};

export default TrainingPage;
