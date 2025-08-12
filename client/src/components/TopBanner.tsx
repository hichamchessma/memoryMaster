import React from 'react';

type GamePhase = 'preparation' | 'before_round' | 'player1_turn' | 'player2_turn';

interface Props {
  gamePhase: GamePhase;
}

const TopBanner: React.FC<Props> = ({ gamePhase }) => {
  return (
    <div className="absolute top-0 left-0 w-full flex items-center justify-center z-20" style={{margin:0,padding:0}}>
      <div className="flex items-center space-x-4">
        <span className="bg-yellow-400 bg-opacity-90 text-gray-900 px-4 py-1 rounded-xl shadow-xl text-xl font-extrabold tracking-widest border-2 border-white drop-shadow-lg uppercase">
          Mode Entraînement
        </span>
        {gamePhase !== 'preparation' && (
          <span className={`px-4 py-1 rounded-full text-white font-bold text-lg shadow-lg ${
            gamePhase === 'before_round' 
              ? 'bg-blue-500 animate-pulse' 
              : gamePhase === 'player1_turn' 
                ? 'bg-green-500' 
              : 'bg-red-500'
          }`}>
            {gamePhase === 'before_round' 
              ? 'Phase de mémorisation' 
              : gamePhase === 'player1_turn' 
                ? 'Tour du Joueur 1' 
              : 'Tour du Joueur 2'}
          </span>
        )}
      </div>
    </div>
  );
};

export default TopBanner;
