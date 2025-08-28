import React from 'react';
import TopBanner from '../training/TopBanner';
import PlayerZone from '../training/PlayerZone';
import PrepOverlay from '../training/PrepOverlay';
// Note: advanced animations and card utils are not used in this minimal online 2P table

// Minimal CardState compatible with training PlayerZone
interface CardState { id: string; value: number; isFlipped: boolean; updated?: number }

type GamePhase = 'preparation' | 'before_round' | 'player1_turn' | 'player2_turn';

type TwoPlayerOnlineTableProps = {
  playerTopName?: string;
  playerBottomName?: string;
};

const TwoPlayerOnlineTable: React.FC<TwoPlayerOnlineTableProps> = ({
  playerTopName = 'Joueur 1',
  playerBottomName = 'Joueur 2',
}) => {
  // Refs for animations/positions
  const deckRef = React.useRef<HTMLDivElement>(null);
  const discardRef = React.useRef<HTMLDivElement>(null);

  // Core local state to mirror Training flow (simplified)
  const [deck, setDeck] = React.useState<number[]>([]);
  // const [discardPile, setDiscardPile] = React.useState<number | null>(null);
  const [playerTopCards, setPlayerTopCards] = React.useState<CardState[]>([]);
  const [playerBottomCards, setPlayerBottomCards] = React.useState<CardState[]>([]);
  const [cardsDealt, setCardsDealt] = React.useState(0);
  const [gamePhase, setGamePhase] = React.useState<GamePhase>('preparation');
  const [currentPlayer, setCurrentPlayer] = React.useState<'player1' | 'player2'>('player1');
  const [timeLeft, setTimeLeft] = React.useState<number>(15);
  const [showPrepOverlay, setShowPrepOverlay] = React.useState(false);

  // Minimal drawn card animation support
  // Placeholder for future drawn card animation integration with sockets

  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  const beforeRoundTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Initialize deck and empty hands
  React.useEffect(() => {
    initializeDeck();
  }, []);

  const initializeDeck = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (beforeRoundTimerRef.current) { clearInterval(beforeRoundTimerRef.current); beforeRoundTimerRef.current = null; }

    const initialCards: CardState[] = Array(4).fill(null).map((_, i) => ({
      id: `card-${i}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      value: -1,
      isFlipped: false,
    }));

    const base = [...Array(52).keys(), ...Array(52).keys()];
    const jokers = [104,105,106,107,108,109,110,111,112,113,114,115];
    const newDeck = [...base, ...jokers].sort(() => Math.random() - 0.5);

    // remove 8 for initial deal later
    const initialDeck = newDeck.slice(8);

    setDeck(initialDeck);
    setPlayerTopCards([...initialCards]);
    setPlayerBottomCards([...initialCards]);
    setCardsDealt(0);
    setCurrentPlayer('player1');
    setTimeLeft(15);
    setGamePhase('preparation');
    setShowPrepOverlay(false);
  };

  // Deal animation placeholder to match Training visuals (no real flying yet)
  React.useEffect(() => {
    // Simulate quick dealing to fill 4 slots face up for memorization
    const idsTop = [...playerTopCards];
    const idsBottom = [...playerBottomCards];
    if (idsTop.length === 4 && idsBottom.length === 4 && cardsDealt === 0 && gamePhase === 'preparation') {
      const t = setTimeout(() => {
        // assign random values and flip up for the 5s memorization
        const d = [...deck];
        const drawCard = () => d.pop() ?? 0;
        const topFilled = idsTop.map(c => ({ ...c, value: drawCard(), isFlipped: true }));
        const bottomFilled = idsBottom.map(c => ({ ...c, value: drawCard(), isFlipped: true }));
        setDeck(d);
        setPlayerTopCards(topFilled);
        setPlayerBottomCards(bottomFilled);
        setCardsDealt(4);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [playerTopCards, playerBottomCards, cardsDealt, gamePhase, deck]);

  // After deal, run before_round 5s then start player1 turn 7s
  React.useEffect(() => {
    if (cardsDealt === 4 && gamePhase === 'preparation') {
      setGamePhase('before_round');
      setCurrentPlayer('player1');
      setShowPrepOverlay(true);
      const t = setTimeout(() => {
        setShowPrepOverlay(false);
        // 5s memorization
        setTimeLeft(5);
        beforeRoundTimerRef.current = setInterval(() => {
          setTimeLeft(prev => {
            if (prev <= 1) {
              clearInterval(beforeRoundTimerRef.current!);
              // flip all face down and start turns
              setPlayerTopCards(prevTop => prevTop.map(c => ({ ...c, isFlipped: false })));
              setPlayerBottomCards(prevBot => prevBot.map(c => ({ ...c, isFlipped: false })));
              setGamePhase('player1_turn');
              setCurrentPlayer('player1');
              startTurnTimer('player1');
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [cardsDealt, gamePhase]);

  const startTurnTimer = (who: 'player1' | 'player2') => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(7);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          // end turn switch
          const next = who === 'player1' ? 'player2' : 'player1';
          setCurrentPlayer(next);
          setGamePhase(next === 'player1' ? 'player1_turn' : 'player2_turn');
          startTurnTimer(next);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Center board (deck/discard)
  const centerBoard = (
    <div className="relative">
      <div className="flex items-center gap-6">
        <div ref={deckRef} className="w-[84px] h-[120px] rounded-xl border border-white/30 bg-white/10 backdrop-blur shadow-md" />
        <div ref={discardRef} className="w-[84px] h-[120px] rounded-xl border border-white/30 bg-white/10 backdrop-blur shadow-md" />
      </div>
    </div>
  );

  return (
    <div
      className="h-screen w-full bg-cover bg-center homepage-bg grid grid-rows-[min-content_minmax(40px,1fr)_1.7fr_minmax(40px,1fr)] text-gray-200 overflow-hidden relative"
    >
      {/* Overlays kept minimal for parity */}
      <PrepOverlay show={showPrepOverlay} />
      <TopBanner gamePhase={gamePhase} currentPlayer={currentPlayer} timeLeft={timeLeft} />

      {/* Top player */}
      <div className="row-start-2 row-end-3 flex items-end justify-center min-h-[40px]">
        <div>
          <PlayerZone
            position="top"
            playerName={playerTopName}
            cardsDealt={cardsDealt}
            cards={playerTopCards}
            highlight={gamePhase === 'player1_turn'}
          />
        </div>
      </div>

      {/* Center board */}
      <div className="row-start-3 row-end-4 flex items-center justify-center">
        {centerBoard}
      </div>

      {/* Bottom player */}
      <div className="row-start-4 row-end-5 flex items-start justify-center min-h-[40px]">
        <div>
          <PlayerZone
            position="bottom"
            playerName={playerBottomName}
            cardsDealt={cardsDealt}
            cards={playerBottomCards}
            highlight={gamePhase === 'player2_turn'}
          />
        </div>
      </div>
    </div>
  );
};

export default TwoPlayerOnlineTable;
