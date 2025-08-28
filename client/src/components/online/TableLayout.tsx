import React from 'react';
import PlayerSeat, { type OnlinePlayer } from './PlayerSeat';

export type TableLayoutProps = {
  players: OnlinePlayer[]; // in turn order
  youId: string;
  currentPlayerIndex?: number;
};

function rotateToYou(players: OnlinePlayer[], youId: string): OnlinePlayer[] {
  const idx = Math.max(0, players.findIndex(p => p._id === youId));
  if (idx <= 0) return players;
  return [...players.slice(idx), ...players.slice(0, idx)];
}

const TableLayout: React.FC<TableLayoutProps> = ({ players, youId, currentPlayerIndex }) => {
  const rotated = React.useMemo(() => rotateToYou(players, youId), [players, youId]);
  const count = rotated.length;

  // map active flag relative to rotation
  const activeId = (typeof currentPlayerIndex === 'number' && players[currentPlayerIndex]) ? players[currentPlayerIndex]._id : undefined;

  // positions: indexes in rotated array correspond to places around the table
  // 2: [bottom, top]
  // 3: [bottom, top-left, top-right]
  // 4: [bottom, right, top, left]

  const seat = (p: OnlinePlayer | undefined, opts: { posLabel: string; extraClass?: string; isBottom?: boolean }) => (
    <div className={opts.extraClass ?? ''}>
      {p && (
        <PlayerSeat
          player={p}
          isActive={activeId === p._id}
          isYou={p._id === youId}
          positionLabel={opts.posLabel}
        />
      )}
    </div>
  );

  return (
    <div className="relative w-full min-h-[520px]">
      {/* Center board placeholder */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[260px] h-[160px] rounded-2xl border border-white/20 bg-white/10 backdrop-blur flex items-center justify-center text-sm opacity-80">
        Plateau
      </div>

      {count === 2 && (
        <>
          <div className="absolute left-1/2 -translate-x-1/2 bottom-2">{seat(rotated[0], { posLabel: 'Vous', isBottom: true })}</div>
          <div className="absolute left-1/2 -translate-x-1/2 top-2">{seat(rotated[1], { posLabel: 'Adversaire' })}</div>
        </>
      )}

      {count === 3 && (
        <>
          <div className="absolute left-1/2 -translate-x-1/2 bottom-2">{seat(rotated[0], { posLabel: 'Vous', isBottom: true })}</div>
          <div className="absolute top-2 left-6">{seat(rotated[1], { posLabel: 'Adversaire' })}</div>
          <div className="absolute top-2 right-6">{seat(rotated[2], { posLabel: 'Adversaire' })}</div>
        </>
      )}

      {count === 4 && (
        <>
          <div className="absolute left-1/2 -translate-x-1/2 bottom-2">{seat(rotated[0], { posLabel: 'Vous', isBottom: true })}</div>
          <div className="absolute right-2 top-1/2 -translate-y-1/2">{seat(rotated[1], { posLabel: 'Adversaire' })}</div>
          <div className="absolute left-1/2 -translate-x-1/2 top-2">{seat(rotated[2], { posLabel: 'Adversaire' })}</div>
          <div className="absolute left-2 top-1/2 -translate-y-1/2">{seat(rotated[3], { posLabel: 'Adversaire' })}</div>
        </>
      )}
    </div>
  );
};

export default TableLayout;
