import React from 'react';
import cardBack from '../../assets/cards/card_back.png';

export interface DealAnimState {
  from: { x: number; y: number };
  to: { x: number; y: number };
  toPlayer: 'top' | 'bottom';
  index: number;
  cardValue: number;
}

interface Props {
  state: DealAnimState | null;
  imageSrc?: string;
  durationMs?: number;
  noFlip?: boolean; // if true, do not rotateY (avoid mirrored/inverted look)
}

const FlyingCard: React.FC<Props> = ({ state, imageSrc, durationMs = 800, noFlip = false }) => {
  if (!state) return null;
  const { from, to } = state;
  const rY20 = noFlip ? '0deg' : '180deg';
  const rY80 = noFlip ? '0deg' : '540deg';
  const rY100 = noFlip ? '0deg' : '720deg';
  return (
    <div 
      className="absolute w-16 h-24 z-50"
      style={{
        left: `${from.x}px`,
        top: `${from.y}px`,
        transform: 'translate(-50%, -50%)',
        transformStyle: 'preserve-3d',
        pointerEvents: 'none',
        willChange: 'transform, left, top',
        transition: 'none',
      }}
    >
      <div 
        className="relative w-full h-full"
        style={{
          animation: `cardDeal ${durationMs}ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards`,
          transformOrigin: 'center',
          willChange: 'transform',
        }}
      >
        <style>{`
          @keyframes cardDeal {
            0% {
              transform: 
                translate(0, 0) 
                rotateY(0deg) 
                rotateZ(0deg) 
                scale(1);
              opacity: 1;
            }
            20% {
              transform: 
                translate(${(to.x - from.x) * 0.2}px, ${(to.y - from.y) * 0.2}px)
                rotateY(${rY20})
                rotateZ(5deg)
                scale(1.1);
              opacity: 1;
            }
            80% {
              transform: 
                translate(${(to.x - from.x) * 1.1}px, ${(to.y - from.y) * 1.1}px)
                rotateY(${rY80})
                rotateZ(-2deg)
                scale(0.95);
              opacity: 1;
            }
            100% {
              transform: 
                translate(${to.x - from.x}px, ${to.y - from.y}px)
                rotateY(${rY100})
                rotateZ(0deg)
                scale(1);
              opacity: 0;
            }
          }
        `}</style>
        <div 
          className="absolute w-full h-full rounded-lg shadow-xl overflow-hidden border-2 border-white"
          style={{
            transformStyle: 'preserve-3d',
            backfaceVisibility: 'hidden',
            transition: 'transform 0.3s ease-out',
          }}
        >
          <img
            src={imageSrc || cardBack}
            alt="Carte en vol"
            className="w-full h-full object-cover"
            style={{
              borderRadius: '6px',
              backfaceVisibility: 'hidden',
              transformStyle: 'preserve-3d',
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default FlyingCard;
