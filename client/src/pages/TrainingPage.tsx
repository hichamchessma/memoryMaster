import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface PlayerZoneProps {
  position: 'top' | 'bottom';
  playerName: string;
}

import cardBack from '../assets/cards/card_back.png';

interface PlayerZoneProps {
  position: 'top' | 'bottom';
  playerName: string;
  cardsDealt: number;
}

const PlayerZone: React.FC<PlayerZoneProps> = ({ position, playerName, cardsDealt }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      {/* Board de 4 cartes face cachée */}
      {position === 'bottom' && cardsDealt > 0 && (
        <div className="flex flex-row items-center justify-center mb-2">
          {Array.from({ length: cardsDealt }).map((_, idx) => (
            <div
              key={idx}
              className="card-shine w-16 h-24 mx-2 rounded shadow-md border-2 border-gray-300 bg-white relative overflow-hidden flex items-center justify-center"
            >
              <img
                src={cardBack}
                alt="Carte cachée"
                className="w-full h-full object-cover rounded select-none pointer-events-none"
                draggable="false"
              />
            </div>
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
      {position === 'top' && cardsDealt > 0 && (
        <div className="flex flex-row items-center justify-center mt-2">
          {Array.from({ length: cardsDealt }).map((_, idx) => (
            <div
              key={idx}
              className="card-shine w-16 h-24 mx-2 rounded shadow-md border-2 border-gray-300 bg-white relative overflow-hidden flex items-center justify-center"
            >
              <img
                src={cardBack}
                alt="Carte cachée"
                className="w-full h-full object-cover rounded select-none pointer-events-none"
                draggable="false"
              />
            </div>
          ))}
        </div>
      )}
  </div>
  );
};

const TrainingPage: React.FC = () => {
  const navigate = useNavigate();
  const deckRef = React.useRef<HTMLDivElement>(null);
  const player1HandRef = React.useRef<HTMLDivElement>(null);
  const player2HandRef = React.useRef<HTMLDivElement>(null);

  const [isDealing, setIsDealing] = React.useState(false);
  const [cardsDealt, setCardsDealt] = React.useState(0);
  const [dealingCard, setDealingCard] = React.useState<{to: 'top'|'bottom', index: number}|null>(null);
  const TOTAL_CARDS = 4;
  const DEAL_DURATION = 2200; // ms (2.2s)
  const DEAL_PER_CARD = DEAL_DURATION / TOTAL_CARDS;

  // Pour stocker les positions deck/main (pour animation)
  const [dealAnim, setDealAnim] = React.useState<null | {
    from: {x: number, y: number},
    to: {x: number, y: number},
    toPlayer: 'top'|'bottom',
    index: number
  }>(null);

  // Lance la distribution stylée
  const handleStartNewGame = async () => {
    setIsDealing(true);
    setCardsDealt(0);
    for (let i = 0; i < TOTAL_CARDS; i++) {
      // alterne top/bottom
      const toPlayer = i % 2 === 0 ? 'top' : 'bottom';
      setDealingCard({to: toPlayer, index: i});
      // calcule positions deck/main
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          const deck = deckRef.current;
          const hand = (toPlayer === 'top' ? player1HandRef : player2HandRef).current;
          if (deck && hand) {
            const deckRect = deck.getBoundingClientRect();
            const handRect = hand.getBoundingClientRect();
            // On vise le centre de la main, décalé selon l’index
            const cardOffset = (i>>1) * 72; // 72px par carte
            const from = {x: deckRect.left + deckRect.width/2, y: deckRect.top + deckRect.height/2};
            const to = {
              x: handRect.left + handRect.width/2 + (toPlayer==='top'?-1:1)*cardOffset - 36,
              y: handRect.top + handRect.height/2
            };
            setDealAnim({from, to, toPlayer, index: i});
          }
          resolve();
        }, 10);
      });
      // Attend l’animation (600ms)
      await new Promise(res=>setTimeout(res, 600));
      setDealAnim(null);
      setCardsDealt(prev => prev+1);
    }
    setDealingCard(null);
    setIsDealing(false);
  };

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

  // Carte animée en vol (flyingCard) avec rotation progressive
  const flyingCard = dealAnim ? (
    <div 
      style={{
        position: 'fixed',
        left: dealAnim.from.x - 32, // -32px pour centrer (car width: 64px)
        top: dealAnim.from.y - 48,  // -48px pour centrer (car height: 96px)
        zIndex: 1000,
        pointerEvents: 'none',
        transform: `translate(0, 0)`
      }}
    >
      <div 
        style={{
          width: '64px',
          height: '96px',
          borderRadius: '8px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          animation: `cardDeal 0.6s cubic-bezier(.6,-0.28,.74,.05) forwards`,
          transformOrigin: 'center',
          position: 'absolute',
          top: 0,
          left: 0
        }}
      >
        <style>
          {`
            @keyframes cardDeal {
              0% {
                transform: translate(0, 0) rotateY(0deg);
              }
              100% {
                transform: translate(
                  ${dealAnim.to.x - dealAnim.from.x}px, 
                  ${dealAnim.to.y - dealAnim.from.y}px
                ) rotateY(720deg);
              }
            }
          `}
        </style>
        <img
          src={cardBack}
          alt="Carte en vol"
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '8px',
            objectFit: 'cover',
            backfaceVisibility: 'hidden',
            transformStyle: 'preserve-3d',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
          }}
        />
      </div>
    </div>
  ) : null;

  return (
    <div
      className="h-screen w-full bg-cover bg-center homepage-bg grid grid-rows-[min-content_minmax(40px,0.9fr)_1.7fr_minmax(40px,0.9fr)] text-gray-200 overflow-hidden relative"
    >
      {flyingCard}
      {/* Bouton Start a new game en haut à gauche */}
      <button
        className="absolute top-3 left-3 z-30 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-lg px-4 py-2 flex items-center justify-center text-base font-bold border-2 border-white focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-60 disabled:cursor-not-allowed"
        title="Start a new game"
        onClick={handleStartNewGame}
        disabled={isDealing}
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
        <div ref={player1HandRef} style={{minHeight: 0}}>
          <PlayerZone position="top" playerName="Joueur 1" cardsDealt={cardsDealt} />
        </div>
      </div>
      {/* Plateau (milieu) : deck à gauche, pile à droite, centre vide */}
      <div className="row-start-3 row-end-4 flex justify-start items-center relative min-h-[140px]">
        {/* Deck à gauche */}
        <div className="flex flex-col items-center ml-6">
          <div ref={deckRef} className="w-24 h-36 bg-blue-800 border-4 border-white rounded-xl shadow-xl flex flex-col items-center justify-center mb-2 relative">
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
        <div ref={player2HandRef} style={{minHeight: 0}}>
          <PlayerZone position="bottom" playerName="Joueur 2" cardsDealt={cardsDealt} />
        </div>
      </div>
    </div>
  );
};

export default TrainingPage;
