import React from 'react';

export type Scores = { player1: number; player2: number };

interface Props {
  visible: boolean;
  scores: Scores;
  onClose: () => void;
  onStartNextGame: () => void;
}

const ScoreboardModal: React.FC<Props> = ({ visible, scores, onClose, onStartNextGame }) => {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 w-[90%] max-w-md rounded-2xl bg-white shadow-2xl border-4 border-gray-900 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-3 flex items-center justify-between">
          <div className="font-extrabold text-lg tracking-wide">Tableau des scores</div>
          <button
            className="rounded-full bg-white/20 hover:bg-white/30 text-white w-8 h-8 flex items-center justify-center font-bold"
            onClick={onClose}
            title="Fermer"
          >
            ×
          </button>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="rounded-xl border-2 border-gray-300 p-4">
              <div className="text-sm text-gray-500 mb-1">Joueur 1</div>
              <div className="text-3xl font-extrabold text-gray-900">{scores.player1}</div>
            </div>
            <div className="rounded-xl border-2 border-gray-300 p-4">
              <div className="text-sm text-gray-500 mb-1">Joueur 2</div>
              <div className="text-3xl font-extrabold text-gray-900">{scores.player2}</div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              className="bg-green-600 hover:bg-green-700 text-white rounded-lg shadow px-4 py-2 font-bold border-2 border-white"
              onClick={onStartNextGame}
              title="Start Next Game"
            >
              ▶️ Start Next Game
            </button>
            <button
              className="bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg shadow px-4 py-2 font-semibold border border-gray-300"
              onClick={onClose}
            >
              Fermer
            </button>
          </div>

          <div className="mt-4 text-xs text-gray-500 text-center">
            Calcul des scores provisoire. Les règles exactes seront appliquées plus tard.
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScoreboardModal;
