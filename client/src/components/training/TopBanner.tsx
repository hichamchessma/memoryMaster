import React from 'react';

type GamePhase = 'preparation' | 'before_round' | 'player1_turn' | 'player2_turn';

interface Props {
  gamePhase: GamePhase;
  currentPlayer: 'player1' | 'player2';
  timeLeft: number;
}

const TopBanner: React.FC<Props> = ({ gamePhase, currentPlayer, timeLeft }) => {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="absolute top-0 left-0 w-full flex items-center justify-center z-40" style={{margin:0,padding:0}}>
      <div className="flex items-center space-x-4">
        <span className="bg-yellow-400 bg-opacity-90 text-gray-900 px-4 py-1 rounded-xl shadow-xl text-xl font-extrabold tracking-widest border-2 border-white drop-shadow-lg uppercase">
          Mode Entraînement
        </span>
        {gamePhase !== 'preparation' && (
          <div className="relative">
            <span
              className={`px-4 py-1 rounded-full text-white font-bold text-lg shadow-lg pr-16 ${
                gamePhase === 'before_round'
                  ? 'bg-blue-500 animate-pulse'
                  : gamePhase === 'player1_turn'
                    ? 'bg-green-500'
                    : 'bg-red-500'
              }`}
            >
              {gamePhase === 'before_round'
                ? 'Phase de mémorisation'
                : currentPlayer === 'player1'
                  ? 'Tour du Joueur 1'
                  : 'Tour du Joueur 2'}
            </span>

            {/* Timer en haut à droite du badge */}
            <div className="absolute -top-3 -right-3">
              <div className="flex items-center gap-1 bg-black/80 text-yellow-300 px-2 py-1 rounded-full shadow-2xl border border-yellow-400 backdrop-blur-sm">
                <span className="text-lg leading-none">⏱️</span>
                <span className="font-extrabold tabular-nums tracking-wider drop-shadow-md">
                  {formatTime(timeLeft)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TopBanner;
