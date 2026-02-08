import React from 'react';
import PlayerZone from '../../components/training/PlayerZone';
import { getCardImage, getCardValue, isJoker } from '../../utils/cards';

export function MemorizationEndOverlay({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="px-8 py-4 rounded-2xl bg-green-600/90 text-white text-2xl font-extrabold uppercase shadow-2xl border-4 border-white animate-pulse">
        ✅ Mémorisation terminée !
      </div>
    </div>
  );
}

export function ReadyOrQuitButton({
  gameStarted,
  myReadyStatus,
  onToggleReady,
  onQuitClick,
}: {
  gameStarted: boolean;
  myReadyStatus: boolean;
  onToggleReady: () => void;
  onQuitClick: () => void;
}) {
  if (!gameStarted) {
    return (
      <button
        className={`absolute top-3 left-3 z-30 rounded-lg shadow-lg px-4 py-2 flex items-center justify-center text-base font-bold border-2 border-white focus:outline-none focus:ring-2 ${
          myReadyStatus
            ? 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-400'
            : 'bg-green-600 hover:bg-green-700 focus:ring-green-400'
        } text-white`}
        title={myReadyStatus ? "Cliquez pour annuler" : "Cliquez quand vous êtes prêt"}
        onClick={onToggleReady}
      >
        <span className="mr-2">{myReadyStatus ? '⏸️' : '✅'}</span>
        {myReadyStatus ? 'Not Ready' : 'Ready'}
      </button>
    );
  }

  return (
    <button
      className="absolute top-3 left-3 z-30 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-lg px-4 py-2 flex items-center justify-center text-base font-bold border-2 border-white focus:outline-none focus:ring-2 focus:ring-red-400"
      title="Quitter la partie"
      onClick={onQuitClick}
    >
      <span className="mr-2">🚪</span> Quit
    </button>
  );
}

export function QuitConfirmModal({
  show,
  onConfirm,
  onCancel,
}: {
  show: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!show) return null;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onCancel} />
      <div className="relative z-10 px-8 py-6 rounded-2xl bg-red-600 text-white border-4 border-white shadow-2xl text-center max-w-md">
        <div className="text-5xl mb-4">⚠️</div>
        <div className="text-2xl font-extrabold mb-4">Quitter la partie ?</div>
        <div className="text-base mb-6">
          Vous allez perdre automatiquement et votre adversaire gagnera par forfait.
        </div>
        <div className="flex gap-4 justify-center">
          <button
            onClick={onConfirm}
            className="bg-white text-red-600 px-6 py-2 rounded-lg font-bold hover:bg-gray-100"
          >
            Oui, quitter
          </button>
          <button
            onClick={onCancel}
            className="bg-gray-800 text-white px-6 py-2 rounded-lg font-bold hover:bg-gray-700"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

type ForcedNextDraw =
  | { kind: 'rank'; rank: number }
  | { kind: 'joker'; type: 1 | 2 }
  | null;

export function TopRightControls({
  isPowerfulMode,
  onTogglePowerfulMode,
  onRevealAll,
  showForceMenu,
  onToggleForceMenu,
  forcedNextDraw,
  onSelectForceLabel,
  onClearForced,
  onOpenScoreboard,
  onNavigateDashboard,
}: {
  isPowerfulMode: boolean;
  onTogglePowerfulMode: () => void;
  onRevealAll: () => void;
  showForceMenu: boolean;
  onToggleForceMenu: () => void;
  forcedNextDraw: ForcedNextDraw;
  onSelectForceLabel: (label: string) => void;
  onClearForced: () => void;
  onOpenScoreboard: () => void;
  onNavigateDashboard: () => void;
}) {
  const labels = ['A','2','3','4','5','6','7','8','9','10','J','Q','K','Jok1','Jok2'];
  const isSelected = (lbl: string) => {
    if (!forcedNextDraw) return false;
    if (forcedNextDraw.kind === 'joker') {
      return (forcedNextDraw.type === 1 && lbl === 'Jok1') || (forcedNextDraw.type === 2 && lbl === 'Jok2');
    }
    const rankLabel = forcedNextDraw.rank === 0
      ? 'A'
      : forcedNextDraw.rank >= 1 && forcedNextDraw.rank <= 8
        ? String(forcedNextDraw.rank + 1)
        : forcedNextDraw.rank === 9
          ? '10'
          : forcedNextDraw.rank === 10
            ? 'J'
            : forcedNextDraw.rank === 11
              ? 'Q'
              : 'K';
    return lbl === rankLabel;
  };

  const forcedLabel = forcedNextDraw
    ? (forcedNextDraw.kind === 'rank'
      ? (forcedNextDraw.rank === 0 ? 'A' : forcedNextDraw.rank >= 1 && forcedNextDraw.rank <= 8 ? String(forcedNextDraw.rank + 1) : forcedNextDraw.rank === 9 ? '10' : forcedNextDraw.rank === 10 ? 'J' : forcedNextDraw.rank === 11 ? 'Q' : 'K')
      : (forcedNextDraw.type === 1 ? 'Jok1' : 'Jok2'))
    : null;

  return (
    <div className="absolute top-3 right-3 z-30 flex space-x-2">
      <button
        className="bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg w-12 h-12 flex items-center justify-center text-2xl border-2 border-white focus:outline-none focus:ring-2 focus:ring-purple-400"
        title="Afficher les cartes (2s)"
        onClick={onRevealAll}
      >
        <span role="img" aria-label="Voir les cartes">👁️</span>
      </button>
      <button
        className={`${isPowerfulMode ? 'bg-red-600 hover:bg-red-700 focus:ring-red-400' : 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-400'} text-white rounded-full shadow-lg w-12 h-12 flex items-center justify-center text-2xl border-2 border-white focus:outline-none focus:ring-2`}
        title={isPowerfulMode ? 'Désactiver Powerful mode' : 'Activer Powerful mode'}
        onClick={onTogglePowerfulMode}
      >
        <span role="img" aria-label="Powerful">⚡</span>
      </button>
      <div className="relative">
        <button
          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg w-12 h-12 flex items-center justify-center text-2xl border-2 border-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
          title="Forcer la prochaine pioche"
          onClick={onToggleForceMenu}
        >
          <span role="img" aria-label="Force Draw">🎯</span>
        </button>
        {showForceMenu && (
          <div className="absolute right-0 mt-2 bg-black/80 text-white rounded-xl shadow-2xl border border-white/20 p-3 w-52">
            <div className="text-xs mb-2 opacity-80">Choisir la prochaine carte</div>
            <div className="grid grid-cols-4 gap-2 text-sm">
              {labels.map(lbl => (
                <button
                  key={lbl}
                  className={`px-2 py-1 rounded-md border border-white/30 hover:bg-white/10 ${isSelected(lbl) ? 'bg-white/10' : ''}`}
                  onClick={() => onSelectForceLabel(lbl)}
                >
                  {lbl}
                </button>
              ))}
            </div>
            {forcedLabel && (
              <div className="mt-3 text-xs opacity-80 flex items-center justify-between">
                <span>Forcé: {forcedLabel}</span>
                <button className="underline" onClick={onClearForced}>Effacer</button>
              </div>
            )}
          </div>
        )}
      </div>
      <button
        className="bg-amber-600 hover:bg-amber-700 text-white rounded-full shadow-lg w-12 h-12 flex items-center justify-center text-2xl border-2 border-white focus:outline-none focus:ring-2 focus:ring-amber-400"
        title="Voir le tableau des scores"
        onClick={onOpenScoreboard}
      >
        <span role="img" aria-label="Scores">📊</span>
      </button>
      <button
        className="bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg w-12 h-12 flex items-center justify-center text-2xl border-2 border-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        title="Retour au Dashboard"
        onClick={onNavigateDashboard}
      >
        <span role="img" aria-label="Dashboard">🏠</span>
      </button>
    </div>
  );
}

export function TopPlayerRow({
  player1HandRef,
  isInPenalty,
  penaltyPlayer,
  isPlayerActive,
  activePlayerStyle,
  inactivePlayerStyle,
  opponentName,
  cardsDealt,
  player1Cards,
  onCardClick,
  highlight,
}: {
  player1HandRef: React.RefObject<HTMLDivElement | null>;
  isInPenalty: boolean;
  penaltyPlayer: 'player1' | 'player2' | null;
  isPlayerActive: (player: 'player1' | 'player2') => boolean;
  activePlayerStyle: React.CSSProperties;
  inactivePlayerStyle: React.CSSProperties;
  opponentName: string;
  cardsDealt: number;
  player1Cards: any[];
  onCardClick: (index: number) => void;
  highlight: boolean;
}) {
  return (
    <div className={`row-start-2 row-end-3 flex items-end justify-center min-h-[40px] ${isInPenalty && penaltyPlayer === 'player1' ? 'relative z-50' : ''}` }>
      <div ref={player1HandRef} style={{minHeight: 0}}>
        <div style={isPlayerActive('player1') ? activePlayerStyle : inactivePlayerStyle}>
          <PlayerZone 
            position="top" 
            playerName={opponentName} 
            cardsDealt={cardsDealt} 
            cards={player1Cards}
            onCardClick={onCardClick}
            highlight={highlight}
          />
          <div className="mt-2 flex items-center justify-center gap-2">
            {/* Le message Bombom activé ne doit pas apparaître en haut */}
          </div>
        </div>
      </div>
    </div>
  );
}

export function BottomPlayerRow({
  player2HandRef,
  isInPenalty,
  penaltyPlayer,
  isPlayerActive,
  activePlayerStyle,
  inactivePlayerStyle,
  myName,
  cardsDealt,
  player2Cards,
  onCardClick,
  highlight,
  isPlayerTurn,
  bombomDeclaredBy,
  drawnCard,
  selectingCardToReplace,
  amIPlayer1,
  onDeclareBombom,
}: {
  player2HandRef: React.RefObject<HTMLDivElement | null>;
  isInPenalty: boolean;
  penaltyPlayer: 'player1' | 'player2' | null;
  isPlayerActive: (player: 'player1' | 'player2') => boolean;
  activePlayerStyle: React.CSSProperties;
  inactivePlayerStyle: React.CSSProperties;
  myName: string;
  cardsDealt: number;
  player2Cards: any[];
  onCardClick: (index: number) => void;
  highlight: boolean;
  isPlayerTurn: boolean;
  bombomDeclaredBy: 'player1' | 'player2' | null;
  drawnCard: { value: number; isFlipped: boolean } | null;
  selectingCardToReplace: boolean;
  amIPlayer1: boolean | null;
  onDeclareBombom: (player: 'player1' | 'player2') => void;
}) {
  return (
    <div className={`row-start-4 row-end-5 flex items-start justify-center min-h-[60px] ${isInPenalty && penaltyPlayer === 'player2' ? 'relative z-50' : ''}` }>
      <div ref={player2HandRef} style={{minHeight: 0}}>
        <div style={isPlayerActive('player2') ? activePlayerStyle : inactivePlayerStyle}>
          <PlayerZone 
            position="bottom" 
            playerName={myName} 
            cardsDealt={cardsDealt} 
            cards={player2Cards}
            onCardClick={onCardClick}
            highlight={highlight}
          />
          <div className="mt-2 flex items-center justify-center gap-2">
            {/* Afficher le bouton Bombom pour tous les joueurs, mais actif uniquement pour celui dont c'est le tour */}
            <button
              className={`px-3 py-1 rounded-full text-sm font-bold border-2 ${isPlayerTurn && bombomDeclaredBy === null ? 'bg-pink-600 hover:bg-pink-700 text-white' : 'bg-gray-400 text-gray-600 cursor-not-allowed'} border-white`}
              disabled={!isPlayerTurn || drawnCard !== null || selectingCardToReplace || isInPenalty || bombomDeclaredBy !== null}
              title={bombomDeclaredBy !== null ? 'Un Bombom est déjà activé' : isPlayerTurn ? 'Déclarer Bombom' : 'Vous ne pouvez pas déclarer Bombom pendant le tour de l\'adversaire'}
              onClick={() => onDeclareBombom(amIPlayer1 ? 'player1' : 'player2')}
            >
              🍬 Bombom
            </button>
            {bombomDeclaredBy !== null && (
              <span className="text-[11px] bg-yellow-300/90 text-black px-2 py-0.5 rounded-full border border-yellow-600">Bombom activé</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DrawnCardPanel({
  drawnCard,
  showCardActions,
  anyPowerActive,
  selectingCardToReplace,
  jackPowerUsedRef,
  setShowCardActions,
  setIsJackPowerActive,
  setAnyPowerActive,
  setJackCue,
  setIsQueenPowerActive,
  setQueenCue,
  setIsKingPowerActive,
  setKingPowerActivated,
  setKingSelections,
  setPowerCue,
  isKingPowerActive,
  kingPowerActivated,
  setDrawnCard,
  setSelectingCardToReplace,
  socket,
  tableData,
}: {
  drawnCard: { value: number; isFlipped: boolean } | null;
  showCardActions: boolean;
  anyPowerActive: boolean;
  selectingCardToReplace: boolean;
  jackPowerUsedRef: React.MutableRefObject<boolean>;
  setShowCardActions: React.Dispatch<React.SetStateAction<boolean>>;
  setIsJackPowerActive: React.Dispatch<React.SetStateAction<boolean>>;
  setAnyPowerActive: React.Dispatch<React.SetStateAction<boolean>>;
  setJackCue: React.Dispatch<React.SetStateAction<boolean>>;
  setIsQueenPowerActive: React.Dispatch<React.SetStateAction<boolean>>;
  setQueenCue: React.Dispatch<React.SetStateAction<boolean>>;
  setIsKingPowerActive: React.Dispatch<React.SetStateAction<boolean>>;
  setKingPowerActivated: React.Dispatch<React.SetStateAction<boolean>>;
  setKingSelections: React.Dispatch<React.SetStateAction<any[]>>;
  setPowerCue: React.Dispatch<React.SetStateAction<boolean>>;
  isKingPowerActive: boolean;
  kingPowerActivated: boolean;
  setDrawnCard: React.Dispatch<React.SetStateAction<any>>;
  setSelectingCardToReplace: React.Dispatch<React.SetStateAction<boolean>>;
  socket: any;
  tableData: any;
}) {
  if (!drawnCard || !showCardActions || anyPowerActive) return null;

  return (
    <div
      className="z-40 w-44 bg-black/45 backdrop-blur-md rounded-2xl px-4 py-3 shadow-2xl border border-white/20"
      style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        top: 'calc(100% + 4px)'
      }}
    >
      <div className="w-28 h-40 mx-auto mb-3 drop-shadow-2xl">
        <img
          src={getCardImage(drawnCard.value)}
          alt="Carte piochée"
          className="w-full h-full object-cover rounded-xl shadow-2xl ring-2 ring-white/70"
        />
      </div>
      <div className="flex flex-col space-y-2">
        {drawnCard && !isJoker(drawnCard.value) && getCardValue(drawnCard.value) === 10 && (
          <button
            onClick={() => {
              // Activer le mode pouvoir du Valet
              setShowCardActions(false);
              // Réinitialiser la référence pour permettre un nouveau clic
              jackPowerUsedRef.current = false;
              setIsJackPowerActive(true);
              setAnyPowerActive(true); // Marquer qu'un pouvoir est actif
              setJackCue(true);
              setTimeout(() => setJackCue(false), 900);
              
              // Notifier le serveur que le pouvoir est activé
              if (socket) {
                socket.emit('game:power_activated', {
                  tableId: tableData?.tableId,
                  userId: tableData?.currentUserId,
                  powerType: 'jack'
                });
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-semibold shadow"
          >
            Activer et défausser
          </button>
        )}
        {drawnCard && !isJoker(drawnCard.value) && getCardValue(drawnCard.value) === 11 && (
          <button
            onClick={() => {
              // Activer le mode pouvoir de la Dame
              setShowCardActions(false);
              setIsQueenPowerActive(true);
              setAnyPowerActive(true); // Marquer qu'un pouvoir est actif
              setQueenCue(true);
              setTimeout(() => setQueenCue(false), 900);
              
              // Notifier le serveur que le pouvoir est activé
              if (socket) {
                socket.emit('game:power_activated', {
                  tableId: tableData?.tableId,
                  userId: tableData?.currentUserId,
                  powerType: 'queen'
                });
              }
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm font-semibold shadow"
          >
            Activer et défausser
          </button>
        )}
        {drawnCard && !isJoker(drawnCard.value) && getCardValue(drawnCard.value) === 12 && !isKingPowerActive && !kingPowerActivated && (
          <button
            onClick={async () => {
              // Activer le mode pouvoir du Roi
              setShowCardActions(false);
              setIsKingPowerActive(true);
              setKingPowerActivated(true); // Marquer le pouvoir comme activé pour éviter la double activation
              setAnyPowerActive(true); // Marquer qu'un pouvoir est actif
              setKingSelections([]);
              setPowerCue(true);
              setTimeout(() => setPowerCue(false), 900);
              
              // Notifier le serveur que le pouvoir est activé
              if (socket) {
                socket.emit('game:power_activated', {
                  tableId: tableData?.tableId,
                  userId: tableData?.currentUserId,
                  powerType: 'king'
                });
              }
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm font-semibold shadow"
          >
            Activer et défausser
          </button>
        )}
        {drawnCard && ![10,11,12].includes(getCardValue(drawnCard.value)) && (
          <button
            onClick={async () => {
              if (drawnCard && socket) {
                console.log('🗑️ Discarding drawn card directly...');
                console.log('  → tableId:', tableData?.tableId);
                console.log('  → userId:', tableData?.currentUserId);
                console.log('  → cardIndex: -1');
                console.log('  → card:', drawnCard.value);
                
                // Émettre l'événement WebSocket pour défausser
                socket.emit('game:discard_card', {
                  tableId: tableData?.tableId,
                  userId: tableData?.currentUserId,
                  cardIndex: -1, // -1 = carte piochée (pas encore dans la main)
                  card: drawnCard.value
                });
                
                console.log('✅ game:discard_card emitted');
                
                // Nettoyer l'état local
                setDrawnCard(null);
                setShowCardActions(false);
              }
            }}
            className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-semibold shadow"
          >
            Défausser
          </button>
        )}
        <button
          onClick={() => {
            setShowCardActions(false);
            setSelectingCardToReplace(true);
          }}
          className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-semibold shadow"
        >
          Ajouter à ma main
        </button>
      </div>
      {selectingCardToReplace && (
        <div className="text-yellow-300 text-xs mt-2 bg-black/30 px-3 py-1 rounded-full text-center">
          Cliquez sur la carte à remplacer
        </div>
      )}
      {isKingPowerActive && (
        <div className="text-indigo-200 text-xs mt-2 bg-black/30 px-3 py-1 rounded-full text-center">
          Sélectionnez 2 cartes (toute la table)
        </div>
      )}
    </div>
  );
}

export function CenterBoard({
  deckRef,
  discardRef,
  isDeckGlowing,
  deckLength,
  onDeckClick,
  drawnCard,
  showCardActions,
  anyPowerActive,
  selectingCardToReplace,
  jackPowerUsedRef,
  setShowCardActions,
  setIsJackPowerActive,
  setAnyPowerActive,
  setJackCue,
  setIsQueenPowerActive,
  setQueenCue,
  setIsKingPowerActive,
  setKingPowerActivated,
  setKingSelections,
  setPowerCue,
  isKingPowerActive,
  kingPowerActivated,
  setDrawnCard,
  setSelectingCardToReplace,
  socket,
  tableData,
  isInPenalty,
  discardPile,
}: {
  deckRef: React.RefObject<HTMLDivElement | null>;
  discardRef: React.RefObject<HTMLDivElement | null>;
  isDeckGlowing: boolean;
  deckLength: number;
  onDeckClick: () => void;
  drawnCard: { value: number; isFlipped: boolean } | null;
  showCardActions: boolean;
  anyPowerActive: boolean;
  selectingCardToReplace: boolean;
  jackPowerUsedRef: React.MutableRefObject<boolean>;
  setShowCardActions: React.Dispatch<React.SetStateAction<boolean>>;
  setIsJackPowerActive: React.Dispatch<React.SetStateAction<boolean>>;
  setAnyPowerActive: React.Dispatch<React.SetStateAction<boolean>>;
  setJackCue: React.Dispatch<React.SetStateAction<boolean>>;
  setIsQueenPowerActive: React.Dispatch<React.SetStateAction<boolean>>;
  setQueenCue: React.Dispatch<React.SetStateAction<boolean>>;
  setIsKingPowerActive: React.Dispatch<React.SetStateAction<boolean>>;
  setKingPowerActivated: React.Dispatch<React.SetStateAction<boolean>>;
  setKingSelections: React.Dispatch<React.SetStateAction<any[]>>;
  setPowerCue: React.Dispatch<React.SetStateAction<boolean>>;
  isKingPowerActive: boolean;
  kingPowerActivated: boolean;
  setDrawnCard: React.Dispatch<React.SetStateAction<any>>;
  setSelectingCardToReplace: React.Dispatch<React.SetStateAction<boolean>>;
  socket: any;
  tableData: any;
  isInPenalty: boolean;
  discardPile: number | null;
}) {
  return (
    <div className="row-start-3 row-end-4 flex justify-between items-center relative min-h-[240px] px-6 gap-6">
      {/* Deck à gauche */}
      <div className="flex flex-col items-center ml-6 -mt-6">
        <div 
          ref={deckRef} 
          className={`w-24 h-36 bg-blue-800 border-4 border-white rounded-xl shadow-xl flex flex-col items-center justify-center mb-2 relative cursor-pointer hover:border-blue-300 transition-all duration-500 ${
            isDeckGlowing ? 'ring-4 ring-yellow-400 ring-opacity-80' : ''
          }`}
          style={{
            boxShadow: isDeckGlowing ? '0 0 30px rgba(255, 255, 0, 0.7)' : '0 4px 8px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.3s ease-in-out',
          }}
          onClick={onDeckClick}
          >
            <span className="absolute -top-3 left-2 bg-yellow-400 text-gray-900 font-bold px-2 py-1 rounded-full text-xs shadow">Cartes</span>
            <span className="text-3xl">🂠</span>
            <span className="mt-2 text-sm font-bold">Piocher</span>
            <div className="absolute bottom-2 text-xs text-gray-200">{deckLength} cartes</div>
            <DrawnCardPanel
              drawnCard={drawnCard}
              showCardActions={showCardActions}
              anyPowerActive={anyPowerActive}
              selectingCardToReplace={selectingCardToReplace}
              jackPowerUsedRef={jackPowerUsedRef}
              setShowCardActions={setShowCardActions}
              setIsJackPowerActive={setIsJackPowerActive}
              setAnyPowerActive={setAnyPowerActive}
              setJackCue={setJackCue}
              setIsQueenPowerActive={setIsQueenPowerActive}
              setQueenCue={setQueenCue}
              setIsKingPowerActive={setIsKingPowerActive}
              setKingPowerActivated={setKingPowerActivated}
              setKingSelections={setKingSelections}
              setPowerCue={setPowerCue}
              isKingPowerActive={isKingPowerActive}
              kingPowerActivated={kingPowerActivated}
              setDrawnCard={setDrawnCard}
              setSelectingCardToReplace={setSelectingCardToReplace}
              socket={socket}
              tableData={tableData}
            />
          </div>
          <div className="text-sm text-gray-300 mt-1">Cliquez pour piocher</div>
        </div>

      {/* Zone centrale: informations (pas de bouton Bombom global) */}
      <div className="flex flex-col items-center justify-center relative flex-1">
        {isInPenalty && (
          <div className="mt-2 text-sm bg-red-600 bg-opacity-70 px-3 py-1 rounded-full animate-pulse">
            Mauvaise carte ! Pénalité en cours...
          </div>
        )}
      </div>

      {/* La défausse est dans la colonne de droite */}
      <div className="flex flex-col items-center mr-6">
        <div ref={discardRef} className="w-28 h-40 bg-gray-900/70 border-4 border-yellow-400 rounded-2xl shadow-2xl flex flex-col items-center justify-center mb-2 relative overflow-hidden backdrop-blur-sm">
          <span className="absolute -top-3 left-2 bg-yellow-400 text-gray-900 font-extrabold px-2 py-1 rounded-full text-xs shadow z-10">Défausse</span>
          {discardPile !== null ? (
            <div className="w-full h-full">
              <img
                src={getCardImage(discardPile)}
                alt="Carte défaussée"
                className="w-full h-full object-cover rounded-xl"
              />
            </div>
          ) : (
            <>
              <span className="text-3xl">🗑️</span>
              <span className="mt-2 text-sm font-bold">Défausse</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

