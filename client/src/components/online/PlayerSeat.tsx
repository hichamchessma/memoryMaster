import React from 'react';

export type OnlinePlayer = {
  _id: string;
  firstName: string;
  lastName: string;
  score?: number;
  cardsCount: number;
  isEliminated?: boolean;
};

type PlayerSeatProps = {
  player: OnlinePlayer;
  isActive?: boolean;
  isYou?: boolean;
  positionLabel?: string;
};

const PlayerSeat: React.FC<PlayerSeatProps> = ({ player, isActive, isYou, positionLabel }) => {
  return (
    <div
      className={[
        'min-w-[180px] max-w-[220px] select-none',
        'rounded-xl border backdrop-blur bg-black/35',
        isActive ? 'border-emerald-400/70 shadow-[0_0_0_2px_rgba(16,185,129,0.25)]' : 'border-white/20',
      ].join(' ')}
    >
      <div className="flex items-center gap-3 px-3 pt-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${isYou ? 'bg-emerald-500/80' : 'bg-white/20'}`}>
          {player.firstName?.[0] ?? '?'}
        </div>
        <div className="leading-tight">
          <div className="font-semibold text-sm">
            {player.firstName} {player.lastName}
            {isYou && <span className="ml-2 text-xs text-emerald-300">(vous)</span>}
          </div>
          <div className="text-[11px] opacity-70">
            {positionLabel ? positionLabel + ' • ' : ''}
            Cartes: {player.cardsCount}
            {typeof player.score === 'number' && <span> • Score: {player.score}</span>}
          </div>
        </div>
      </div>
      {player.isEliminated && (
        <div className="px-3 pb-2 pt-1 text-[11px] text-red-300">Éliminé</div>
      )}
      <div className="h-2 rounded-b-xl overflow-hidden">
        <div className={`${isActive ? 'bg-emerald-400' : 'bg-white/15'} h-full`} />
      </div>
    </div>
  );
};

export default PlayerSeat;
