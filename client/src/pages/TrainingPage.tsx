import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface PlayerZoneProps {
  position: 'top' | 'bottom';
  playerName: string;
}

import cardBack from '../assets/cards/card_back.png';

const PlayerZone: React.FC<PlayerZoneProps> = ({ position, playerName }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      {/* Board de 4 cartes face cachée */}
      {position === 'bottom' && (
        <div className="flex flex-row items-center justify-center mb-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <img
              key={idx}
              src={cardBack}
              alt="Carte cachée"
              className="w-16 h-24 mx-2 rounded shadow-md border-2 border-gray-300 bg-white"
              draggable="false"
            />
          ))}
        </div>
      )}
      {/* Avatar + nom */}
      <div className="flex flex-row items-center justify-center mb-1">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-300 to-orange-400 border-4 border-white shadow-lg flex items-center justify-center mr-2">
          <span role="img" aria-label="avatar" className="text-2xl select-none">{position === 'top' ? '👑' : '🧠'}</span>
        </div>
        <div className="text-2xl font-extrabold text-white drop-shadow-lg tracking-wide" style={{letterSpacing: '2px'}}>{playerName}</div>
      </div>
      {/* Board de 4 cartes face cachée pour le haut */}
      {position === 'top' && (
        <div className="flex flex-row items-center justify-center mt-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <img
              key={idx}
              src={cardBack}
              alt="Carte cachée"
              className="w-16 h-24 mx-2 rounded shadow-md border-2 border-gray-300 bg-white"
              draggable="false"
            />
          ))}
        </div>
      )}


  </div>
  );
};

const TrainingPage: React.FC = () => {
  const navigate = useNavigate();
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
      {/* Bouton Start a new game en haut à gauche */}
      <button
        className="absolute top-3 left-3 z-30 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-lg px-4 py-2 flex items-center justify-center text-base font-bold border-2 border-white focus:outline-none focus:ring-2 focus:ring-green-400"
        title="Start a new game"
        onClick={() => {/* logique à ajouter */}}
      >
        <span className="mr-2">🆕</span> Start a new game
      </button>
      {/* Bouton Dashboard en haut à droite */}
      <button
        className="absolute top-3 right-3 z-30 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg w-12 h-12 flex items-center justify-center text-2xl border-2 border-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        title="Retour au Dashboard"
        onClick={() => navigate('/dashboard')}
      >
        <span role="img" aria-label="Dashboard">🏠</span>
      </button>
      {/* Titre */}
      <div className="absolute top-0 left-0 w-full flex items-center justify-center z-20" style={{margin:0,padding:0}}>
        <span className="bg-yellow-400 bg-opacity-90 text-gray-900 px-4 py-1 rounded-xl shadow-xl text-xl font-extrabold tracking-widest border-2 border-white drop-shadow-lg uppercase">Mode Entraînement</span>
      </div>

      {/* Joueur 1 (haut) */}
      <div className="row-start-2 row-end-3 flex items-end justify-center min-h-[40px]">
        <PlayerZone position="top" playerName="Joueur 1" />
      </div>
      {/* Plateau (milieu) : deck à gauche, pile à droite, centre vide */}
      <div className="row-start-3 row-end-4 flex justify-start items-center relative min-h-[140px]">
        {/* Deck à gauche */}
        <div className="flex flex-col items-center ml-6">
          <div className="w-24 h-36 bg-blue-800 border-4 border-white rounded-xl shadow-xl flex flex-col items-center justify-center mb-2 relative">
            <span className="absolute -top-3 left-2 bg-yellow-400 text-gray-900 font-bold px-2 py-1 rounded-full text-xs shadow">Cartes</span>
            <span className="text-3xl">🂠</span>
            <span className="mt-2 text-sm font-bold">Deck</span>
          </div>
        </div>
        {/* Défausse juste à droite du deck */}
        <div className="flex flex-col items-center ml-6">
          <div className="w-24 h-36 bg-gray-800 border-4 border-yellow-400 rounded-xl shadow-xl flex flex-col items-center justify-center mb-2 relative">
            <span className="mb-1">Pile</span>
            <span className="text-2xl">🗑️</span>
            <span className="absolute -top-3 left-2 bg-gray-300 text-gray-800 font-bold px-2 py-1 rounded-full text-xs shadow">Défausse</span>
          </div>
        </div>
        {/* Le centre reste vide */}
      </div>
      {/* Joueur 2 (bas) */}
      <div className="row-start-4 row-end-5 flex items-start justify-center min-h-[60px]">
        <PlayerZone position="bottom" playerName="Joueur 2" />
      </div>
    </div>
  );
};

export default TrainingPage;
