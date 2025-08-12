import React from 'react';
import cardBack from '../../assets/cards/card_back.png';
import { getCardImage } from '../../utils/cards';

interface CardState {
  id: string;
  value: number; // -1 for empty
  isFlipped: boolean;
  updated?: number;
}

interface PlayerZoneProps {
  position: 'top' | 'bottom';
  playerName: string;
  cardsDealt: number;
  cards: CardState[];
  onCardClick?: (index: number) => void;
  highlight?: boolean;
}

const PlayerZone: React.FC<PlayerZoneProps> = ({ position, playerName, cardsDealt, cards = [], onCardClick = () => {}, highlight = false }) => {
  const validCards = cards.filter(card => card.value !== -1);

  const handleCardClick = (card: CardState) => {
    const originalIndex = cards.findIndex(c => c.id === card.id);
    if (originalIndex !== -1) {
      onCardClick(originalIndex);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <style>{`
        @keyframes blueGlow {
          0% { box-shadow: 0 0 0 0 rgba(56,189,248,0.0), 0 0 6px 2px rgba(56,189,248,0.55); }
          50% { box-shadow: 0 0 10px 2px rgba(56,189,248,0.9), 0 0 20px 6px rgba(56,189,248,0.6); }
          100% { box-shadow: 0 0 0 0 rgba(56,189,248,0.0), 0 0 6px 2px rgba(56,189,248,0.55); }
        }
        .card-blue-glow { animation: blueGlow 1.2s ease-in-out infinite; }
      `}</style>

      {position === 'bottom' && validCards.length > 0 && (
        <div className="flex flex-row flex-wrap items-center justify-center mb-2">
          {validCards.map((card, idx) => (
            <div
              key={`${card.id || idx}-${card.value}`}
              className={`card-shine w-16 h-24 mx-2 rounded shadow-md border-2 border-gray-300 bg-white relative overflow-hidden ${highlight ? 'ring-2 ring-sky-400 card-blue-glow' : ''}`}
              style={{
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: 'scale(1)',
                zIndex: 1,
                transformStyle: 'preserve-3d',
              }}
              onClick={() => handleCardClick(card)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.15) translateY(-10px)';
                e.currentTarget.style.zIndex = '20';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.zIndex = '1';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
              }}
            >
              <div 
                className="relative w-full h-full" 
                style={{
                  transformStyle: 'preserve-3d',
                  transition: 'transform 0.6s',
                  transform: card.isFlipped ? 'rotateY(180deg)' : 'rotateY(0)',
                  pointerEvents: 'none'
                }}
              >
                <div 
                  className="absolute w-full h-full" 
                  style={{
                    WebkitBackfaceVisibility: 'hidden',
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(0deg)'
                  }}
                >
                  <img
                    src={cardBack}
                    alt="Dos de carte"
                    className="w-full h-full object-cover rounded select-none"
                    draggable="false"
                  />
                </div>

                <div 
                  className="absolute w-full h-full" 
                  style={{
                    WebkitBackfaceVisibility: 'hidden',
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)'
                  }}
                >
                  <img
                    src={getCardImage(card.value)}
                    alt={`Carte ${card.value}`}
                    className="w-full h-full object-cover rounded select-none"
                    draggable="false"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = cardBack;
                      target.alt = 'Dos de carte';
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={`flex flex-col items-center ${position === 'bottom' ? 'mt-2' : 'mb-2'}`}>
        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-2xl">👤</div>
        <span className="text-sm font-medium mt-1">{playerName}</span>
      </div>

      {position === 'top' && validCards.length > 0 && (
        <div className="flex flex-row flex-wrap items-center justify-center mt-2">
          {validCards.map((card, idx) => (
            <div
              key={`${card.id || idx}-${card.value}`}
              className={`card-shine w-16 h-24 mx-2 rounded shadow-md border-2 border-gray-300 bg-white relative overflow-hidden ${highlight ? 'ring-2 ring-sky-400 card-blue-glow' : ''}`}
              style={{
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: 'scale(1)',
                zIndex: 1,
                transformStyle: 'preserve-3d',
              }}
              onClick={() => handleCardClick(card)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.15) translateY(-10px)';
                e.currentTarget.style.zIndex = '20';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.zIndex = '1';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
              }}
            >
              <div 
                className="relative w-full h-full" 
                style={{
                  transformStyle: 'preserve-3d',
                  transition: 'transform 0.6s',
                  transform: card.isFlipped ? 'rotateY(180deg)' : 'rotateY(0)',
                  pointerEvents: 'none'
                }}
              >
                <div 
                  className="absolute w-full h-full" 
                  style={{
                    WebkitBackfaceVisibility: 'hidden',
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(0deg)'
                  }}
                >
                  <img
                    src={cardBack}
                    alt="Dos de carte"
                    className="w-full h-full object-cover rounded select-none"
                    draggable="false"
                  />
                </div>

                <div 
                  className="absolute w-full h-full" 
                  style={{
                    WebkitBackfaceVisibility: 'hidden',
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)'
                  }}
                >
                  <img
                    src={getCardImage(card.value)}
                    alt={`Carte ${card.value}`}
                    className="w-full h-full object-cover rounded select-none"
                    draggable="false"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = cardBack;
                      target.alt = 'Dos de carte';
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlayerZone;
