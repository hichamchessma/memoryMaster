
export function PenaltyCueOverlay({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
      <style>{`
        @keyframes refShake { 0%,100%{ transform: translateX(0) } 20%{ transform: translateX(-6px) } 40%{ transform: translateX(6px) } 60%{ transform: translateX(-4px) } 80%{ transform: translateX(4px) } }
        @keyframes refFlash { 0%,100%{ opacity: 0.9 } 50%{ opacity: 1 } }
        @keyframes rays { 0%{ transform: scale(0.8); opacity: .2 } 100%{ transform: scale(1.2); opacity: 0 } }
      `}</style>
      <div className="relative">
        <div className="absolute -inset-6 rounded-full bg-yellow-400/30 blur-xl" style={{ animation: 'refFlash 1s ease-in-out 2' }} />
        <div className="absolute -inset-10 rounded-full border-2 border-yellow-300/60" style={{ animation: 'rays 1.2s ease-out 2' }} />
        <div className="relative px-6 py-4 rounded-2xl bg-black/80 border-4 border-yellow-400 shadow-2xl text-center" style={{ animation: 'refShake 0.6s ease-in-out 2' }}>
          <div className="text-4xl">🚨🟨</div>
          <div className="mt-1 text-xl font-extrabold text-yellow-200 tracking-wide uppercase">Pénalité !</div>
        </div>
      </div>
    </div>
  );
}

export function PenaltyDimOverlay({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center pointer-events-auto"
      style={{
        background:
          'radial-gradient(ellipse at center, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.85) 60%, rgba(0,0,0,0.95) 100%)',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-15"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 2px, transparent 3px, transparent 6px)',
        }}
      />
    </div>
  );
}

export function KingPowerCueOverlay({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="relative px-6 py-4 rounded-2xl bg-indigo-700/90 border-4 border-yellow-300 shadow-2xl text-center animate-pulse">
        <div className="text-4xl">⚡️👑</div>
        <div className="mt-1 text-xl font-extrabold text-yellow-200 tracking-wide uppercase">Pouvoir du Roi activé</div>
      </div>
    </div>
  );
}

export function QueenPowerCueOverlay({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="relative px-6 py-4 rounded-2xl bg-purple-700/90 border-4 border-pink-300 shadow-2xl text-center animate-pulse">
        <div className="text-4xl">✨👸</div>
        <div className="mt-1 text-xl font-extrabold text-pink-200 tracking-wide uppercase">Pouvoir de la Dame activé</div>
      </div>
    </div>
  );
}

export function JackPowerCueOverlay({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="relative px-6 py-4 rounded-2xl bg-blue-700/90 border-4 border-cyan-300 shadow-2xl text-center animate-pulse">
        <div className="text-4xl">💡🤵</div>
        <div className="mt-1 text-xl font-extrabold text-cyan-200 tracking-wide uppercase">Pouvoir du Valet activé</div>
      </div>
    </div>
  );
}

export function QuickDiscardFlashOverlay({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="px-6 py-3 rounded-2xl bg-red-600/90 text-white text-2xl font-extrabold uppercase shadow-2xl border-4 border-white animate-pulse">
        {message}
      </div>
    </div>
  );
}

export function ShowTimePromptOverlay({
  open,
  canCancel,
  onShowTime,
  onCancel,
}: {
  open: boolean;
  canCancel: boolean;
  onShowTime: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative z-10 px-6 py-5 rounded-2xl bg-yellow-400 text-gray-900 border-4 border-white shadow-2xl text-center w-[min(90%,420px)]">
        <div className="text-4xl mb-2">🎬</div>
        <div className="text-xl font-extrabold mb-3">ShowTime déclenché par Bombom</div>
        {canCancel ? (
          <div className="space-y-2">
            <button onClick={onShowTime} className="w-full bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-semibold shadow border-2 border-white">Lancer ShowTime</button>
            <button onClick={onCancel} className="w-full bg-gray-800 hover:bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-semibold shadow border-2 border-white">Annuler Bombom (une seule fois)</button>
          </div>
        ) : (
          <div className="space-y-2">
            <button onClick={onShowTime} className="w-full bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-semibold shadow border-2 border-white">Lancer ShowTime</button>
            <div className="text-sm mt-2">Annulation déjà utilisée. ShowTime est obligatoire.</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function VictoryOverlay({
  show,
  winner,
  amIPlayer1,
}: {
  show: boolean;
  winner: 'player1' | 'player2' | null;
  amIPlayer1: boolean | null;
}) {
  if (!show || !winner) return null;
  const didIWin = (winner === 'player1' && amIPlayer1) || (winner === 'player2' && !amIPlayer1);
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative z-10 px-8 py-6 rounded-2xl bg-yellow-400 text-gray-900 border-4 border-white shadow-2xl text-center">
        <div className="text-5xl mb-2">{didIWin ? '🏆' : '😢'}</div>
        <div className="text-2xl font-extrabold">
          {didIWin ? 'Tu as gagné cette manche !' : 'Tu as perdu cette manche !'}
        </div>
      </div>
    </div>
  );
}


