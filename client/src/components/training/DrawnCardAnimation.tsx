import React from 'react';
import cardBack from '../../assets/cards/card_back.png';
import { getCardImage } from '../../utils/cards';

export interface DrawnCardAnimState {
  value: number;
  position: { x: number; y: number };
  isRevealed: boolean;
}

interface Props { state: DrawnCardAnimState | null }

const DrawnCardAnimation: React.FC<Props> = ({ state }) => {
  if (!state) return null;
  return (
    <div 
      className="fixed z-30 w-24 h-36 transition-all duration-500 ease-out"
      style={{
        left: `${state.position.x}px`,
        top: `${state.position.y}px`,
        transform: 'translate(-50%, -50%)',
        transformStyle: 'preserve-3d',
        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div 
        className="relative w-full h-full"
        style={{
          transform: state.isRevealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div 
          className="absolute w-full h-full rounded-lg shadow-2xl overflow-hidden border-2 border-white"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(0deg)',
            boxShadow: '0 0 30px rgba(255, 255, 0, 0.7)',
          }}
        >
          <img src={cardBack} alt="Dos de carte" className="w-full h-full object-cover" />
        </div>
        <div 
          className="absolute w-full h-full rounded-lg shadow-2xl overflow-hidden border-2 border-white"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            boxShadow: '0 0 30px rgba(0, 255, 255, 0.7)',
          }}
        >
          <img
            src={getCardImage(state.value)}
            alt="Carte piochée"
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = cardBack;
              target.alt = 'Dos de carte';
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default DrawnCardAnimation;
