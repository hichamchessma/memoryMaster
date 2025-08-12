import React from 'react';

interface Props { show: boolean }

const PrepOverlay: React.FC<Props> = ({ show }) => {
  if (!show) return null;
  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center"
      style={{
        background:
          'radial-gradient(ellipse at center, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.85) 60%, rgba(0,0,0,0.95) 100%)',
      }}
    >
      <style>{`
        @keyframes prepZoom {
          0% { transform: scale(0.7); opacity: 0; filter: brightness(0.8) saturate(1.2); }
          35% { transform: scale(1.08); opacity: 1; filter: brightness(1.1) saturate(1.4); }
          65% { transform: scale(1.14); opacity: 1; filter: brightness(1.15) saturate(1.5); }
          100% { transform: scale(1.28); opacity: 0; filter: brightness(0.9) saturate(1.2); }
        }
        @keyframes ringPulse {
          0% { box-shadow: 0 0 0 rgba(255,215,0,0); }
          30% { box-shadow: 0 0 30px rgba(255,215,0,0.45), inset 0 0 18px rgba(255,215,0,0.3); }
          70% { box-shadow: 0 0 38px rgba(255,215,0,0.5), inset 0 0 22px rgba(255,215,0,0.35); }
          100% { box-shadow: 0 0 0 rgba(255,215,0,0); }
        }
        @keyframes cornerBlink {
          0%, 100% { opacity: 0.35; filter: drop-shadow(0 0 4px rgba(255,255,255,0.25)); }
          50% { opacity: 1; filter: drop-shadow(0 0 8px rgba(255,255,255,0.6)); }
        }
        @keyframes textImpact {
          0% { letter-spacing: 0.05em; text-shadow: 0 0 0 rgba(0,0,0,0.0); }
          40% { letter-spacing: 0.25em; text-shadow: 0 8px 20px rgba(0,0,0,0.6); }
          100% { letter-spacing: 0.15em; text-shadow: 0 6px 16px rgba(0,0,0,0.5); }
        }
      `}</style>

      <div
        className="absolute inset-0 pointer-events-none opacity-15"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 2px, transparent 3px, transparent 6px)'
        }}
      />

      <div
        className="relative border-4 border-yellow-400 rounded-2xl px-10 py-8 text-center shadow-2xl bg-gradient-to-br from-gray-900/80 to-black/80"
        style={{ animation: 'prepZoom 2s ease-out forwards, ringPulse 2s ease-out' }}
      >
        <div className="pointer-events-none absolute -inset-3">
          <div className="absolute -top-3 -left-3 w-10 h-10 border-t-4 border-l-4 border-red-500" style={{animation: 'cornerBlink 1s ease-in-out infinite'}} />
          <div className="absolute -top-3 -right-3 w-10 h-10 border-t-4 border-r-4 border-blue-500" style={{animation: 'cornerBlink 1s ease-in-out infinite 0.2s'}} />
          <div className="absolute -bottom-3 -left-3 w-10 h-10 border-b-4 border-l-4 border-red-500" style={{animation: 'cornerBlink 1s ease-in-out infinite 0.4s'}} />
          <div className="absolute -bottom-3 -right-3 w-10 h-10 border-b-4 border-r-4 border-blue-500" style={{animation: 'cornerBlink 1s ease-in-out infinite 0.6s'}} />
        </div>

        <div
          className="text-4xl md:text-5xl font-extrabold uppercase text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-yellow-300 to-blue-500 drop-shadow-[0_6px_16px_rgba(0,0,0,0.5)]"
          style={{ animation: 'textImpact 1.2s ease-out' }}
        >
          Préparez‑vous !
        </div>
        <div className="mt-3 text-lg md:text-2xl text-yellow-200 font-bold tracking-wide">
          Mémorisez 2 cartes
        </div>
      </div>
    </div>
  );
};

export default PrepOverlay;
