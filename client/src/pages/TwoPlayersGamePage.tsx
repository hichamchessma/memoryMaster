import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import PrepOverlay from '../components/training/PrepOverlay';
import DrawnCardAnimation from '../components/training/DrawnCardAnimation';
import FlyingCard, { type DealAnimState } from '../components/training/FlyingCard';
import MultiplayerTopBanner from '../components/training/MultiplayerTopBanner';
import ScoreboardModal from '../components/training/ScoreboardModal';
import {
  JackPowerCueOverlay,
  KingPowerCueOverlay,
  PenaltyCueOverlay,
  PenaltyDimOverlay,
  QuickDiscardFlashOverlay,
  QueenPowerCueOverlay,
  ShowTimePromptOverlay,
  VictoryOverlay,
} from './twoPlayersGame/Overlays';
import { BottomPlayerRow, CenterBoard, MemorizationEndOverlay, QuitConfirmModal, ReadyOrQuitButton, TopPlayerRow, TopRightControls } from './twoPlayersGame/UiBlocks';
import { getCardImage, getCardValue, getRankLabel, isJoker } from '../utils/cards';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { activePlayerStyle, getCardScore, inactivePlayerStyle } from './twoPlayersGame/gameUtils';
import type { CardState } from './twoPlayersGame/gameUtils';
import { useTestModeLogin } from './twoPlayersGame/hooks/useTestModeLogin';
import { useLockBodyScroll } from './twoPlayersGame/hooks/useLockBodyScroll';
import { useTwoPlayersGameSocket } from './twoPlayersGame/hooks/useTwoPlayersGameSocket';
import { useShowTimeHandlers } from './twoPlayersGame/hooks/useShowTimeHandlers';
import { useLobbyActions } from './twoPlayersGame/hooks/useLobbyActions';
import { useCardActions } from './twoPlayersGame/hooks/useCardActions';


const TwoPlayersGamePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { socket } = useSocket();
  const { login } = useAuth();
  const deckRef = React.useRef<HTMLDivElement>(null);
  const player1HandRef = React.useRef<HTMLDivElement>(null);
  const player2HandRef = React.useRef<HTMLDivElement>(null);

  // États pour les informations des joueurs réels
  // myPlayerInfo = le joueur actuel (toujours affiché en bas)
  // opponentInfo = l'adversaire (toujours affiché en haut)
  const [myPlayerInfo, setMyPlayerInfo] = React.useState<{name: string; isReal: boolean; userId: string} | null>(null);
  const [opponentInfo, setOpponentInfo] = React.useState<{name: string; isReal: boolean; userId: string} | null>(null);

  const { testTableData } = useTestModeLogin({
    locationSearch: location.search,
    login,
    setMyPlayerInfo,
    setOpponentInfo,
  });
  useLockBodyScroll();

  // Utiliser testTableData si disponible, sinon location.state
  const tableData = testTableData || (location.state as {
    tableId?: string;
    tableCode?: string;
    players?: Array<{_id: string; firstName: string; lastName: string; position: number}>;
    currentUserId?: string;
  } | null);
  
  // Déterminer si je suis player1 (en haut) ou player2 (en bas)
  const [amIPlayer1, setAmIPlayer1] = React.useState<boolean | null>(null);
  
  // État pour stocker les joueurs actuels de la table
  const [tablePlayers, setTablePlayers] = React.useState<Array<{_id: string; firstName: string; lastName: string; position: number; isReady?: boolean}>>(tableData?.players || []);
  
  // États pour le système Ready
  const [myReadyStatus, setMyReadyStatus] = React.useState(false);
  const [opponentReadyStatus, setOpponentReadyStatus] = React.useState(false);
  const [gameStarted, setGameStarted] = React.useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = React.useState(false);

  // État pour le deck et la distribution
  const [isDealing, setIsDealing] = React.useState(false);
  const [dealingCard, setDealingCard] = React.useState<{to: 'top'|'bottom', index: number, cardValue: number} | null>(null);
  const [player1Cards, setPlayer1Cards] = React.useState<CardState[]>([]);
  const [player2Cards, setPlayer2Cards] = React.useState<CardState[]>([]);
  const [cardsDealt, setCardsDealt] = React.useState(0);
  const [drawnCard, setDrawnCard] = React.useState<{value: number, isFlipped: boolean} | null>(null);
  const [showCardActions, setShowCardActions] = React.useState(false);
  const [selectingCardToReplace, setSelectingCardToReplace] = React.useState(false);
  // Pouvoir du Roi: activer pour échanger deux cartes
  const [isKingPowerActive, setIsKingPowerActive] = React.useState(false);
  const [kingPowerActivated, setKingPowerActivated] = React.useState(false); // Pour éviter la double activation
  const [kingSelections, setKingSelections] = React.useState<Array<{player: 'top'|'bottom', index: number}>>([]);
  const [powerCue, setPowerCue] = React.useState(false);
  // Pouvoir de la Dame: voir une carte adverse 3s
  const [isQueenPowerActive, setIsQueenPowerActive] = React.useState(false);
  const [queenCue, setQueenCue] = React.useState(false);
  // Variable d'état pour suivre si une carte a déjà été sélectionnée avec le pouvoir de la Dame
  const [queenCardSelected, setQueenCardSelected] = React.useState(false);
  // Pouvoir du Valet: voir une de SES cartes 3s
  const [isJackPowerActive, setIsJackPowerActive] = React.useState(false);
  const [jackCue, setJackCue] = React.useState(false);
  // Variable d'état pour suivre si une carte a déjà été sélectionnée avec le pouvoir du Valet
  const [jackCardSelected, setJackCardSelected] = React.useState(false);
  // Variable pour suivre si un pouvoir quelconque est actif
  const [anyPowerActive, setAnyPowerActive] = React.useState(false);
  // Référence pour bloquer immédiatement les clics multiples
  const jackPowerUsedRef = React.useRef(false);
  const [deck, setDeck] = React.useState<number[]>([]);
  // Test helper: force next draw
  const [forcedNextDraw, setForcedNextDraw] = React.useState<
    | { kind: 'rank'; rank: number }
    | { kind: 'joker'; type: 1 | 2 }
    | null
  >(null);
  const [showForceMenu, setShowForceMenu] = React.useState(false);
  const [discardPile, setDiscardPile] = React.useState<number | null>(null);
  const [isDeckGlowing, setIsDeckGlowing] = React.useState(false);
  const [isInPenalty, setIsInPenalty] = React.useState(false);
  const [quickDiscardActive, setQuickDiscardActive] = React.useState(false);
  // Message flash (1s) lorsqu'un joueur défausse en mode défausse rapide
  const [quickDiscardFlash, setQuickDiscardFlash] = React.useState<string | null>(null);
  const [drawnCardAnim, setDrawnCardAnim] = React.useState<{
    value: number;
    position: {x: number, y: number};
    isRevealed: boolean;
  } | null>(null);
  // Overlay de préparation (style "fighting")
  const [showPrepOverlay, setShowPrepOverlay] = React.useState(false);
  const [showMemorizationEndOverlay, setShowMemorizationEndOverlay] = React.useState(false);
  const [memorizationTimerStarted, setMemorizationTimerStarted] = React.useState(false);
  // Garde contre démarrage multiple (StrictMode)
  const memorizationStartedRef = React.useRef(false);
  // Phase de mémorisation : compter les cartes cliquées
  const [isMemorizationPhase, setIsMemorizationPhase] = React.useState(false);
  const [memorizedCardsCount, setMemorizedCardsCount] = React.useState(0);
  const [memorizedCardIndexes, setMemorizedCardIndexes] = React.useState<number[]>([]);
  // Variable pour suivre si le tour est passé à l'adversaire après une déclaration Bombom
  const [bombomTurnPassedToOpponent, setBombomTurnPassedToOpponent] = React.useState<boolean>(false);
  // Joueur qui a déclaré Bombom en dernier
  const [, setLastBombomPlayer] = React.useState<'player1' | 'player2' | null>(null);
  // Zone à laisser visible pendant la pénalité
  const [penaltyPlayer, setPenaltyPlayer] = React.useState<'player1' | 'player2' | null>(null);
  const [, setFaultyCardIndex] = React.useState<number | null>(null);
  // Animation sifflet arbitre juste avant l'assombrissement
  const [penaltyCue, setPenaltyCue] = React.useState(false);
  // Contrôle spécifique de l'overlay sombre (décorrélé du blocage logique isInPenalty)
  const [showPenaltyDim, setShowPenaltyDim] = React.useState(false);

  // Victoire & Scores
  const [winner, setWinner] = React.useState<null | 'player1' | 'player2'>(null);
  const [showVictory, setShowVictory] = React.useState(false);
  const [scores, setScores] = React.useState<{ player1: number; player2: number }>({ player1: 0, player2: 0 });
  const [showScoreboard, setShowScoreboard] = React.useState(false);
  // Mode Powerful: cliquer une carte => défausse immédiate
  const [isPowerfulMode, setIsPowerfulMode] = React.useState(false);
  // Bombom & ShowTime
  const [bombomDeclaredBy, setBombomDeclaredBy] = React.useState<null | 'player1' | 'player2'>(null);
  const [bombomCancelUsed, setBombomCancelUsed] = React.useState<{ player1: boolean; player2: boolean }>({ player1: false, player2: false });
  const [showShowTimePrompt, setShowShowTimePrompt] = React.useState(false);

  // Ref pour connaître en temps réel si une pénalité est en cours (utilisé dans les callbacks setInterval)
  const isInPenaltyRef = React.useRef(false);
  const drawnCardRef = React.useRef<{value: number, isFlipped: boolean} | null>(null);
  const myPlayerInfoRef = React.useRef<{name: string; isReal: boolean; userId: string} | null>(null);
  // Référence pour le timer de Bombom (déclenchement automatique de ShowTime)
  const bombomTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  // Références visuelles
  const discardRef = React.useRef<HTMLDivElement | null>(null);

  // Garde pour �viter de rejoindre plusieurs fois
  const hasJoinedRoom = React.useRef(false);
  // Handlers Scoreboard
  const openScoreboard = React.useCallback(() => setShowScoreboard(true), []);
  const closeScoreboard = React.useCallback(() => setShowScoreboard(false), []);

  const togglePowerfulMode = React.useCallback(() => {
    setIsPowerfulMode(prev => !prev);
  }, []);
  const handleRevealAllCards = React.useCallback(() => {
    setPlayer1Cards(prev => prev.map(card => ({ ...card, isFlipped: true })));
    setPlayer2Cards(prev => prev.map(card => ({ ...card, isFlipped: true })));
    setTimeout(() => {
      setPlayer1Cards(prev => prev.map(card => ({ ...card, isFlipped: false })));
      setPlayer2Cards(prev => prev.map(card => ({ ...card, isFlipped: false })));
    }, 2000);
  }, [setPlayer1Cards, setPlayer2Cards]);

  // Gérer l'animation de la carte en cours de distribution
  React.useEffect(() => {
    if (dealingCard) {
      // Ici, nous pourrions ajouter des effets sonores ou d'autres animations
      // liées à la carte en cours de distribution
      const timer = setTimeout(() => {
        // Nettoyer l'animation après un délai
        setDealingCard(null);
      }, 500); // Durée de l'animation en ms

      return () => clearTimeout(timer);
    }
  }, [dealingCard]);



  // Initialise un nouveau jeu
  const initializeDeck = () => {
    // Stopper tous les timers/timeout éventuels d'une partie précédente
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (beforeRoundTimerRef.current) { clearInterval(beforeRoundTimerRef.current); beforeRoundTimerRef.current = null; }
    if (prepTimeoutRef.current) { clearTimeout(prepTimeoutRef.current); prepTimeoutRef.current = null; }

    // Créer un nouveau tableau avec des objets uniques pour chaque carte
    const initialCards = Array(4).fill(null).map((_, i) => ({
      id: `card-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      value: -1,
      isFlipped: false
    }));
    
    // Créer un nouveau deck mélangé (2 jeux de 52 cartes) + 12 Jokers (6 joker + 6 joker2)
    const base = [...Array(52).keys(), ...Array(52).keys()]; // 0..51 x2
    const jokers = [104,105,106,107,108,109,110,111,112,113,114,115];
    const newDeck = [...base, ...jokers].sort(() => Math.random() - 0.5);
    
    // Retirer 8 cartes du deck pour la distribution initiale (4 par joueur)
    const initialDeck = newDeck.slice(8);
    
    setDeck(initialDeck);
    setPlayer1Cards([...initialCards]);
    setPlayer2Cards([...initialCards]);
    setCardsDealt(0);
    setCurrentPlayer('player1');
    setIsPlayerTurn(false);
    setTimeLeft(0);
    // Le timer sera mis à jour par le serveur via game:timer_update
    setGamePhase('preparation');
    setCardsFlipped({
      player1: { count: 0, indexes: [] },
      player2: { count: 0, indexes: [] }
    });
    setDrawnCard(null);
    setShowCardActions(false);
    setSelectingCardToReplace(false);
    setDiscardPile(null);
    setQuickDiscardActive(false);
    setShowPrepOverlay(false);
    setMemorizationTimerStarted(false);
    memorizationStartedRef.current = false;
    setWinner(null);
    setShowVictory(false);
    setShowScoreboard(false);
    setIsPowerfulMode(false);
    // Reset Bombom state for a new game
    setBombomDeclaredBy(null);
    setBombomCancelUsed({ player1: false, player2: false });
    setShowShowTimePrompt(false);
  };

  // Pour stocker les positions deck/main (pour animation)
  const [dealAnim, setDealAnim] = React.useState<null | {
    from: {x: number, y: number},
    to: {x: number, y: number},
    toPlayer: 'top'|'bottom',
    index: number,
    cardValue: number
  }>(null);
  const [replaceOutAnim, setReplaceOutAnim] = React.useState<DealAnimState | null>(null);
  const [replaceInAnim, setReplaceInAnim] = React.useState<DealAnimState | null>(null);
  const [replaceOutImage, setReplaceOutImage] = React.useState<string | null>(null);
  const [replaceInImage, setReplaceInImage] = React.useState<string | null>(null);
  const [swapAnimA, setSwapAnimA] = React.useState<DealAnimState | null>(null);
  const [swapAnimB, setSwapAnimB] = React.useState<DealAnimState | null>(null);

  // Délai pour la distribution des cartes (en ms)
  const DEAL_DELAY = 400; // Augmenté pour une animation plus fluide
  
  // Gestion des phases de jeu
  type GamePhase = 'preparation' | 'before_round' | 'player1_turn' | 'player2_turn';
  const [gamePhase, setGamePhase] = React.useState<GamePhase>('preparation');
  
  // Suivi des cartes retournées en phase 'avant tour'
  const [cardsFlipped, setCardsFlipped] = React.useState<{
    player1: {count: number, indexes: number[]},
    player2: {count: number, indexes: number[]}
  }>({
    player1: { count: 0, indexes: [] },
    player2: { count: 0, indexes: [] }
  });
  
  // Gestion du tour de jeu
  const [currentPlayer, setCurrentPlayer] = React.useState<'player1' | 'player2'>('player1');
  const [timeLeft, setTimeLeft] = React.useState<number>(15);
  const [isPlayerTurn, setIsPlayerTurn] = React.useState<boolean>(false);
  const isPlayerTurnRef = React.useRef<boolean>(false); // Ref pour utiliser dans les callbacks
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  const beforeRoundTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const prepTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  
  // Synchroniser la ref avec l'état
  React.useEffect(() => {
    isPlayerTurnRef.current = isPlayerTurn;
  }, [isPlayerTurn]);
  
  // États pour les 3 timers synchronisés avec le serveur
  const [, setTimerPhase] = React.useState<'memorization' | 'game' | 'choice' | null>(null);
  const [, setMemoTimeLeft] = React.useState<number>(2);
  const [, setGameTimeLeft] = React.useState<number>(5);
  const [, setChoiceTimeLeft] = React.useState<number>(10);
  
  // Formatage du temps n'est plus utilisé ici (timer affiché dans TopBanner)

  // Référence pour stocker la fonction de démarrage du tour
  const startTurnTimerRef = React.useRef<() => void>(() => {});
  
  // Fonction pour gérer le passage au tour suivant
  const handleTurnEnd = React.useCallback((currentPlayer: 'player1' | 'player2') => {
    // Réinitialiser les états de la carte piochée
    setDrawnCard(null);
    setShowCardActions(false);
    setSelectingCardToReplace(false);
    
    // Changer de joueur
    const nextPlayer = currentPlayer === 'player1' ? 'player2' : 'player1';
    console.log('Passage au joueur', nextPlayer);
    
    // Mettre à jour le joueur actuel et la phase de jeu
    setCurrentPlayer(nextPlayer);
    setGamePhase(nextPlayer === 'player1' ? 'player1_turn' : 'player2_turn');
    
    // Informer le serveur du changement de tour
    if (socket) {
      socket.emit('game:end_turn', {
        tableId: tableData?.tableId,
        userId: tableData?.currentUserId,
        nextPlayerId: nextPlayer === 'player1' ? tablePlayers[0]?._id : tablePlayers[1]?._id
      });
    }
    
    // Ne pas démarrer de timer local, le serveur va gérer cela
  }, [socket, tableData, tablePlayers]);
  
  // Fonction pour démarrer le timer du tour
  const startTurnTimer = React.useCallback(() => {
    console.log('🕐 Démarrage du minuteur de tour pour', currentPlayer);
    
    // Mettre à jour la phase de jeu en fonction du joueur actuel
    const newPhase = currentPlayer === 'player1' ? 'player1_turn' : 'player2_turn';
    setGamePhase(newPhase);
    
    // Si Bombom a été déclaré précédemment par ce joueur, gérer ShowTime avant tout
    console.log('🍬 Vérification Bombom:', { bombomDeclaredBy, currentPlayer });
    if (bombomDeclaredBy === currentPlayer) {
      console.log('🍬 Bombom détecté pour le joueur actuel!');
      // Si l'annulation n'a pas encore été utilisée, proposer d'annuler ou de lancer ShowTime
      const canCancel = !bombomCancelUsed[currentPlayer];
      if (canCancel) {
        setIsPlayerTurn(false);
        setShowShowTimePrompt(true);
        return; // Attendre la décision
      } else {
        // Annulation déjà utilisée: lancer ShowTime automatiquement
        setIsPlayerTurn(false);
        triggerShowTime();
        return;
      }
    }

    // Activer le tour du joueur
    setIsPlayerTurn(true);
    
    // Informer le serveur du début du tour (il gérera le timer)
    if (socket) {
      socket.emit('game:start_turn', {
        tableId: tableData?.tableId,
        userId: tableData?.currentUserId,
        currentPlayerId: currentPlayer === 'player1' ? tablePlayers[0]?._id : tablePlayers[1]?._id
      });
    }
    
    // Ne pas créer de timer local, le serveur gère cela via game:timer_update
  }, [currentPlayer, handleTurnEnd, drawnCard, bombomDeclaredBy, bombomCancelUsed]);

  // Déclenche ShowTime: révèle toutes les cartes, calcule le gagnant (score le plus bas gagne), affiche et enregistre les scores
  const { triggerShowTime, handleShowTime } = useShowTimeHandlers({
    socket,
    tableData,
    timerRef,
    beforeRoundTimerRef,
    setBombomDeclaredBy,
    setShowShowTimePrompt,
    setPlayer1Cards,
    setPlayer2Cards,
    setQuickDiscardFlash,
    setWinner,
    setShowVictory,
    setScores,
    setShowScoreboard,
    getCardScore,
  });
  const canCancelBombom = amIPlayer1 === null
    ? false
    : !bombomCancelUsed[amIPlayer1 ? 'player1' : 'player2'];
  const handleShowTimeConfirm = React.useCallback(() => {
    if (bombomTimerRef.current) {
      console.log('?? Stopping Bombom auto-ShowTime timer (user clicked ShowTime)');
      clearTimeout(bombomTimerRef.current);
      bombomTimerRef.current = null;
    }
    setShowShowTimePrompt(false);
    setTimeout(() => triggerShowTime(), 50);
  }, [triggerShowTime]);
  
  // Mettre à jour la référence quand la fonction change
  React.useEffect(() => {
    if (startTurnTimer) {
      startTurnTimerRef.current = startTurnTimer;
    }
  }, [startTurnTimer]);
  
  // Gestion du minuteur de 5 secondes pour la phase 'avant tour'
  const startBeforeRoundTimer = React.useCallback(() => {
    // Eviter démarrages multiples (ex: StrictMode double effet)
    if (memorizationStartedRef.current) return;
    memorizationStartedRef.current = true;
    console.log('Démarrage du minuteur de 5 secondes pour la phase de mémorisation');
    
    // Nettoyer l'ancien timer s'il existe
    if (beforeRoundTimerRef.current) {
      clearInterval(beforeRoundTimerRef.current);
      beforeRoundTimerRef.current = null;
    }
    
    // Démarrer le compte à rebours de 5 secondes
    setTimeLeft(5);
    setMemorizationTimerStarted(true);
    
    // En mode multijoueur, le serveur gère les timers
    if (tableData?.tableId && socket) {
      console.log('💬 Mode multijoueur: le serveur gère les timers');
      // Le serveur enverra des événements game:timer_update
      return;
    }
    
    // Mode local seulement: utiliser un timer local
    console.log('💻 Mode local: utilisation d\'un timer local');
    
    // Mettre à jour le temps toutes les secondes
    beforeRoundTimerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        // Pendant une pénalité, on fige aussi ce timer par sécurité
        if (isInPenaltyRef.current) {
          return prev;
        }
        if (prev <= 1) {
          // Fin du temps, passer au jeu normal
          if (beforeRoundTimerRef.current) {
            clearInterval(beforeRoundTimerRef.current);
            beforeRoundTimerRef.current = null;
          }
          console.log('Fin de la phase de mémorisation, passage au jeu normal');
          
          // Retourner toutes les cartes
          setPlayer1Cards(prev => prev.map(card => ({ ...card, isFlipped: false })));
          setPlayer2Cards(prev => prev.map(card => ({ ...card, isFlipped: false })));
          
          // Activer la défausse rapide
          setQuickDiscardActive(true);
          
          // Passer à la phase de jeu normale
          setGamePhase('player1_turn');
          setCurrentPlayer('player1');
          setIsPlayerTurn(true);
          setMemorizationTimerStarted(false);
          memorizationStartedRef.current = false;
          
          // Démarrer le timer du premier tour en utilisant la référence
          if (startTurnTimerRef.current) {
            startTurnTimerRef.current();
          }
          
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [setGamePhase, setCurrentPlayer, setIsPlayerTurn, setTimeLeft, setPlayer1Cards, setPlayer2Cards, tableData, socket]);
  
  // Nettoyer les intervalles quand le composant est démonté
  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (beforeRoundTimerRef.current) {
        clearInterval(beforeRoundTimerRef.current);
      }
    };
  }, []);
  useTwoPlayersGameSocket({
    socket,
    tableData,
    navigate,
    hasJoinedRoom,
    amIPlayer1,
    tablePlayers,
    bombomDeclaredBy,
    currentPlayer,
    bombomTurnPassedToOpponent,
    myPlayerInfo,
    opponentInfo,
    discardPile,
    quickDiscardActive,
    showShowTimePrompt,
    isInPenalty,
    drawnCard,
    deckRef,
    player1HandRef,
    player2HandRef,
    discardRef,
    beforeRoundTimerRef,
    bombomTimerRef,
    drawnCardRef,
    isInPenaltyRef,
    isPlayerTurnRef,
    jackPowerUsedRef,
    myPlayerInfoRef,
    timerRef,
    setTablePlayers,
    setMyPlayerInfo,
    setOpponentInfo,
    setMyReadyStatus,
    setOpponentReadyStatus,
    setGameStarted,
    setAmIPlayer1,
    setPlayer1Cards,
    setPlayer2Cards,
    setShowPrepOverlay,
    setIsMemorizationPhase,
    setMemorizedCardsCount,
    setMemorizedCardIndexes,
    setIsPlayerTurn,
    setGamePhase,
    setCurrentPlayer,
    setBombomTurnPassedToOpponent,
    setShowShowTimePrompt,
    setDrawnCard,
    setShowCardActions,
    setSelectingCardToReplace,
    setReplaceInAnim,
    setReplaceOutAnim,
    setReplaceOutImage,
    setReplaceInImage,
    setDiscardPile,
    setQuickDiscardFlash,
    setIsInPenalty,
    setQuickDiscardActive,
    setPenaltyPlayer,
    setFaultyCardIndex,
    setPenaltyCue,
    setShowPenaltyDim,
    setTimerPhase,
    setTimeLeft,
    setMemoTimeLeft,
    setGameTimeLeft,
    setChoiceTimeLeft,
    setShowMemorizationEndOverlay,
    setIsKingPowerActive,
    setKingPowerActivated,
    setKingSelections,
    setPowerCue,
    setIsQueenPowerActive,
    setQueenCue,
    setQueenCardSelected,
    setIsJackPowerActive,
    setJackCue,
    setJackCardSelected,
    setAnyPowerActive,
    setBombomDeclaredBy,
    setBombomCancelUsed,
    setLastBombomPlayer,
    setShowScoreboard,
    setIsPowerfulMode,
    getCardImage,
    getRankLabel,
    handleShowTime,
  });
  
  // Gérer le démarrage du jeu après la distribution
  React.useEffect(() => {
    if (cardsDealt === 4 && gamePhase === 'preparation') {
      console.log('Distribution terminée, passage à la phase avant tour');
      
      // Réinitialiser l'état des cartes retournées
      setCardsFlipped({
        player1: { count: 0, indexes: [] },
        player2: { count: 0, indexes: [] }
      });
      
      // Passer à la phase avant tour
      setGamePhase('before_round');
      setCurrentPlayer('player1');
      // Pendant la phase de mémorisation, on fige les actions du jeu (deck non cliquable)
      setIsPlayerTurn(false);
      
      // Afficher l'overlay de préparation (2s), puis démarrer le minuteur de mémorisation
      setShowPrepOverlay(true);
      // Annuler un éventuel timeout précédent et mémoriser celui en cours
      if (prepTimeoutRef.current) { clearTimeout(prepTimeoutRef.current); }
      prepTimeoutRef.current = setTimeout(() => {
        setShowPrepOverlay(false);
        // Démarrer de manière idempotente (protégée par ref)
        startBeforeRoundTimer();
        prepTimeoutRef.current = null;
      }, 2000);
    }
  }, [cardsDealt, gamePhase]);

  // Actions Bombom (par joueur)
  const { handleDeclareBombomFor, handleCancelBombom, handleCardClick } = useCardActions({
    socket,
    tableData,
    amIPlayer1,
    currentPlayer,
    gamePhase,
    isPlayerTurn,
    drawnCard,
    discardPile,
    selectingCardToReplace,
    isInPenalty,
    bombomDeclaredBy,
    bombomCancelUsed,
    showShowTimePrompt,
    bombomTimerRef,
    timerRef,
    startTurnTimer,
    setBombomDeclaredBy,
    setBombomTurnPassedToOpponent,
    setQuickDiscardFlash,
    setBombomCancelUsed,
    setShowShowTimePrompt,
    setIsPlayerTurn,
    setDrawnCard,
    player1Cards,
    player2Cards,
    cardsFlipped,
    myPlayerInfo,
    setPlayer1Cards,
    setPlayer2Cards,
    isMemorizationPhase,
    memorizedCardsCount,
    memorizedCardIndexes,
    setMemorizedCardIndexes,
    setMemorizedCardsCount,
    quickDiscardActive,
    discardRef,
    setReplaceOutImage,
    setReplaceOutAnim,
    setReplaceInAnim,
    setReplaceInImage,
    setSwapAnimA,
    setSwapAnimB,
    setDiscardPile,
    setShowCardActions,
    setSelectingCardToReplace,
    setIsKingPowerActive,
    setKingPowerActivated,
    setAnyPowerActive,
    setKingSelections,
    setPowerCue,
    setIsQueenPowerActive,
    setQueenCue,
    setIsJackPowerActive,
    setJackCue,
    jackPowerUsedRef,
    kingPowerActivated,
    isKingPowerActive,
    kingSelections,
    queenCardSelected,
    jackCardSelected,
    isPowerfulMode,
    setWinner,
    setShowVictory,
    setScores,
    setShowScoreboard,
    setQuickDiscardActive,
    getCardImage,
    getCardValue,
    getRankLabel,
    getCardScore,
    isJoker,
    deckRef,
    player1HandRef,
    player2HandRef,
    setCardsFlipped,
  });

  const { handleToggleReady, handleQuitGame, handleStartNewGame } = useLobbyActions({
    socket,
    tableData,
    setShowQuitConfirm,
    isDealing,
    setScores,
    initializeDeck,
    setCardsFlipped,
    setPlayer1Cards,
    setPlayer2Cards,
    setCardsDealt,
    setIsDealing,
    deckRef,
    player1HandRef,
    player2HandRef,
    setDealAnim,
    setDealingCard,
    dealDelay: DEAL_DELAY,
  });
  const startNextGameFromModal = React.useCallback(() => {
    setShowScoreboard(false);
    // Ne pas r�initialiser les scores pour "Next Game"
    handleStartNewGame(false);
  }, [handleStartNewGame]);

  const handleSelectForceLabel = (lbl: string) => {
    // Map label to internal representation
    if (lbl === 'Jok1') {
      setForcedNextDraw({ kind: 'joker', type: 1 });
    } else if (lbl === 'Jok2') {
      setForcedNextDraw({ kind: 'joker', type: 2 });
    } else {
      const mapRank = (l: string): number => {
        if (l === 'A') return 0;
        if (l === 'J') return 10;
        if (l === 'Q') return 11;
        if (l === 'K') return 12;
        if (l === '10') return 9;
        // '2'..'9' => 1..8
        const n = parseInt(l, 10);
        return (isNaN(n) ? 0 : (n - 1));
      };
      setForcedNextDraw({ kind: 'rank', rank: mapRank(lbl) });
    }
    setShowForceMenu(false);

    // Ajouter un message de confirmation
    setQuickDiscardFlash(`Prochaine pioche forcée: ${lbl}`);
    setTimeout(() => setQuickDiscardFlash(null), 1500);
  };

  const handleDrawFromDeck = async () => {
    // Ne rien faire si ce n'est pas le tour du joueur ou si une action est en cours
    // Bloquer également pendant la phase de mémorisation OU si le timer est à 0
    if (!isPlayerTurn || showCardActions || selectingCardToReplace || drawnCard || gamePhase === 'before_round' || memorizationTimerStarted || timeLeft <= 0) {
      console.log('⛔ Cannot draw: not your turn or action in progress or time is up');
      return;
    }
    
    // Émettre l'événement WebSocket pour piocher du deck (UNE SEULE FOIS)
    console.log('🎴 Drawing card from deck...');
    if (socket) {
      // Désactiver temporairement pour éviter le spam
      setShowCardActions(true); // Bloque les clics suivants
      
      // Envoyer l'information de carte forcée au serveur si elle existe
      socket.emit('game:draw_card', {
        tableId: tableData?.tableId,
        userId: tableData?.currentUserId,
        fromDeck: true,
        forcedCard: forcedNextDraw ? {
          kind: forcedNextDraw.kind,
          rank: forcedNextDraw.kind === 'rank' ? forcedNextDraw.rank : undefined,
          type: forcedNextDraw.kind === 'joker' ? forcedNextDraw.type : undefined
        } : undefined
      });
    }
  };
  
  const isPlayerActive = (player: 'player1' | 'player2') => {
    if (gamePhase === 'before_round') {
      return player === 'player1';
    }
    if (amIPlayer1 === null) return false;
    if (amIPlayer1) {
      if (player === 'player1') return gamePhase === 'player2_turn';
      if (player === 'player2') return gamePhase === 'player1_turn';
    } else {
      if (player === 'player1') return gamePhase === 'player1_turn';
      if (player === 'player2') return gamePhase === 'player2_turn';
    }
    return false;
  };

  React.useEffect(() => {
    if (drawnCard) {
      setIsDeckGlowing(true);
      const timer = setTimeout(() => {
        setDrawnCardAnim({
          value: drawnCard.value,
          position: {x: window.innerWidth / 2, y: window.innerHeight / 2},
          isRevealed: false
        });
        setTimeout(() => {
          setDrawnCardAnim(prev => prev ? {...prev, isRevealed: true} : null);
        }, 300);
        setTimeout(() => {
          setDrawnCardAnim(null);
          setIsDeckGlowing(false);
          setTimeout(() => {
            setShowCardActions(true);
          }, 300);
        }, 2000);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [drawnCard]);

  const drawnCardAnimation = <DrawnCardAnimation state={drawnCardAnim} />;
  const flyingCard = <FlyingCard state={dealAnim} />;
  const replaceOutOverlay = (
    <FlyingCard
      state={replaceOutAnim}
      imageSrc={replaceOutImage || undefined}
      durationMs={1000}
      noFlip
    />
  );
  const replaceInOverlay = (
    <FlyingCard
      state={replaceInAnim}
      imageSrc={replaceInImage || undefined}
      durationMs={1000}
      noFlip
    />
  );
  const swapOverlayA = (
    <FlyingCard
      state={swapAnimA}
      durationMs={1000}
      noFlip
    />
  );
  const swapOverlayB = (
    <FlyingCard
      state={swapAnimB}
      durationMs={1000}
      noFlip
    />
  );

  return (
    <div
      className="h-screen w-full bg-cover bg-center homepage-bg grid grid-rows-[min-content_minmax(40px,1fr)_1.7fr_minmax(40px,1fr)] text-gray-200 overflow-hidden relative"
    >
      {flyingCard}
      {replaceOutOverlay}
      {replaceInOverlay}
      {swapOverlayA}
      {swapOverlayB}
      {drawnCardAnimation}
      <PenaltyCueOverlay show={penaltyCue} />
      <PenaltyDimOverlay show={showPenaltyDim} />
      <KingPowerCueOverlay show={powerCue} />
      <QueenPowerCueOverlay show={queenCue} />
      <JackPowerCueOverlay show={jackCue} />
      <QuickDiscardFlashOverlay message={quickDiscardFlash} />
      <ShowTimePromptOverlay
        open={showShowTimePrompt}
        canCancel={canCancelBombom}
        onShowTime={handleShowTimeConfirm}
        onCancel={handleCancelBombom}
      />
      <VictoryOverlay show={showVictory} winner={winner} amIPlayer1={amIPlayer1} />
      {/* Overlay de préparation */}
      <PrepOverlay show={showPrepOverlay} />
      <MemorizationEndOverlay show={showMemorizationEndOverlay} />
      <ReadyOrQuitButton
        gameStarted={gameStarted}
        myReadyStatus={myReadyStatus}
        onToggleReady={handleToggleReady}
        onQuitClick={() => setShowQuitConfirm(true)}
      />
      <QuitConfirmModal
        show={showQuitConfirm}
        onConfirm={handleQuitGame}
        onCancel={() => setShowQuitConfirm(false)}
      />
      <TopRightControls
        isPowerfulMode={isPowerfulMode}
        onTogglePowerfulMode={togglePowerfulMode}
        onRevealAll={handleRevealAllCards}
        showForceMenu={showForceMenu}
        onToggleForceMenu={() => setShowForceMenu(v => !v)}
        forcedNextDraw={forcedNextDraw}
        onSelectForceLabel={handleSelectForceLabel}
        onClearForced={() => setForcedNextDraw(null)}
        onOpenScoreboard={openScoreboard}
        onNavigateDashboard={() => navigate('/dashboard')}
      />
      {/* Titre */}
      <MultiplayerTopBanner 
        gamePhase={gamePhase} 
        timeLeft={timeLeft}
        tableCode={tableData?.tableCode}
        myReadyStatus={myReadyStatus}
        opponentReadyStatus={opponentReadyStatus}
        gameStarted={gameStarted}
        isMemorizationPhase={isMemorizationPhase}
      />
      {/* Modal Scoreboard (consultable à tout moment et après victoire) */}
      <ScoreboardModal
        visible={showScoreboard}
        scores={scores}
        onClose={closeScoreboard}
        onStartNextGame={startNextGameFromModal}
      />

      <TopPlayerRow
        player1HandRef={player1HandRef}
        isInPenalty={isInPenalty}
        penaltyPlayer={penaltyPlayer}
        isPlayerActive={isPlayerActive}
        activePlayerStyle={activePlayerStyle}
        inactivePlayerStyle={inactivePlayerStyle}
        opponentName={opponentInfo?.name || 'Adversaire'}
        cardsDealt={cardsDealt}
        player1Cards={player1Cards}
        onCardClick={(index) => handleCardClick('top', index)}
        highlight={(isKingPowerActive && isPlayerTurn) || (isQueenPowerActive && isPlayerTurn)}
      />
      <CenterBoard
        deckRef={deckRef}
        discardRef={discardRef}
        isDeckGlowing={isDeckGlowing}
        deckLength={deck.length}
        onDeckClick={handleDrawFromDeck}
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
        isInPenalty={isInPenalty}
        discardPile={discardPile}
      />

      <BottomPlayerRow
        player2HandRef={player2HandRef}
        isInPenalty={isInPenalty}
        penaltyPlayer={penaltyPlayer}
        isPlayerActive={isPlayerActive}
        activePlayerStyle={activePlayerStyle}
        inactivePlayerStyle={inactivePlayerStyle}
        myName={myPlayerInfo?.name || 'Moi'}
        cardsDealt={cardsDealt}
        player2Cards={player2Cards}
        onCardClick={(index) => handleCardClick('bottom', index)}
        highlight={isMemorizationPhase || (selectingCardToReplace && isPlayerTurn) || (isKingPowerActive && isPlayerTurn) || (isJackPowerActive && isPlayerTurn) || false}
        isPlayerTurn={isPlayerTurn}
        bombomDeclaredBy={bombomDeclaredBy}
        drawnCard={drawnCard}
        selectingCardToReplace={selectingCardToReplace}
        amIPlayer1={amIPlayer1}
        onDeclareBombom={handleDeclareBombomFor}
      />
    </div>
  );
};

export default TwoPlayersGamePage;






