import React from 'react';
import PlayerSeat, { type OnlinePlayer } from './PlayerSeat';
import PlayerZone from '../training/PlayerZone';

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

  // helper to create face-down placeholders based on cardsCount (default 4)
  const makeFaceDown = (n?: number) => {
    const len = (typeof n === 'number' && n > 0) ? Math.min(12, n) : 4;
    return Array.from({ length: len }, (_, i) => ({ id: `ph-${i}`, value: 0, isFlipped: false }));
  };

  return (
    <div className="relative w-full h-[520px] md:h-[560px]">
      {/* Center board placeholder (deck / discard area style) */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="flex items-center gap-4">
          <div className="w-[84px] h-[120px] rounded-xl border border-white/30 bg-white/10 backdrop-blur shadow-md" />
          <div className="w-[84px] h-[120px] rounded-xl border border-white/30 bg-white/10 backdrop-blur shadow-md" />
        </div>
      </div>

      {count === 2 && (
        <>
          {/* Bottom: You */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-2 w-full max-w-3xl">
            <PlayerZone
              position="bottom"
              playerName={`${rotated[0]?.firstName ?? ''} ${rotated[0]?.lastName ?? ''}`.trim() || 'Vous'}
              cardsDealt={(rotated[0]?.cardsCount && rotated[0]?.cardsCount > 0) ? rotated[0]?.cardsCount : 4}
              cards={makeFaceDown(rotated[0]?.cardsCount)}
              highlight={activeId === rotated[0]?._id}
              onCardClick={() => {}}
            />
          </div>
          {/* Top: Opponent */}
          <div className="absolute left-1/2 -translate-x-1/2 top-2 w-full max-w-3xl">
            <PlayerZone
              position="top"
              playerName={`${rotated[1]?.firstName ?? ''} ${rotated[1]?.lastName ?? ''}`.trim() || 'Adversaire'}
              cardsDealt={(rotated[1]?.cardsCount && rotated[1]?.cardsCount > 0) ? rotated[1]?.cardsCount : 4}
              cards={makeFaceDown(rotated[1]?.cardsCount)}
              highlight={activeId === rotated[1]?._id}
              onCardClick={() => {}}
            />
          </div>
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
