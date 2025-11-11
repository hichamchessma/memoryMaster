import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import PlayerZone from '../components/training/PlayerZone';
import PrepOverlay from '../components/training/PrepOverlay';
import DrawnCardAnimation from '../components/training/DrawnCardAnimation';
import FlyingCard, { type DealAnimState } from '../components/training/FlyingCard';
import MultiplayerTopBanner from '../components/training/MultiplayerTopBanner';
import ScoreboardModal from '../components/training/ScoreboardModal';
import { getCardImage, getCardValue, getRankLabel, isJoker } from '../utils/cards';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

// Style pour mettre en évidence le joueur actif
const activePlayerStyle = {
  border: '3px solid #4CAF50',
  borderRadius: '8px',
  padding: '5px',
  transition: 'all 0.3s ease-in-out',
  boxShadow: '0 0 10px rgba(76, 175, 80, 0.5)'
};

// Style par défaut pour les joueurs inactifs
const inactivePlayerStyle = {
  border: '3px solid transparent',
  borderRadius: '8px',
  padding: '5px',
  transition: 'all 0.3s ease-in-out',
  boxShadow: 'none'
};

interface CardState {
  id: string;     // Identifiant unique pour chaque carte
  value: number;  // 0-51 pour les 52 cartes, -1 pour carte non distribuée
  isFlipped: boolean;
  updated?: number; // Timestamp pour forcer les mises à jour
}

// Calcule le score d'une carte selon les règles
function getCardScore(value: number): number {
  if (value === -1) return 0; // slot vide
  // Jokers
  if (value >= 104 && value <= 109) return -1; // Joker type 1
  if (value >= 110 && value <= 115) return -2; // Joker type 2
  // Cartes classiques
  const rank = getCardValue(value); // 0..12 (A..K)
  if (rank === 0) return 1; // As
  if (rank >= 1 && rank <= 8) return rank + 1; // 2..9
  if (rank === 9) return 0; // 10
  // Valet, Dame, Roi
  return 10;
}

const TwoPlayersGamePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { socket } = useSocket();
  const { login } = useAuth();
  const deckRef = React.useRef<HTMLDivElement>(null);
  const player1HandRef = React.useRef<HTMLDivElement>(null);
  const player2HandRef = React.useRef<HTMLDivElement>(null);

  // Récupérer les données de la table (depuis location.state OU depuis URL params pour le mode test)
  const searchParams = new URLSearchParams(location.search);
  const urlToken = searchParams.get('token');
  const urlTableId = searchParams.get('tableId');
  const urlUserId = searchParams.get('userId');

  // État pour stocker les données de la table en mode test
  const [testTableData, setTestTableData] = React.useState<any>(null);
  const [testModeInitialized, setTestModeInitialized] = React.useState(false);
  
  // Si on a des params URL (mode test), se connecter automatiquement
  React.useEffect(() => {
    if (urlToken && urlTableId && urlUserId && !testModeInitialized) {
      console.log('🧪 Test mode detected, auto-login...');
      setTestModeInitialized(true);
      
      // Stocker le token
      localStorage.setItem('token', urlToken);
      
      // Récupérer les données de la table
      fetch(`http://localhost:5000/api/game/tables/${urlTableId}`, {
        headers: {
          'Authorization': `Bearer ${urlToken}`
        }
      })
        .then(res => res.json())
        .then(data => {
          console.log('🧪 Table data loaded:', data);
          if (data.success && data.data) {
            // Stocker les données complètes de la table
            setTestTableData({
              tableId: urlTableId,
              tableCode: data.data.code,
              players: data.data.players,
              currentUserId: urlUserId
            });
            
            // Mettre à jour les joueurs
            const currentPlayer = data.data.players.find((p: any) => p._id === urlUserId);
            const otherPlayer = data.data.players.find((p: any) => p._id !== urlUserId);
            
            console.log('🧪 Current player:', currentPlayer);
            console.log('🧪 Other player:', otherPlayer);
            
            if (currentPlayer) {
              setMyPlayerInfo({
                name: `${currentPlayer.firstName} ${currentPlayer.lastName}`,
                isReal: true,
                userId: currentPlayer._id
              });
              
              // Créer un objet User complet pour l'authentification
              const testUser = {
                _id: currentPlayer._id,
                firstName: currentPlayer.firstName,
                lastName: currentPlayer.lastName,
                email: `${currentPlayer.firstName.toLowerCase()}@test.com`,
                age: 25,
                nationality: 'FR',
                elo: currentPlayer.elo || 1200,
                totalPoints: 0,
                avatar: '',
                token: urlToken,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              
              console.log('🧪 Logging in test user:', testUser);
              login(testUser as any);
            }
            
            if (otherPlayer) {
              setOpponentInfo({
                name: `${otherPlayer.firstName} ${otherPlayer.lastName}`,
                isReal: true,
                userId: otherPlayer._id
              });
            }
          }
        })
        .catch(err => console.error('❌ Error loading table:', err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlToken, urlTableId, urlUserId]);

  // Utiliser testTableData si disponible, sinon location.state
  const tableData = testTableData || (location.state as {
    tableId?: string;
    tableCode?: string;
    players?: Array<{_id: string; firstName: string; lastName: string; position: number}>;
    currentUserId?: string;
  } | null);

  // États pour les informations des joueurs réels
  // myPlayerInfo = le joueur actuel (toujours affiché en bas)
  // opponentInfo = l'adversaire (toujours affiché en haut)
  const [myPlayerInfo, setMyPlayerInfo] = React.useState<{name: string; isReal: boolean; userId: string} | null>(null);
  const [opponentInfo, setOpponentInfo] = React.useState<{name: string; isReal: boolean; userId: string} | null>(null);
  
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
  const [lastBombomPlayer, setLastBombomPlayer] = React.useState<'player1' | 'player2' | null>(null);
  // Zone à laisser visible pendant la pénalité
  const [penaltyPlayer, setPenaltyPlayer] = React.useState<'player1' | 'player2' | null>(null);
  const [faultyCardIndex, setFaultyCardIndex] = React.useState<number | null>(null);
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
  React.useEffect(() => {
    isInPenaltyRef.current = isInPenalty;
  }, [isInPenalty]);
  React.useEffect(() => {
    drawnCardRef.current = drawnCard;
  }, [drawnCard]);
  React.useEffect(() => {
    myPlayerInfoRef.current = myPlayerInfo;
  }, [myPlayerInfo]);

  // Handlers Scoreboard
  const openScoreboard = React.useCallback(() => setShowScoreboard(true), []);
  const closeScoreboard = React.useCallback(() => setShowScoreboard(false), []);
  const startNextGameFromModal = React.useCallback(() => {
    setShowScoreboard(false);
    // Ne pas réinitialiser les scores pour "Next Game"
    handleStartNewGame(false);
  }, []);
  const togglePowerfulMode = React.useCallback(() => {
    setIsPowerfulMode(prev => !prev);
  }, []);

  // Initialiser et mélanger le deck au chargement
  React.useEffect(() => {
    initializeDeck();
  }, []);

  // Initialiser les informations des joueurs depuis tableData
  React.useEffect(() => {
    const updatePlayerInfo = (players: Array<{_id: string; firstName: string; lastName: string; position: number}>) => {
      if (!tableData?.currentUserId) return;
      
      // Le joueur actuel est toujours affiché en bas (myPlayerInfo)
      const currentPlayer = players.find(p => p._id === tableData.currentUserId);
      // L'adversaire est toujours affiché en haut (opponentInfo)
      const otherPlayer = players.find(p => p._id !== tableData.currentUserId);
      
      if (currentPlayer) {
        setMyPlayerInfo({
          name: `${currentPlayer.firstName} ${currentPlayer.lastName}`,
          isReal: true,
          userId: currentPlayer._id
        });
      }
      
      if (otherPlayer) {
        setOpponentInfo({
          name: `${otherPlayer.firstName} ${otherPlayer.lastName}`,
          isReal: true,
          userId: otherPlayer._id
        });
      } else {
        setOpponentInfo({
          name: 'En attente...',
          isReal: false,
          userId: ''
        });
      }
    };

    if (tableData?.players) {
      updatePlayerInfo(tableData.players);
    }
  }, [tableData]);

  // Garde pour éviter de rejoindre plusieurs fois
  const hasJoinedRoom = React.useRef(false);

  // Écouter les mises à jour de la table via WebSocket
  React.useEffect(() => {
    if (!socket || !tableData?.tableId) return;
    if (hasJoinedRoom.current) return; // Ne pas rejoindre si déjà fait

    console.log('🔌 Joining table room:', tableData.tableId);
    console.log('🔌 Current user ID:', tableData.currentUserId);
    console.log('🔌 Socket connected:', socket.connected);
    console.log('🔌 Socket ID:', socket.id);
    
    socket.emit('joinTableRoom', { 
      tableId: tableData.tableId,
      userId: tableData.currentUserId 
    });
    hasJoinedRoom.current = true;

    // Écouter quand un joueur rejoint la table
    const handlePlayerJoined = (data: any) => {
      console.log('👤 Player joined event received!', data);
      console.log('👤 Players in table:', data.table?.players);
      
      if (data.table && data.table.players) {
        setTablePlayers(data.table.players);
        
        // Mettre à jour les infos des joueurs
        const currentPlayer = data.table.players.find((p: any) => p._id === tableData.currentUserId);
        const otherPlayer = data.table.players.find((p: any) => p._id !== tableData.currentUserId);
        
        console.log('👤 Current player found:', currentPlayer);
        console.log('👤 Other player found:', otherPlayer);
        
        if (currentPlayer) {
          setMyPlayerInfo({
            name: `${currentPlayer.firstName} ${currentPlayer.lastName}`,
            isReal: true,
            userId: currentPlayer._id
          });
        }
        
        if (otherPlayer) {
          setOpponentInfo({
            name: `${otherPlayer.firstName} ${otherPlayer.lastName}`,
            isReal: true,
            userId: otherPlayer._id
          });
          console.log('✅ Opponent info updated:', `${otherPlayer.firstName} ${otherPlayer.lastName}`);
        } else {
          console.log('⚠️ No opponent found yet');
        }
      }
    };

    socket.on('playerJoined', handlePlayerJoined);
    
    // Écouter aussi table_updated (événement alternatif)
    socket.on('table_updated', handlePlayerJoined);

    // Écouter les changements de statut Ready
    const handleReadyChanged = (data: any) => {
      console.log('🎮 Ready status changed:', data);
      
      if (data.userId === tableData.currentUserId) {
        setMyReadyStatus(data.isReady);
      } else {
        setOpponentReadyStatus(data.isReady);
      }
    };

    // Écouter le démarrage automatique de la partie
    const handleAutoStart = (data: any) => {
      console.log('🚀 Game auto-starting:', data);
      setGameStarted(true);
    };

    // Écouter la distribution des cartes
    const handleCardsDealt = (data: any) => {
      console.log('🃏 Cards dealt received:', data);
      
      if (!data.myCards) {
        console.error('❌ No myCards in data');
        return;
      }
      
      if (!data.opponentCards) {
        console.error('❌ No opponentCards in data');
        return;
      }
      
      console.log('🃏 Cards dealt received:', data);
      console.log('  myCards:', data.myCards);
      console.log('  opponentCards:', data.opponentCards);
      console.log('  amIPlayer1 (from server):', data.amIPlayer1);
      console.log('  amIPlayer1 (current state):', amIPlayer1);
      
      // Sauvegarder si je suis player1 ou player2 (UNE SEULE FOIS)
      if (amIPlayer1 === null) {
        console.log('✅ Setting amIPlayer1 for the FIRST time:', data.amIPlayer1);
        setAmIPlayer1(data.amIPlayer1);
      } else {
        console.log('⚠️ amIPlayer1 already set, ignoring new value');
      }
      
      // Créer les cartes avec isFlipped=false (face cachée)
      const myCards = data.myCards.map((card: any) => ({
        value: card.value,
        isFlipped: false,
        id: Math.random()
      }));
      
      const opponentCards = data.opponentCards.map((card: any) => ({
        value: -1, // Face cachée pour l'adversaire
        isFlipped: false,
        id: Math.random()
      }));
      
      // Mettre à jour les cartes des joueurs selon la position
      console.log('🃏 Setting initial cards');
      console.log('  myCards[0].isFlipped:', myCards[0]?.isFlipped);
      console.log('  opponentCards[0].isFlipped:', opponentCards[0]?.isFlipped);
      
      if (data.amIPlayer1) {
        // Je suis player1 (en haut), l'adversaire est player2 (en bas)
        setPlayer1Cards(myCards);
        setPlayer2Cards(opponentCards);
      } else {
        // Je suis player2 (en bas), l'adversaire est player1 (en haut)
        setPlayer2Cards(myCards);
        setPlayer1Cards(opponentCards);
      }
      
      // Animation de distribution des cartes (comme dans TrainingPage)
      const DEAL_DELAY = 400;
      const allCards = [
        ...data.myCards.map((card: any, i: number) => ({ card, player: 'bottom', index: i })),
        ...data.opponentCards.map((card: any, i: number) => ({ card, player: 'top', index: i }))
      ];
      
      // Distribuer les cartes une par une avec animation
      allCards.forEach((item, idx) => {
        setTimeout(() => {
          if (item.player === 'bottom') {
            setPlayer2Cards(prev => {
              const newCards = [...prev];
              newCards[item.index] = {
                ...newCards[item.index],
                value: item.card.value,
                isFlipped: false // Face cachée pendant la distribution
              };
              return newCards;
            });
          } else {
            setPlayer1Cards(prev => {
              const newCards = [...prev];
              newCards[item.index] = {
                ...newCards[item.index],
                value: item.card.value,
                isFlipped: false // Face cachée pendant la distribution
              };
              return newCards;
            });
          }
          
          // Après la dernière carte, afficher l'overlay de préparation
          if (idx === allCards.length - 1) {
            setTimeout(() => {
              // Afficher "Préparez-vous !" pendant 2 secondes
              setShowPrepOverlay(true);
              
              setTimeout(() => {
                // Cacher l'overlay après 2 secondes
                setShowPrepOverlay(false);
                
                // Activer la phase de mémorisation (le serveur gère le timer)
                setIsMemorizationPhase(true);
                setMemorizedCardsCount(0);
                setMemorizedCardIndexes([]);
                
                console.log('🧠 Memorization phase started - Click on 2 of YOUR cards to memorize');
              }, 2000); // Cacher l'overlay après 2 secondes
            }, 500); // Délai après la dernière carte
          }
        }, idx * DEAL_DELAY); // Délai entre chaque carte
      });
    };

    // Écouter quand un joueur quitte
    const handlePlayerQuit = (data: any) => {
      console.log('🚪 Player quit:', data);
      alert(data.message);
      // Rediriger vers le dashboard
      navigate('/dashboard');
    };

    // Écouter les changements de tour
    const handleTurnChanged = (data: any) => {
      console.log('🔄 Turn changed:', data);
      console.log('🍬 État Bombom lors du changement de tour:', { bombomDeclaredBy, currentPlayer });
      const { currentPlayerId, currentPlayerName } = data;
      
      // Utiliser tableData.currentUserId pour comparer
      const myUserId = tableData?.currentUserId;
      console.log(`  🆔 My userId: ${myUserId}, Current turn userId: ${currentPlayerId}`);
      console.log(`  🎮 Am I player1? ${amIPlayer1}`);
      
      // Déterminer si c'est notre tour
      const isMyTurn = currentPlayerId === myUserId;
      console.log(`  ✅ isMyTurn = ${isMyTurn} (${currentPlayerId} === ${myUserId})`);
      setIsPlayerTurn(isMyTurn);
      
      // NOUVELLE LOGIQUE: Utiliser les IDs des joueurs pour déterminer qui est player1/player2
      // IMPORTANT: Utiliser tablePlayers (mis à jour par le serveur) et non tableData.players (statique)
      const players = tablePlayers.length > 0 ? tablePlayers : (tableData?.players || []);
      const player1Id = players[0]?._id;
      const player2Id = players[1]?._id;
      
      console.log(`📊 DEBUG handleTurnChanged:`);
      console.log(`  → currentPlayerId: ${currentPlayerId}`);
      console.log(`  → player1Id: ${player1Id}`);
      console.log(`  → player2Id: ${player2Id}`);
      console.log(`  → players:`, players);
      console.log(`  → Comparison: currentPlayerId === player1Id? ${currentPlayerId === player1Id}`);
      console.log(`  → Comparison: currentPlayerId === player2Id? ${currentPlayerId === player2Id}`);
      
      // Déterminer quelle phase selon qui joue
      let newPhase: GamePhase;
      if (currentPlayerId === player1Id) {
        newPhase = 'player1_turn';
        setGamePhase('player1_turn');
        setCurrentPlayer('player1');
        console.log(`✅ Player 1's turn (${currentPlayerName}) - gamePhase: player1_turn`);
      } else if (currentPlayerId === player2Id) {
        newPhase = 'player2_turn';
        setGamePhase('player2_turn');
        setCurrentPlayer('player2');
        console.log(`✅ Player 2's turn (${currentPlayerName}) - gamePhase: player2_turn`);
      } else {
        console.error('⚠️ Unknown player ID:', currentPlayerId);
        console.error('  → This should NEVER happen!');
        return;
      }
      
      // LOGIQUE BOMBOM: Suivre le cadre vert (joueur actif)
      if (bombomDeclaredBy) {
        console.log('🍬 BOMBOM TRACKING:');
        console.log(`  → Bombom déclaré par: ${bombomDeclaredBy}`);
        console.log(`  → Joueur actuel: ${currentPlayer}`);
        console.log(`  → Tour passé à l'adversaire: ${bombomTurnPassedToOpponent}`);
        
        if (bombomDeclaredBy !== currentPlayer && !bombomTurnPassedToOpponent) {
          // Le tour est passé à l'adversaire pour la première fois
          console.log('🍬 Le tour est passé à l\'adversaire après déclaration Bombom');
          setBombomTurnPassedToOpponent(true);
        } 
        else if (bombomDeclaredBy === currentPlayer && bombomTurnPassedToOpponent) {
          // Le tour est revenu au joueur qui a déclaré Bombom
          console.log('🍬 LE TOUR EST REVENU AU JOUEUR QUI A DÉCLARÉ BOMBOM!');
          console.log('🍬 AFFICHAGE DU PROMPT SHOWTIME!');
          
          // Afficher le prompt ShowTime
          setShowShowTimePrompt(true);
          
          // Réinitialiser le suivi
          setBombomTurnPassedToOpponent(false);
        }
      }
      
      if (isMyTurn) {
        console.log(`✅ It's MY turn! (${currentPlayerName})`);
      } else {
        console.log(`⏳ Waiting for opponent... (${currentPlayerName})`);
      }
      
      // Nettoyer l'ancien timer s'il existe (le serveur gère maintenant les timers)
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      // Le timer est maintenant géré par le serveur via game:timer_update
      // On ne démarre plus de timer local ici
      
      // Réinitialiser l'état de la carte piochée pour permettre de piocher à nouveau
      // quand le tour revient au joueur après que l'adversaire n'a rien fait
      setDrawnCard(null);
      setShowCardActions(false);
      setSelectingCardToReplace(false);
      
      console.log(`✅ Turn changed handled - gamePhase: ${newPhase}, isMyTurn: ${isMyTurn}`);
    };

    // Écouter quand un joueur pioche une carte
    const handleCardDrawn = (data: any) => {
      console.log('🎴 Card drawn:', data);
      const { playerId, card } = data;
      
      // Si c'est nous qui avons pioché, on voit la carte
      if (playerId === myPlayerInfo?.userId) {
        console.log('👁️ I drew:', card);
        setDrawnCard(card);
        setSelectingCardToReplace(true);
      } else {
        // Sinon, on voit juste qu'il a pioché (carte face cachée)
        console.log('👀 Opponent drew a card (face down)');
        // TODO: Afficher une animation de pioche
      }
    };
    
    // Écouter quand l'adversaire pioche (on voit juste l'animation)
    const handleOpponentDrewCard = (data: any) => {
      console.log('👀 Opponent drew a card (face down):', data);
      
      // Animation de carte qui vole du deck vers la main de l'adversaire (face cachée)
      const deck = deckRef.current;
      // L'adversaire est toujours en haut (player1 visuel)
      const opponentHand = player1HandRef.current;
      
      if (deck && opponentHand) {
        const deckRect = deck.getBoundingClientRect();
        const handRect = opponentHand.getBoundingClientRect();
        
        // Animation: deck → main adversaire
        setReplaceInAnim({
          from: { x: deckRect.left + deckRect.width/2, y: deckRect.top + deckRect.height/2 },
          to: { x: handRect.left + handRect.width/2, y: handRect.top + handRect.height/2 },
          toPlayer: amIPlayer1 ? 'bottom' : 'top',
          index: 0,
          cardValue: -1 // Face cachée
        });
        
        // Nettoyer après l'animation
        setTimeout(() => {
          setReplaceInAnim(null);
        }, 1000);
      }
      
      console.log(`✅ Opponent drew a card - Animation shown`);
    };
    
    // Fonction utilitaire pour mettre à jour un tableau de cartes de manière cohérente
    const updateCardArray = (prev: any[], cardIndex: number, isQuickDiscard: boolean): any[] => {
      if (cardIndex === -1) return prev; // Défausse directe de la carte piochée
      
      const newCards = [...prev];
      
      // S'assurer que le tableau a la bonne taille
      while (newCards.length <= cardIndex) {
        newCards.push({
          id: `card-filler-${Date.now()}-${Math.random()}`,
          value: -1,
          isFlipped: false
        });
      }
      
      // Pour toutes les défausses, mettre la valeur à -1 au lieu de supprimer
      newCards[cardIndex] = {
        id: `discarded-${Date.now()}-${Math.random()}`,
        value: -1,
        isFlipped: false
      };
      
      return newCards;
    };

    // Écouter quand une carte est défaussée
    const handleCardDiscarded = (data: any) => {
      console.log('🚟️ Card discarded event received:', data);
      const { playerId, card, cardIndex, autoDiscard, quickDiscard, totalCards } = data;
      
      console.log(`  → Updating discard pile with card: ${card}`);
      console.log(`  → Current discardPile before update:`, discardPile);
      console.log(`  → Quick discard: ${quickDiscard}, Auto discard: ${autoDiscard}`);
      if (totalCards) console.log(`  → Total cards after discard: ${totalCards}`);
      
      // Animation de défausse
      const discard = discardRef.current;
      let sourceHand: HTMLDivElement | null = null;
      
      // Déterminer d'où vient la carte
      // Moi = toujours en bas (player2 visuel), Adversaire = toujours en haut (player1 visuel)
      if (playerId === tableData?.currentUserId) {
        // C'est moi qui défausse (en bas)
        sourceHand = player2HandRef.current;
      } else {
        // C'est l'adversaire qui défausse (en haut)
        sourceHand = player1HandRef.current;
      }
      
      if (discard && sourceHand) {
        const discardRect = discard.getBoundingClientRect();
        const handRect = sourceHand.getBoundingClientRect();
        
        // Animation: main → défausse
        setReplaceOutAnim({
          from: { x: handRect.left + handRect.width/2, y: handRect.top + handRect.height/2 },
          to: { x: discardRect.left + discardRect.width/2, y: discardRect.top + discardRect.height/2 },
          toPlayer: 'top',
          index: 0,
          cardValue: card
        });
        setReplaceOutImage(getCardImage(card));
        
        // Mettre à jour la défausse après l'animation
        setTimeout(() => {
          setDiscardPile(card);
          setReplaceOutAnim(null);
          setReplaceOutImage(null);
          console.log(`  ✅ setDiscardPile(${card}) called after animation`);
        }, 1000);
      } else {
        // Pas d'animation, mise à jour directe
        setDiscardPile(card);
        console.log(`  ✅ setDiscardPile(${card}) called (no animation)`);
      }
      
      // Afficher un message si c'est une défausse automatique
      if (autoDiscard) {
        console.log('⏰ Auto-discard due to timeout');
      }
      
      // Afficher le flash de défausse rapide
      if (quickDiscard && quickDiscardActive) {
        const rank = getRankLabel(card);
        const playerName = playerId === myPlayerInfo?.userId 
          ? myPlayerInfo?.name 
          : opponentInfo?.name;
        setQuickDiscardFlash(`${playerName} a jeté ${rank}`);
        setTimeout(() => setQuickDiscardFlash(null), 1000);
      }
      
      // Réinitialiser les états de carte piochée pour TOUS les joueurs
      setDrawnCard(null);
      setShowCardActions(false);
      setSelectingCardToReplace(false);
      
      // Mettre à jour les cartes en utilisant notre fonction utilitaire
      if (playerId !== myPlayerInfo?.userId) {
        // L'adversaire a défaussé
        if (amIPlayer1) {
          // Je suis player1 (en haut), l'adversaire est player2 et ses cartes sont en BAS (player2Cards)
          setPlayer2Cards(prev => {
            // Créer un nouveau tableau avec le bon nombre de cartes
            let updatedCards = [...prev];
            
            // Si c'est une défausse rapide, on supprime la carte à l'index spécifié
            if (quickDiscard && cardIndex < updatedCards.length) {
              console.log(`❗ Removing opponent's card at index ${cardIndex} for quick discard`);
              updatedCards = [...updatedCards.slice(0, cardIndex), ...updatedCards.slice(cardIndex + 1)];
            }
            
            // S'assurer que le tableau a exactement le bon nombre de cartes
            if (totalCards && updatedCards.length !== totalCards) {
              console.log(`❗ Fixing card count: current=${updatedCards.length}, should be=${totalCards}`);
              
              // Si on a trop de cartes, on les supprime
              if (updatedCards.length > totalCards) {
                updatedCards = updatedCards.slice(0, totalCards);
              }
              
              // Si on n'a pas assez de cartes, on en ajoute
              while (updatedCards.length < totalCards) {
                updatedCards.push({
                  id: `opponent-card-filler-${Date.now()}-${Math.random()}`,
                  value: -1,
                  isFlipped: false
                });
              }
            }
            
            console.log(`✅ Updated opponent's cards (player2, en bas). Now has ${updatedCards.length} cards`);
            return updatedCards;
          });
        } else {
          // Je suis player2 (en bas), l'adversaire est player1 et ses cartes sont en HAUT (player1Cards)
          setPlayer1Cards(prev => {
            // Créer un nouveau tableau avec le bon nombre de cartes
            let updatedCards = [...prev];
            
            // Si c'est une défausse rapide, on supprime la carte à l'index spécifié
            if (quickDiscard && cardIndex < updatedCards.length) {
              console.log(`❗ Removing opponent's card at index ${cardIndex} for quick discard`);
              updatedCards = [...updatedCards.slice(0, cardIndex), ...updatedCards.slice(cardIndex + 1)];
            }
            
            // S'assurer que le tableau a exactement le bon nombre de cartes
            if (totalCards && updatedCards.length !== totalCards) {
              console.log(`❗ Fixing card count: current=${updatedCards.length}, should be=${totalCards}`);
              
              // Si on a trop de cartes, on les supprime
              if (updatedCards.length > totalCards) {
                updatedCards = updatedCards.slice(0, totalCards);
              }
              
              // Si on n'a pas assez de cartes, on en ajoute
              while (updatedCards.length < totalCards) {
                updatedCards.push({
                  id: `opponent-card-filler-${Date.now()}-${Math.random()}`,
                  value: -1,
                  isFlipped: false
                });
              }
            }
            
            console.log(`✅ Updated opponent's cards (player1, en haut). Now has ${updatedCards.length} cards`);
            return updatedCards;
          });
        }
      } else {
        // C'est moi qui ai défaussé
        if (amIPlayer1) {
          // Je suis player1 (en haut)
          setPlayer1Cards(prev => {
            // Créer un nouveau tableau avec le bon nombre de cartes
            let updatedCards = [...prev];
            
            // Si c'est une défausse rapide, supprimer la carte à l'index spécifié
            if (quickDiscard && cardIndex < updatedCards.length) {
              console.log(`❗ Removing card at index ${cardIndex} for quick discard`);
              updatedCards = [...updatedCards.slice(0, cardIndex), ...updatedCards.slice(cardIndex + 1)];
            }
            
            // S'assurer que le tableau a exactement le bon nombre de cartes
            if (totalCards && updatedCards.length !== totalCards) {
              console.log(`❗ Fixing card count: current=${updatedCards.length}, should be=${totalCards}`);
              
              // Si on a trop de cartes, on les supprime
              if (updatedCards.length > totalCards) {
                updatedCards = updatedCards.slice(0, totalCards);
              }
              
              // Si on n'a pas assez de cartes, on en ajoute
              while (updatedCards.length < totalCards) {
                updatedCards.push({
                  id: `my-card-filler-${Date.now()}-${Math.random()}`,
                  value: -1,
                  isFlipped: false
                });
              }
            }
            
            console.log(`✅ Updated my cards (player1, en haut). Now has ${updatedCards.length} cards`);
            return updatedCards;
          });
        } else {
          // Je suis player2 (en bas)
          setPlayer2Cards(prev => {
            // Créer un nouveau tableau avec le bon nombre de cartes
            let updatedCards = [...prev];
            
            // Si c'est une défausse rapide, supprimer la carte à l'index spécifié
            if (quickDiscard && cardIndex < updatedCards.length) {
              console.log(`❗ Removing card at index ${cardIndex} for quick discard`);
              updatedCards = [...updatedCards.slice(0, cardIndex), ...updatedCards.slice(cardIndex + 1)];
            }
            
            // S'assurer que le tableau a exactement le bon nombre de cartes
            if (totalCards && updatedCards.length !== totalCards) {
              console.log(`❗ Fixing card count: current=${updatedCards.length}, should be=${totalCards}`);
              
              // Si on a trop de cartes, on les supprime
              if (updatedCards.length > totalCards) {
                updatedCards = updatedCards.slice(0, totalCards);
              }
              
              // Si on n'a pas assez de cartes, on en ajoute
              while (updatedCards.length < totalCards) {
                updatedCards.push({
                  id: `my-card-filler-${Date.now()}-${Math.random()}`,
                  value: -1,
                  isFlipped: false
                });
              }
            }
            
            console.log(`✅ Updated my cards (player2, en bas). Now has ${updatedCards.length} cards`);
            return updatedCards;
          });
        }
      }
      
      console.log(`✅ Discard pile updated - Card: ${card}`);
    };
    
    // Écouter quand une carte est remplacée
    const handleCardReplaced = (data: any) => {
      console.log('🔄 Card replaced:', data);
      const { playerId, cardIndex, discardedCard, newCard, newCardValue, totalCards } = data;
      
      // Mettre à jour la défausse (discardedCard peut être un objet ou une valeur)
      const discardValue = typeof discardedCard === 'object' && discardedCard !== null
        ? discardedCard.value
        : discardedCard;
      setDiscardPile(discardValue);
      console.log(`✅ Updated discard pile with card value: ${discardValue}`);
      console.log(`✅ New card value: ${newCardValue}`);
      
      // Si c'est l'adversaire qui a remplacé une carte
      if (playerId !== tableData?.currentUserId) {
        // Déterminer quelle liste de cartes mettre à jour en fonction de amIPlayer1
        if (amIPlayer1) {
          // Je suis player1 (en haut), l'adversaire est player2 (en bas)
          setPlayer2Cards(prev => {
            // Créer un nouveau tableau avec le bon nombre de cartes
            let updatedCards = [...prev];
            
            // S'assurer que le tableau a exactement le bon nombre de cartes
            if (totalCards && updatedCards.length !== totalCards) {
              console.log(`❗ Fixing card count: current=${updatedCards.length}, should be=${totalCards}`);
              
              // Si on a trop de cartes, on les supprime
              if (updatedCards.length > totalCards) {
                updatedCards = updatedCards.slice(0, totalCards);
              }
              
              // Si on n'a pas assez de cartes, on en ajoute
              while (updatedCards.length < totalCards) {
                updatedCards.push({
                  id: `opponent-card-filler-${Date.now()}-${Math.random()}`,
                  value: -1,
                  isFlipped: false
                });
              }
            }
            
            // Mettre à jour la carte à l'index spécifié avec la nouvelle valeur
            if (cardIndex < updatedCards.length && newCardValue !== undefined) {
              updatedCards[cardIndex] = {
                id: `opponent-card-${Date.now()}-${Math.random()}`,
                value: newCardValue, // Utiliser la valeur de la nouvelle carte
                isFlipped: false
              };
              console.log(`✅ Updated opponent's card at index ${cardIndex} with value ${newCardValue}`);
            }
            
            console.log(`✅ Updated opponent's cards (player2, en bas). Now has ${updatedCards.length} cards.`);
            return updatedCards;
          });
        } else {
          // Je suis player2 (en bas), l'adversaire est player1 (en haut)
          setPlayer1Cards(prev => {
            // Créer un nouveau tableau avec le bon nombre de cartes
            let updatedCards = [...prev];
            
            // S'assurer que le tableau a exactement le bon nombre de cartes
            if (totalCards && updatedCards.length !== totalCards) {
              console.log(`❗ Fixing card count: current=${updatedCards.length}, should be=${totalCards}`);
              
              // Si on a trop de cartes, on les supprime
              if (updatedCards.length > totalCards) {
                updatedCards = updatedCards.slice(0, totalCards);
              }
              
              // Si on n'a pas assez de cartes, on en ajoute
              while (updatedCards.length < totalCards) {
                updatedCards.push({
                  id: `opponent-card-filler-${Date.now()}-${Math.random()}`,
                  value: -1,
                  isFlipped: false
                });
              }
            }
            
            // Mettre à jour la carte à l'index spécifié avec la nouvelle valeur
            if (cardIndex < updatedCards.length && newCardValue !== undefined) {
              updatedCards[cardIndex] = {
                id: `opponent-card-${Date.now()}-${Math.random()}`,
                value: newCardValue, // Utiliser la valeur de la nouvelle carte
                isFlipped: false
              };
              console.log(`✅ Updated opponent's card at index ${cardIndex} with value ${newCardValue}`);
            }
            
            console.log(`✅ Updated opponent's cards (player1, en haut). Now has ${updatedCards.length} cards.`);
            return updatedCards;
          });
        }
      } else {
        // C'est moi qui ai remplacé une carte (ne devrait pas arriver car déjà géré localement)
        console.log(`ℹ️ Received my own card replacement event from server (unusual)`);
      }
    };
    
    // Écouter la réception des cartes de pénalité (seulement pour le joueur pénalisé)
    const handlePenaltyCardsReceived = (data: any) => {
      console.log('📥 Penalty cards received:', data);
      const { cards, totalCards } = data;
      console.log(`  → Total cards after penalty: ${totalCards}`);
      
      // Déterminer quelle liste de cartes mettre à jour en fonction de amIPlayer1
      if (amIPlayer1) {
        // Je suis player1, mes cartes sont dans player1Cards (en haut)
        setPlayer1Cards(prev => {
          // Créer un nouveau tableau avec le bon nombre de cartes
          let newCards = [...prev];
          
          // S'assurer que le tableau a exactement le bon nombre de cartes
          if (totalCards) {
            console.log(`  → ❗ Checking card count: current=${newCards.length}, should be=${totalCards} after adding ${cards.length} cards`);
            
            // Si on a trop de cartes, on les supprime
            if (newCards.length > totalCards - cards.length) {
              console.log(`  → ❗ Removing ${newCards.length - (totalCards - cards.length)} excess cards`);
              newCards = newCards.slice(0, totalCards - cards.length);
            }
          }
          
          // Ajouter les nouvelles cartes de pénalité
          cards.forEach((cardValue: number) => {
            newCards.push({
              id: `penalty-${Date.now()}-${Math.random()}`,
              value: cardValue,
              isFlipped: false
            });
          });
          
          console.log(`  → Updated my cards (player1). Now has ${newCards.length} cards`);
          return newCards;
        });
      } else {
        // Je suis player2, mes cartes sont dans player2Cards (en bas)
        setPlayer2Cards(prev => {
          // Créer un nouveau tableau avec le bon nombre de cartes
          let newCards = [...prev];
          
          // S'assurer que le tableau a exactement le bon nombre de cartes
          if (totalCards) {
            console.log(`  → ❗ Checking card count: current=${newCards.length}, should be=${totalCards} after adding ${cards.length} cards`);
            
            // Si on a trop de cartes, on les supprime
            if (newCards.length > totalCards - cards.length) {
              console.log(`  → ❗ Removing ${newCards.length - (totalCards - cards.length)} excess cards`);
              newCards = newCards.slice(0, totalCards - cards.length);
            }
          }
          
          // Ajouter les nouvelles cartes de pénalité
          cards.forEach((cardValue: number) => {
            newCards.push({
              id: `penalty-${Date.now()}-${Math.random()}`,
              value: cardValue,
              isFlipped: false
            });
          });
          
          console.log(`  → Updated my cards (player2). Now has ${newCards.length} cards`);
          return newCards;
        });
      }
      
      console.log(`✅ Added ${cards.length} penalty cards to my hand`);
    };
    
    // Écouter la pénalité de défausse rapide (pour TOUS les joueurs)
    const handleQuickDiscardPenaltyApplied = async (data: any) => {
      console.log('📥 Quick discard penalty applied:', data);
      const { playerId, playerName, cardIndex, totalCards, penaltyCards } = data;
      console.log(`  → Penalty player: ${playerId} (${playerName})`);
      console.log(`  → Card index: ${cardIndex}`);
      console.log(`  → Total cards after penalty: ${totalCards}`);
      console.log(`  → Penalty cards: ${penaltyCards ? penaltyCards.join(', ') : 'not provided'}`);
      
      // Afficher l'overlay de pénalité
      setIsInPenalty(true);
      setFaultyCardIndex(cardIndex);
      
      // Déterminer si c'est moi qui ai la pénalité
      const isMe = playerId === tableData?.currentUserId;
      console.log(`  → Is it me? ${isMe}`);
      
      // Déterminer quel joueur a la pénalité (pour l'affichage visuel)
      const penaltyPlayerKey = isMe 
        ? (amIPlayer1 ? 'player1' : 'player2')
        : (amIPlayer1 ? 'player2' : 'player1');
      setPenaltyPlayer(penaltyPlayerKey);
      
      // TOUS les joueurs doivent voir visuellement 2 cartes ajoutées
      console.log('  → Checking penalty target...');
      if (!isMe) {
        // C'est l'ADVERSAIRE qui a la pénalité
        // Déterminer quelle liste de cartes mettre à jour en fonction de amIPlayer1
        console.log('  → 🏹 ADVERSAIRE has penalty - Updating opponent cards');
        
        if (amIPlayer1) {
          // Je suis player1 (en haut), l'adversaire est player2 (en bas)
          console.log('  → I am player1, updating player2Cards (opponent)');
          setPlayer2Cards(prev => {
            console.log('  → Inside setPlayer2Cards - Current length:', prev.length);
            
            // Créer un nouveau tableau avec le bon nombre de cartes
            let newCards = [...prev];
            
            // S'assurer que le tableau a exactement le bon nombre de cartes
            if (totalCards) {
              console.log(`  → ❗ Checking card count: current=${newCards.length}, should be=${totalCards}`);
              
              // Si on a trop de cartes, on les supprime
              if (newCards.length > totalCards - (penaltyCards?.length || 2)) {
                console.log(`  → ❗ Removing ${newCards.length - (totalCards - (penaltyCards?.length || 2))} excess cards`);
                newCards = newCards.slice(0, totalCards - (penaltyCards?.length || 2));
              }
              
              // Ajouter les cartes de pénalité avec leurs vraies valeurs
              if (penaltyCards && penaltyCards.length > 0) {
                console.log(`  → ❗ Adding ${penaltyCards.length} penalty cards with real values: ${penaltyCards.join(', ')}`);
                penaltyCards.forEach((cardValue: number, idx: number) => {
                  newCards.push({
                    id: `penalty-opp-${Date.now()}-${idx}-${Math.random()}`,
                    value: cardValue,
                    isFlipped: false
                  });
                });
              } else {
                // Fallback si penaltyCards n'est pas défini
                console.log(`  → ❗ penaltyCards not provided, adding 2 generic cards`);
                while (newCards.length < totalCards) {
                  newCards.push({
                    id: `penalty-opp-${Date.now()}-${Math.random()}`,
                    value: -1,
                    isFlipped: false
                  });
                }
              }
            } else {
              // Si totalCards n'est pas défini, on ajoute simplement 2 cartes
              console.log(`  → ❗ totalCards not defined, adding 2 cards`);
              if (penaltyCards && penaltyCards.length > 0) {
                penaltyCards.forEach((cardValue: number, idx: number) => {
                  newCards.push({
                    id: `penalty-opp-${Date.now()}-${idx}`,
                    value: cardValue,
                    isFlipped: false
                  });
                });
              } else {
                newCards.push(
                  { id: `penalty-opp-${Date.now()}-1`, value: -1, isFlipped: false },
                  { id: `penalty-opp-${Date.now()}-2`, value: -1, isFlipped: false }
                );
              }
            }
            
            console.log('  → Inside setPlayer2Cards - New length:', newCards.length);
            return newCards;
          });
          console.log('  → setPlayer2Cards called!');
        } else {
          // Je suis player2 (en bas), l'adversaire est player1 (en haut)
          console.log('  → I am player2, updating player1Cards (opponent)');
          setPlayer1Cards(prev => {
            console.log('  → Inside setPlayer1Cards - Current length:', prev.length);
            
            // Créer un nouveau tableau avec le bon nombre de cartes
            let newCards = [...prev];
            
            // S'assurer que le tableau a exactement le bon nombre de cartes
            if (totalCards) {
              console.log(`  → ❗ Checking card count: current=${newCards.length}, should be=${totalCards}`);
              
              // Si on a trop de cartes, on les supprime
              if (newCards.length > totalCards - (penaltyCards?.length || 2)) {
                console.log(`  → ❗ Removing ${newCards.length - (totalCards - (penaltyCards?.length || 2))} excess cards`);
                newCards = newCards.slice(0, totalCards - (penaltyCards?.length || 2));
              }
              
              // Ajouter les cartes de pénalité avec leurs vraies valeurs
              if (penaltyCards && penaltyCards.length > 0) {
                console.log(`  → ❗ Adding ${penaltyCards.length} penalty cards with real values: ${penaltyCards.join(', ')}`);
                penaltyCards.forEach((cardValue: number, idx: number) => {
                  newCards.push({
                    id: `penalty-opp-${Date.now()}-${idx}-${Math.random()}`,
                    value: cardValue,
                    isFlipped: false
                  });
                });
              } else {
                // Fallback si penaltyCards n'est pas défini
                console.log(`  → ❗ penaltyCards not provided, adding 2 generic cards`);
                while (newCards.length < totalCards) {
                  newCards.push({
                    id: `penalty-opp-${Date.now()}-${Math.random()}`,
                    value: -1,
                    isFlipped: false
                  });
                }
              }
            } else {
              // Si totalCards n'est pas défini, on ajoute simplement 2 cartes
              console.log(`  → ❗ totalCards not defined, adding 2 cards`);
              if (penaltyCards && penaltyCards.length > 0) {
                penaltyCards.forEach((cardValue: number, idx: number) => {
                  newCards.push({
                    id: `penalty-opp-${Date.now()}-${idx}`,
                    value: cardValue,
                    isFlipped: false
                  });
                });
              } else {
                newCards.push(
                  { id: `penalty-opp-${Date.now()}-1`, value: -1, isFlipped: false },
                  { id: `penalty-opp-${Date.now()}-2`, value: -1, isFlipped: false }
                );
              }
            }
            
            console.log('  → Inside setPlayer1Cards - New length:', newCards.length);
            return newCards;
          });
          console.log('  → setPlayer1Cards called!');
        }
      } else {
        // C'est MOI qui ai la pénalité
        // Mes vraies cartes seront ajoutées via handlePenaltyCardsReceived
        console.log('  → 🎯 I have penalty - Waiting for real penalty cards via game:penalty_cards_received');
      }
      
      // Attendre que les 2 cartes soient ajoutées (game:penalty_cards_received pour moi)
      // Puis retourner la carte fautive face cachée après 1s
      setTimeout(() => {
        if (isMe) {
          // C'est moi qui ai la pénalité - retourner la carte fautive face cachée
          // Je suis TOUJOURS affiché en bas (player2Cards)
          setPlayer2Cards(prev => prev.map((card, idx) => 
            idx === cardIndex ? { ...card, isFlipped: false } : card
          ));
        } else {
          // C'est l'adversaire - retourner la carte fautive face cachée
          // L'adversaire est TOUJOURS affiché en haut (player1Cards)
          setPlayer1Cards(prev => prev.map((card, idx) => 
            idx === cardIndex ? { ...card, isFlipped: false } : card
          ));
        }
      }, 1000);
      
      // Attendre 3 secondes puis retirer les overlays
      await new Promise(resolve => setTimeout(resolve, 3000));
      setPenaltyCue(false);
      setShowPenaltyDim(false);
      setIsInPenalty(false);
      setPenaltyPlayer(null);
      
      console.log(`✅ Penalty animation completed for ${playerName}`);
    };

    // Écouter l'activation des pouvoirs des cartes figures
    const handlePowerActivated = (data: any) => {
      console.log('👑 Power activated event received:', data);
      const { playerId, powerType, message } = data;
      
      // Afficher un message pour indiquer que le pouvoir est activé
      console.log(`  → ${message}`);
      
      // IMPORTANT: Ne mettre à jour l'état local QUE si c'est un autre joueur qui active un pouvoir
      // Si c'est nous qui activons le pouvoir, nous avons déjà mis à jour l'état localement
      if (playerId !== tableData?.currentUserId) {
        console.log(`  → Autre joueur (${playerId}) a activé le pouvoir ${powerType}`);
        if (powerType === 'jack') {
          setIsJackPowerActive(true);
          setJackCue(true);
          setTimeout(() => setJackCue(false), 900);
        } else if (powerType === 'queen') {
          setIsQueenPowerActive(true);
          setQueenCue(true);
          setTimeout(() => setQueenCue(false), 900);
        } else if (powerType === 'king') {
          setIsKingPowerActive(true);
          setKingSelections([]);
          setPowerCue(true);
          setTimeout(() => setPowerCue(false), 900);
        }
      } else {
        console.log(`  → C'est moi qui ai activé le pouvoir ${powerType}, pas besoin de mettre à jour l'état local`);
      }
      
      // Le serveur va envoyer une mise à jour du minuteur avec phase='power_active'
    };
    
    // Écouter l'échange de cartes avec le pouvoir du Roi
    const handleKingSwapCards = (data: any) => {
      console.log('👑 King swap cards event received:', data);
      const { playerId, card1, card2 } = data;
      
      // Ne pas traiter notre propre événement (déjà appliqué localement)
      if (playerId === tableData?.currentUserId) {
        console.log('  → Ignoring my own king swap event');
        return;
      }
      
      console.log('  → Processing king swap from other player');
      console.log('  → Card 1:', card1);
      console.log('  → Card 2:', card2);
      
      // IMPORTANT: Inverser les positions car l'autre joueur voit le plateau à l'envers
      // Si l'autre joueur dit 'top', c'est 'bottom' pour nous, et vice versa
      const invertPosition = (pos: 'top' | 'bottom'): 'top' | 'bottom' => {
        return pos === 'top' ? 'bottom' : 'top';
      };
      
      // Fonction pour appliquer l'échange sur une carte
      const applySwap = (p: 'top'|'bottom', idx: number, newVal: number) => {
        // Inverser la position car l'autre joueur voit le plateau à l'envers
        const adjustedPosition = invertPosition(p);
        console.log(`  → Original position: ${p}, Adjusted position: ${adjustedPosition}`);
        console.log(`  → Applying swap to ${adjustedPosition} card at index ${idx}, new value: ${newVal}`);
        
        if (adjustedPosition === 'top') {
          setPlayer1Cards(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], value: newVal, isFlipped: false };
            return next;
          });
        } else {
          setPlayer2Cards(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], value: newVal, isFlipped: false };
            return next;
          });
        }
      };
      
      // Appliquer les échanges en inversant les positions
      applySwap(card1.position, card1.index, card1.newValue);
      applySwap(card2.position, card2.index, card2.newValue);
      
      console.log('  → King swap applied successfully on my side');
    };
    
    // Écouter la déclaration de Bombom
    const handleBombomDeclared = (data: any) => {
      console.log('🍬 Bombom declared event received:', data);
      const { playerId, player } = data;
      
      // Ne pas traiter notre propre événement (déjà appliqué localement)
      if (playerId === tableData?.currentUserId) {
        console.log('  → Ignoring my own bombom declaration event');
        return;
      }
      
      console.log('  → Processing bombom declaration from other player');
      
      // Mettre à jour l'état local pour refuser d'autres déclarations Bombom
      setBombomDeclaredBy(player);
      
      // Afficher un message temporaire
      const who = player === 'player1' ? 'Joueur 1' : 'Joueur 2';
      setQuickDiscardFlash(`${who} a déclaré Bombom!`);
      setTimeout(() => setQuickDiscardFlash(null), 1000);
    };
    
    
    // Écouter le prompt Bombom (quand le tour revient au joueur qui a déclaré Bombom)
    const handleBombomPrompt = (data: any) => {
      console.log('🍬 Bombom prompt received:', data);
      const { player, playerId } = data;
      
      // Vérifier si c'est bien pour ce joueur
      if (playerId && playerId !== tableData?.currentUserId) {
        console.log('🍬 Bombom prompt not for this player, ignoring');
        return;
      }
      
      // Arrêter tous les timers pour éviter les conflits
      if (timerRef.current) {
        console.log('🍬 Stopping game timer for Bombom prompt');
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      // Arrêter un éventuel timer Bombom précédent
      if (bombomTimerRef.current) {
        clearTimeout(bombomTimerRef.current);
        bombomTimerRef.current = null;
      }
      
      // Désactiver l'état de tour du joueur pour bloquer les actions
      setIsPlayerTurn(false);
      
      // Vérifier si l'annulation a déjà été utilisée
      const myPlayerKey = amIPlayer1 ? 'player1' : 'player2';
      const canCancel = !bombomCancelUsed[myPlayerKey];
      console.log('🍬 Bombom cancel state:', { myPlayerKey, canCancel, bombomCancelUsed });
      
      if (!canCancel) {
        // Si l'annulation a déjà été utilisée, déclencher ShowTime directement
        console.log('🍬 Annulation déjà utilisée, déclenchement automatique de ShowTime');
        // Fermer d'abord le prompt s'il est ouvert
        setShowShowTimePrompt(false);
        // Puis déclencher ShowTime après une courte pause
        setTimeout(() => triggerShowTime(), 50);
      } else {
        // Sinon, afficher le prompt ShowTime
        console.log('🍬 Showing ShowTime prompt for player', player);
        setShowShowTimePrompt(true);
        
        // Démarrer un timer de 5 secondes pour déclencher automatiquement ShowTime si le joueur ne fait rien
        console.log('🕔 Starting 5-second timer for automatic ShowTime');
        bombomTimerRef.current = setTimeout(() => {
          console.log('🕔 Bombom prompt timeout - Triggering ShowTime automatically');
          setShowShowTimePrompt(false);
          setTimeout(() => triggerShowTime(), 50);
        }, 5000); // 5 secondes
      }
    };
    
    // Écouter la fin des pouvoirs des cartes figures
    const handlePowerCompleted = (data: any) => {
      console.log('👑 Power completed event received:', data);
      const { playerId, powerType, message } = data;
      
      // Afficher un message pour indiquer que le pouvoir est terminé
      console.log(`  → ${message}`);
      
      // Réinitialiser les états des pouvoirs, peu importe qui a terminé le pouvoir
      if (powerType === 'jack') {
        setIsJackPowerActive(false);
        // Réinitialiser la référence et le blocage global pour permettre une nouvelle activation du pouvoir
        jackPowerUsedRef.current = false;
        setJackCardSelected(false);
        setAnyPowerActive(false); // Réinitialiser la variable pour permettre l'affichage du menu
        console.log('  → Jack power reference and global block reset');
      } else if (powerType === 'queen') {
        setIsQueenPowerActive(false);
        // Réinitialiser le blocage global pour permettre une nouvelle activation du pouvoir
        setQueenCardSelected(false);
        setAnyPowerActive(false); // Réinitialiser la variable pour permettre l'affichage du menu
        console.log('  → Queen power global block reset');
      } else if (powerType === 'king') {
        setIsKingPowerActive(false);
        setKingPowerActivated(false); // Réinitialiser la variable pour permettre une nouvelle activation
        setAnyPowerActive(false); // Réinitialiser la variable pour permettre l'affichage du menu
        setKingSelections([]);
      }
      
      // Si c'est un autre joueur qui a terminé son pouvoir, s'assurer que l'état local est cohérent
      if (playerId !== tableData?.currentUserId) {
        setDrawnCard(null);
        setShowCardActions(false);
      }
      
      // Forcer la mise à jour du timer pour éviter l'affichage de 30 secondes
      // Le serveur va envoyer une mise à jour du minuteur avec phase='game'
      // mais on force une mise à jour immédiate pour éviter un délai
      setTimerPhase('game');
      setTimeLeft(5); // Valeur par défaut du timer de jeu
    };

    // Écouter l'arrêt des timers (lors du ShowTime)
    const handleTimersStopped = (data: any) => {
      console.log('⏹️ Timers stopped event received:', data);
      
      // Arrêter tous les timers locaux
      if (timerRef.current) {
        console.log('⏹️ Stopping local game timer');
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      if (beforeRoundTimerRef.current) {
        console.log('⏹️ Stopping local memorization timer');
        clearInterval(beforeRoundTimerRef.current);
        beforeRoundTimerRef.current = null;
      }
      
      // Figer l'affichage du timer
      setTimeLeft(0);
    };
    
    // Écouter les mises à jour des timers
    const handleTimerUpdate = (data: any) => {
      console.log('⏱️ Timer update:', data);
      const { phase, memoTimeLeft: memo, gameTimeLeft: game, choiceTimeLeft: choice } = data;
      
      // IMPORTANT: Arrêter TOUS les timers locaux pour éviter les chevauchements
      if (timerRef.current) {
        console.log('⏸️ Stopping local game timer due to server timer update');
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (beforeRoundTimerRef.current) {
        console.log('⏸️ Stopping local memorization timer due to server timer update');
        clearInterval(beforeRoundTimerRef.current);
        beforeRoundTimerRef.current = null;
      }
      
      // Ne pas mettre à jour les timers si ShowTime est en cours
      if (showShowTimePrompt) {
        console.log('🍬 ShowTime prompt actif, ignorer la mise à jour des timers');
        return;
      }
      
      setTimerPhase(phase);
      setMemoTimeLeft(memo);
      setGameTimeLeft(game);
      setChoiceTimeLeft(choice);
      
      // Mettre à jour timeLeft pour l'affichage (selon la phase active)
      if (phase === 'memorization') {
        console.log(`  → Setting timeLeft to ${memo} (memorization)`);
        setTimeLeft(memo);
        
        // Si la mémorisation se termine, retourner toutes les cartes face cachée
        if (memo === 0) {
          console.log('✅ Memorization phase ended - Starting game');
          setIsMemorizationPhase(false);
          setPlayer1Cards(cards => cards.map(c => ({ ...c, isFlipped: false })));
          setPlayer2Cards(cards => cards.map(c => ({ ...c, isFlipped: false })));
          setMemorizedCardsCount(0);
          setMemorizedCardIndexes([]);
          
          // Activer la défausse rapide
          setQuickDiscardActive(true);
          console.log('✅ Quick discard activated');
          
          // Afficher "Mémorisation terminée" pendant 1.5s
          setShowMemorizationEndOverlay(true);
          setTimeout(() => {
            setShowMemorizationEndOverlay(false);
          }, 1500);
        }
      } else if (phase === 'game') {
        console.log(`  → Setting timeLeft to ${game} (game), isPlayerTurn: ${isPlayerTurnRef.current}`);
        setTimeLeft(game);
        
        // Si le timer de jeu arrive à 0 ET que c'est mon tour, émettre le timeout
        if (game === 0 && isPlayerTurnRef.current) {
          console.log('⏰ Game timer expired - emitting turn timeout');
          socket.emit('game:turn_timeout', {
            tableId: tableData?.tableId,
            userId: tableData?.currentUserId
          });
        }
      } else if (phase === 'choice') {
        setTimeLeft(choice);
        
        // Si le timer de choix arrive à 0 ET que j'ai une carte piochée, émettre le timeout
        if (choice === 0 && drawnCardRef.current) {
          console.log('⏰ Choice timer expired - emitting choice timeout');
          console.log('  → drawnCard value:', drawnCardRef.current.value);
          socket.emit('game:choice_timeout', {
            tableId: tableData?.tableId,
            userId: myPlayerInfo?.userId,
            drawnCard: drawnCardRef.current.value
          });
        } else if (choice === 0 && !drawnCardRef.current) {
          console.log('⚠️ Choice timer expired but no drawnCard!');
        }
      } else if (phase === 'power_active') {
        // Pendant l'activation d'un pouvoir, on affiche un minuteur fixe
        setTimeLeft(30); // Valeur arbitraire pour montrer que le timer est en pause
        console.log('👑 Power active phase - timer paused');
      }
    };
    
    // Retirer TOUS les anciens listeners pour éviter les doublons
    // On utilise socket.off(event) sans handler pour retirer TOUS les listeners de cet événement
    socket.off('player:ready_changed');
    socket.off('game:auto_start');
    socket.off('game:cards_dealt');
    socket.off('game:player_quit');
    socket.off('game:turn_changed');
    socket.off('game:card_drawn');
    socket.off('game:opponent_drew_card');
    socket.off('game:card_discarded');
    socket.off('game:card_replaced');
    socket.off('game:penalty_cards_received');
    socket.off('game:quick_discard_penalty_applied');
    socket.off('game:power_activated');
    socket.off('game:power_completed');
    socket.off('game:king_swap_cards');
    socket.off('game:timer_update');
    
    // Enregistrer les nouveaux listeners
    socket.on('player:ready_changed', handleReadyChanged);
    socket.on('game:auto_start', handleAutoStart);
    socket.on('game:cards_dealt', handleCardsDealt);
    socket.on('game:player_quit', handlePlayerQuit);
    socket.on('game:turn_changed', handleTurnChanged);
    socket.on('game:card_drawn', handleCardDrawn);
    socket.on('game:opponent_drew_card', handleOpponentDrewCard);
    socket.on('game:card_discarded', handleCardDiscarded);
    socket.on('game:card_replaced', handleCardReplaced);
    socket.on('game:penalty_cards_received', handlePenaltyCardsReceived);
    socket.on('game:quick_discard_penalty_applied', handleQuickDiscardPenaltyApplied);
    socket.on('game:power_activated', handlePowerActivated);
    socket.on('game:power_completed', handlePowerCompleted);
    socket.on('game:king_swap_cards', handleKingSwapCards);
    socket.on('game:timer_update', handleTimerUpdate);
    socket.on('game:bombom_declared', handleBombomDeclared);
    socket.on('game:bombom_prompt', handleBombomPrompt);
    socket.on('game:timers_stopped', handleTimersStopped);
    socket.on('game:showtime', handleShowTime);

    return () => {
      // Retirer TOUS les listeners sans passer les handlers
      socket.off('playerJoined');
      socket.off('table_updated');
      socket.off('player:ready_changed');
      socket.off('game:auto_start');
      socket.off('game:cards_dealt');
      socket.off('game:player_quit');
      socket.off('game:turn_changed');
      socket.off('game:card_drawn');
      socket.off('game:opponent_drew_card');
      socket.off('game:card_discarded');
      socket.off('game:card_replaced');
      socket.off('game:penalty_cards_received');
      socket.off('game:quick_discard_penalty_applied');
      socket.off('game:power_activated');
      socket.off('game:power_completed');
      socket.off('game:king_swap_cards');
      socket.off('game:timer_update');
      socket.off('game:bombom_declared');
      socket.off('game:bombom_prompt');
      socket.off('game:timers_stopped');
      socket.off('game:showtime');
      socket.emit('leaveTableRoom', tableData.tableId);
      hasJoinedRoom.current = false; // Réinitialiser pour permettre de rejoindre si on revient
    };
  }, [socket, tableData?.tableId, tableData?.currentUserId, navigate]);

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
  const [timerPhase, setTimerPhase] = React.useState<'memorization' | 'game' | 'choice' | null>(null);
  const [memoTimeLeft, setMemoTimeLeft] = React.useState<number>(2);
  const [gameTimeLeft, setGameTimeLeft] = React.useState<number>(5);
  const [choiceTimeLeft, setChoiceTimeLeft] = React.useState<number>(10);
  
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
  const triggerShowTime = React.useCallback(async () => {
    console.log('🍬 Déclenchement de ShowTime!');
    
    // Arrêter TOUS les timers (locaux et serveur)
    if (timerRef.current) {
      console.log('⏹️ Arrêt du timer local de jeu');
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (beforeRoundTimerRef.current) {
      console.log('⏹️ Arrêt du timer local de mémorisation');
      clearInterval(beforeRoundTimerRef.current);
      beforeRoundTimerRef.current = null;
    }
    
    // Informer le serveur d'arrêter les timers
    if (socket && tableData?.tableId) {
      console.log('💬 Demande au serveur d\'arrêter les timers');
      socket.emit('game:stop_timers', {
        tableId: tableData.tableId,
        userId: tableData.currentUserId
      });
      
      // Informer le serveur de déclencher le ShowTime pour tous les joueurs
      console.log('🍬 Émission de game:trigger_showtime au serveur');
      socket.emit('game:trigger_showtime', {
        tableId: tableData.tableId,
        userId: tableData.currentUserId
      });
    }
    
    // Nettoyer état Bombom
    setBombomDeclaredBy(null);
    setShowShowTimePrompt(false);
  }, [socket, tableData]);
  
  // Gestionnaire pour l'événement game:showtime (envoyé par le serveur à tous les joueurs)
  const handleShowTime = React.useCallback(async (data: any) => {
    console.log('🍬 ShowTime event received:', data);
    const { player1Cards: p1Cards, player2Cards: p2Cards, player1Id } = data;
    
    // Déterminer si je suis player1 ou player2 dans la partie
    const myUserId = tableData?.currentUserId;
    const iAmPlayer1 = myUserId === player1Id;
    
    // IMPORTANT: Chaque joueur doit toujours voir ses propres cartes en bas (player2)
    // et les cartes adverses en haut (player1), même après le ShowTime
    if (iAmPlayer1) {
      // Si je suis player1, mes cartes sont p1Cards et doivent être affichées en bas (player2)
      console.log('🍬 Je suis player1, mes cartes sont affichées en bas');
      setPlayer2Cards(p1Cards.map((c: any) => ({ ...c, isFlipped: true })));
      setPlayer1Cards(p2Cards.map((c: any) => ({ ...c, isFlipped: true })));
    } else {
      // Si je suis player2, mes cartes sont p2Cards et doivent être affichées en bas (player2)
      console.log('🍬 Je suis player2, mes cartes sont affichées en bas');
      setPlayer1Cards(p1Cards.map((c: any) => ({ ...c, isFlipped: true })));
      setPlayer2Cards(p2Cards.map((c: any) => ({ ...c, isFlipped: true })));
    }
    
    // Attendre que les cartes soient retournées avant de calculer
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Animation de calcul des points
    console.log('📊 Calcul des points...');
    
    // Calculer les points carte par carte avec animation
    let p1Total = 0;
    let p2Total = 0;
    
    // Afficher un message pour le début du calcul
    setQuickDiscardFlash('Calcul des points...');
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Calculer et afficher les points du joueur 1 (cartes du serveur)
    for (const card of p1Cards) {
      if (card.value !== -1) {
        const points = getCardScore(card.value);
        p1Total += points;
        // Adapter l'affichage en fonction de qui je suis
        const displayName = iAmPlayer1 ? 'Toi' : 'Adversaire';
        setQuickDiscardFlash(`${displayName}: +${points} points (${p1Total} total)`);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    // Afficher le total du joueur 1
    const player1DisplayName = iAmPlayer1 ? 'Toi' : 'Adversaire';
    setQuickDiscardFlash(`${player1DisplayName}: ${p1Total} points au total`);
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Calculer et afficher les points du joueur 2 (cartes du serveur)
    for (const card of p2Cards) {
      if (card.value !== -1) {
        const points = getCardScore(card.value);
        p2Total += points;
        // Adapter l'affichage en fonction de qui je suis
        const displayName = iAmPlayer1 ? 'Adversaire' : 'Toi';
        setQuickDiscardFlash(`${displayName}: +${points} points (${p2Total} total)`);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    // Afficher le total du joueur 2
    const player2DisplayName = iAmPlayer1 ? 'Adversaire' : 'Toi';
    setQuickDiscardFlash(`${player2DisplayName}: ${p2Total} points au total`);
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Déterminer le gagnant (le joueur avec le MOINS de points gagne)
    let winnerKey: 'player1' | 'player2' | null = null;
    if (p1Total < p2Total) {
      winnerKey = 'player1';
      setQuickDiscardFlash(`${player1DisplayName} gagne avec ${p1Total} points contre ${p2Total}!`);
    } else if (p2Total < p1Total) {
      winnerKey = 'player2';
      setQuickDiscardFlash(`${player2DisplayName} gagne avec ${p2Total} points contre ${p1Total}!`);
    } else {
      setQuickDiscardFlash(`Égalité! ${p1Total} points partout!`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    setQuickDiscardFlash(null);
    
    // Déterminer si le joueur actuel a gagné ou perdu
    let iWon = false;
    
    if (winnerKey === 'player1' && iAmPlayer1) iWon = true;
    if (winnerKey === 'player2' && !iAmPlayer1) iWon = true;
    
    // Affichage overlay victoire/égalité personnalisé
    if (winnerKey) {
      console.log(`🏆 Le gagnant est: ${winnerKey} avec ${winnerKey === 'player1' ? p1Total : p2Total} points`);
      console.log(`🏆 Le joueur actuel a ${iWon ? 'gagné' : 'perdu'} la manche`);
      
      // Utiliser iWon pour déterminer quel joueur a gagné
      // Cela permet d'afficher le bon message même si les cartes sont inversées
      setWinner(iWon ? (iAmPlayer1 ? 'player1' : 'player2') : (iAmPlayer1 ? 'player2' : 'player1'));
      setShowVictory(true);
    }

    // Après 2.5s, mettre à jour scores et afficher scoreboard
    setTimeout(() => {
      setShowVictory(false);
      if (winnerKey) {
        const loserKey: 'player1' | 'player2' = winnerKey === 'player1' ? 'player2' : 'player1';
        const loserTotal = loserKey === 'player1' ? p1Total : p2Total;
        setScores(prev => ({
          player1: prev.player1 + (loserKey === 'player1' ? loserTotal : 0),
          player2: prev.player2 + (loserKey === 'player2' ? loserTotal : 0)
        }));
      }
      setShowScoreboard(true);
    }, 2500);
  }, [tableData]);
  
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
  const canDeclareBombomFor = React.useCallback((player: 'player1' | 'player2') => {
    // Vérifier si c'est le tour du joueur correspondant
    const correctPhase = (gamePhase === 'player1_turn' && player === 'player1') || (gamePhase === 'player2_turn' && player === 'player2');
    
    // Déclarable uniquement pendant le tour du joueur, sans action en cours, et si aucun Bombom actif
    return correctPhase && isPlayerTurn && drawnCard === null && !selectingCardToReplace && !isInPenalty && bombomDeclaredBy === null;
  }, [gamePhase, isPlayerTurn, drawnCard, selectingCardToReplace, isInPenalty, bombomDeclaredBy]);

  const handleDeclareBombomFor = React.useCallback((player: 'player1' | 'player2') => {
    console.log('🍬 Tentative de déclaration Bombom pour', player);
    
    // Vérifier si le joueur peut déclarer Bombom
    if (!canDeclareBombomFor(player)) {
      console.log('🔴 Impossible de déclarer Bombom:', { 
        player, 
        gamePhase, 
        isPlayerTurn, 
        drawnCard, 
        selectingCardToReplace, 
        isInPenalty, 
        bombomDeclaredBy 
      });
      return;
    }
    
    // Mettre à jour l'état pour indiquer que Bombom a été déclaré
    setBombomDeclaredBy(player);
    // Réinitialiser le suivi du tour passé à l'adversaire
    setBombomTurnPassedToOpponent(false);
    
    // Informer le serveur de la déclaration Bombom
    if (socket && tableData?.tableId) {
      socket.emit('game:bombom_declared', {
        tableId: tableData.tableId,
        userId: tableData.currentUserId,
        player: player
      });
    }
    
    // Afficher un message temporaire
    const who = player === 'player1' ? 'Joueur 1' : 'Joueur 2';
    setQuickDiscardFlash(`${who} a déclaré Bombom!`);
    setTimeout(() => setQuickDiscardFlash(null), 1000);
  }, [canDeclareBombomFor, socket, tableData]);

  const handleCancelBombom = React.useCallback(() => {
    // Déterminer quel joueur je suis
    const myPlayerKey = amIPlayer1 ? 'player1' : 'player2';
    
    // Annuler seulement lors du prompt au retour du tour, et seulement une fois par joueur
    if (!showShowTimePrompt) return;
    if (bombomCancelUsed[myPlayerKey]) return;
    
    console.log('🔄 Cancelling Bombom declaration');
    console.log('  → myPlayerKey:', myPlayerKey);
    console.log('  → bombomCancelUsed:', bombomCancelUsed);
    
    // Arrêter le timer Bombom s'il est en cours
    if (bombomTimerRef.current) {
      console.log('🕔 Stopping Bombom auto-ShowTime timer');
      clearTimeout(bombomTimerRef.current);
      bombomTimerRef.current = null;
    }
    
    // Mettre à jour l'état local
    setBombomCancelUsed(prev => ({ ...prev, [myPlayerKey]: true }));
    setBombomDeclaredBy(null);
    setShowShowTimePrompt(false);
    
    // Reprendre le tour normalement
    setIsPlayerTurn(true);
    
    // IMPORTANT: Arrêter tous les timers locaux pour éviter les chevauchements
    if (timerRef.current) {
      console.log('⏸️ Stopping local game timer');
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Demander au serveur de démarrer un nouveau tour
    if (tableData?.tableId && tableData?.currentUserId && socket) {
      console.log('💬 Emitting game:start_turn to server');
      socket.emit('game:start_turn', {
        tableId: tableData.tableId,
        userId: tableData.currentUserId,
        currentPlayerId: tableData.currentUserId
      });
    } else {
      // Mode local seulement (fallback)
      console.log('⚠️ No tableData or socket available, using local timer');
      setTimeLeft(7);
    }
  }, [showShowTimePrompt, bombomDeclaredBy, currentPlayer, bombomCancelUsed, socket, tableData]);

  // utilitaires déplacés dans ../utils/cards


  // Gère le clic sur une carte
  const handleCardClick = async (player: 'top' | 'bottom', index: number) => {
    // Vérifie si l'index est valide
    const handLength = (player === 'top' ? player1Cards.length : player2Cards.length);
    // Bloquer tous les clics si une carte a déjà été sélectionnée avec le pouvoir du Valet ou de la Dame
    if (index < 0 || index >= handLength || isInPenalty || jackCardSelected || queenCardSelected) return;
    
    const playerKey = player === 'top' ? 'player1' : 'player2';
    const playerCards = player === 'top' ? player1Cards : player2Cards;
    
    // PHASE DE MÉMORISATION : Cliquer sur 2 cartes maximum (seulement SES cartes = bottom)
    if (isMemorizationPhase && player === 'bottom') {
      // Si déjà 2 cartes mémorisées, ne rien faire
      if (memorizedCardsCount >= 2) {
        console.log('⚠️ Already memorized 2 cards');
        return;
      }
      
      // Si cette carte est déjà mémorisée, la retourner
      if (memorizedCardIndexes.includes(index)) {
        console.log(`🔄 Flipping card ${index} back`);
        setPlayer2Cards(prev => {
          const newCards = [...prev];
          newCards[index] = { ...newCards[index], isFlipped: false };
          return newCards;
        });
        setMemorizedCardIndexes(prev => prev.filter(i => i !== index));
        setMemorizedCardsCount(prev => prev - 1);
        return;
      }
      
      // Retourner la carte pour la voir
      console.log(`👁️ Memorizing card ${index}`);
      setPlayer2Cards(prev => {
        const newCards = [...prev];
        newCards[index] = { ...newCards[index], isFlipped: true };
        return newCards;
      });
      setMemorizedCardIndexes(prev => [...prev, index]);
      setMemorizedCardsCount(prev => prev + 1);
      return;
    }
    
    // Ne pas permettre de cliquer sur les cartes adverses pendant la mémorisation
    if (isMemorizationPhase && player === 'top') {
      console.log('⚠️ Cannot click opponent cards during memorization');
      return;
    }
    
    // Mode Powerful: défausser immédiatement la carte cliquée (si non vide)
    if (isPowerfulMode) {
      if (playerCards[index].value === -1) return;
      // Retourner la carte brièvement (facultatif)
      if (player === 'top') {
        setPlayer1Cards(prev => {
          const newCards = [...prev];
          newCards[index] = { ...newCards[index], isFlipped: true };
          return newCards;
        });
      } else {
        setPlayer2Cards(prev => {
          const newCards = [...prev];
          newCards[index] = { ...newCards[index], isFlipped: true };
          return newCards;
        });
      }

      const newCardsLocal = [...playerCards];
      const discardedCard = newCardsLocal[index].value;
      // Animation: carte depuis la main vers la défausse (1s)
      try {
        const oldCard = playerCards[index];
        const oldCardId = oldCard.id;
        let selEl = document.querySelector(`[data-player="${player}"][data-card-id="${oldCardId}"]`) as HTMLElement | null;
        if (!selEl) {
          selEl = document.querySelector(`[data-player="${player}"][data-card-index="${index}"]`) as HTMLElement | null;
        }
        const discardRect = discardRef.current?.getBoundingClientRect();
        if (selEl && discardRect) {
          selEl.style.visibility = 'hidden';
          const selRect = selEl.getBoundingClientRect();
          const selCenter = { x: selRect.left + selRect.width / 2, y: selRect.top + selRect.height / 2 };
          const discardCenter = { x: discardRect.left + discardRect.width / 2, y: discardRect.top + discardRect.height / 2 };

          setReplaceOutImage(getCardImage(discardedCard));
          setReplaceOutAnim({ from: selCenter, to: discardCenter, toPlayer: player, index, cardValue: discardedCard });
          await new Promise(resolve => setTimeout(resolve, 1000));
          setReplaceOutAnim(null);
          setReplaceOutImage(null);
        }
      } catch {}

      // Mettre à jour la défausse (après l'animation)
      setDiscardPile(discardedCard);
      if (quickDiscardActive) {
        const rank = getRankLabel(discardedCard);
        const who = (player === 'top') ? 'Joueur 1' : 'Joueur 2';
        setQuickDiscardFlash(`${who} a jeté ${rank}`);
        setTimeout(() => setQuickDiscardFlash(null), 1000);
      }

      // Retirer la carte du jeu
      if (player === 'top') {
        setPlayer1Cards(prev => {
          const updatedCards = [...prev];
          updatedCards[index] = { ...updatedCards[index], value: -1, isFlipped: false };
          return updatedCards;
        });
      } else {
        setPlayer2Cards(prev => {
          const updatedCards = [...prev];
          updatedCards[index] = { ...updatedCards[index], value: -1, isFlipped: false };
          return updatedCards;
        });
      }

      // Vérifier la victoire (ignorer pendant un remplacement en cours)
      if (selectingCardToReplace) {
        return;
      }
      // Vérifier la victoire
      const remainingCards = newCardsLocal.filter(card => card.value !== -1).length - 1; // on vient d'enlever 1
      if (remainingCards === 0) {
        setWinner(playerKey);
        setShowVictory(true);
        setIsPlayerTurn(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        // Calculer le score à ajouter pour le perdant (somme de ses cartes restantes)
        const loserKey: 'player1'|'player2' = playerKey === 'player1' ? 'player2' : 'player1';
        const loserCardsArr = loserKey === 'player1' ? player1Cards : player2Cards;
        const loserScoreToAdd = loserCardsArr.reduce((sum, c) => sum + getCardScore(c.value), 0);
        setTimeout(() => {
          setShowVictory(false);
          setScores(prev => ({
            player1: prev.player1 + (loserKey === 'player1' ? loserScoreToAdd : 0),
            player2: prev.player2 + (loserKey === 'player2' ? loserScoreToAdd : 0)
          }));
          setShowScoreboard(true);
        }, 3000);
      }
      return;
    }
    
    // Mode pouvoir du Roi: sélectionner 2 cartes et les échanger
    if (isKingPowerActive) {
      const sourceCards = player === 'top' ? player1Cards : player2Cards;
      // Ne pas permettre de sélectionner un slot vide
      if (sourceCards[index].value === -1) return;
      // Empêcher double sélection du même slot
      if (kingSelections.length === 1 && kingSelections[0].player === player && kingSelections[0].index === index) return;

      // Enregistrer la sélection
      const newSel = [...kingSelections, { player, index }];
      setKingSelections(newSel);

      // Si c'est la 1ère sélection, attendre la seconde
      if (newSel.length < 2) {
        return;
      }

      // Nous avons 2 sélections, lancer l'animation d'échange puis défausser le Roi
      const selA = newSel[0];
      const selB = newSel[1];

      try {
        // Récupérer les éléments DOM et positions
        const getEl = (p: 'top'|'bottom', idx: number, id: string | undefined) => {
          let el: HTMLElement | null = null;
          if (id) {
            el = document.querySelector(`[data-player="${p}"][data-card-id="${id}"]`) as HTMLElement | null;
          }
          if (!el) {
            el = document.querySelector(`[data-player="${p}"][data-card-index="${idx}"]`) as HTMLElement | null;
          }
          return el;
        };

        const aCards = selA.player === 'top' ? player1Cards : player2Cards;
        const bCards = selB.player === 'top' ? player1Cards : player2Cards;
        const aCard = aCards[selA.index];
        const bCard = bCards[selB.index];
        const aEl = getEl(selA.player, selA.index, aCard?.id);
        const bEl = getEl(selB.player, selB.index, bCard?.id);
        if (!aEl || !bEl) {
          // Sécurité: si pas d'éléments, on fait un swap logique sans animation
          await new Promise(r => setTimeout(r, 50));
        } else {
          // Masquer les sources
          aEl.style.visibility = 'hidden';
          bEl.style.visibility = 'hidden';
          const ar = aEl.getBoundingClientRect();
          const br = bEl.getBoundingClientRect();
          const aCenter = { x: ar.left + ar.width/2, y: ar.top + ar.height/2 };
          const bCenter = { x: br.left + br.width/2, y: br.top + br.height/2 };
          // Lancer deux cartes en vol (face down)
          setSwapAnimA({ from: aCenter, to: bCenter, toPlayer: selB.player, index: selB.index, cardValue: -1 });
          setSwapAnimB({ from: bCenter, to: aCenter, toPlayer: selA.player, index: selA.index, cardValue: -1 });
          await new Promise(r => setTimeout(r, 1000));
          setSwapAnimA(null);
          setSwapAnimB(null);
          // Réafficher les slots après le swap
          aEl.style.visibility = '';
          bEl.style.visibility = '';
        }

        // Appliquer l'échange logique (valeurs et face cachée)
        const applySwap = (p: 'top'|'bottom', idx: number, newVal: number) => {
          if (p === 'top') {
            setPlayer1Cards(prev => {
              const next = [...prev];
              next[idx] = { ...next[idx], value: newVal, isFlipped: false };
              return next;
            });
          } else {
            setPlayer2Cards(prev => {
              const next = [...prev];
              next[idx] = { ...next[idx], value: newVal, isFlipped: false };
              return next;
            });
          }
        };

        applySwap(selA.player, selA.index, bCard.value);
        applySwap(selB.player, selB.index, aCard.value);

        // Notifier le serveur de l'échange pour synchroniser l'autre joueur
        if (socket) {
          console.log('👑 Roi: Notification au serveur de l\'échange de cartes');
          
          // Approche simplifiée : envoyer simplement les indices et valeurs des cartes
          // Chaque client appliquera les changements selon sa propre perspective
          socket.emit('game:king_swap_cards', {
            tableId: tableData?.tableId,
            userId: tableData?.currentUserId,
            // Envoyer les informations des cartes échangées
            card1: { index: selA.index, position: selA.player, oldValue: aCard.value, newValue: bCard.value },
            card2: { index: selB.index, position: selB.player, oldValue: bCard.value, newValue: aCard.value }
          });
          
          console.log('👑 Événement game:king_swap_cards émis avec les informations suivantes:');
          console.log(`  → Carte 1: index=${selA.index}, position=${selA.player}, oldValue=${aCard.value}, newValue=${bCard.value}`);
          console.log(`  → Carte 2: index=${selB.index}, position=${selB.player}, oldValue=${bCard.value}, newValue=${aCard.value}`);
        }

        // Attendre un tick pour que le DOM reflète le swap avant la défausse du Roi
        await new Promise(requestAnimationFrame);

        // Défausser le Roi pioché avec animation deck -> défausse
        if (drawnCard) {
          const deckRect = deckRef.current?.getBoundingClientRect();
          const discardRect = discardRef.current?.getBoundingClientRect();
          if (deckRect && discardRect) {
            const deckCenter = { x: deckRect.left + deckRect.width / 2, y: deckRect.top + deckRect.height / 2 };
            const discardCenter = { x: discardRect.left + discardRect.width / 2, y: discardRect.top + discardRect.height / 2 };
            setReplaceOutImage(getCardImage(drawnCard.value));
            setReplaceOutAnim({ from: deckCenter, to: discardCenter, toPlayer: currentPlayer === 'player1' ? 'top' : 'bottom', index: -1, cardValue: drawnCard.value });
            await new Promise(resolve => setTimeout(resolve, 1000));
            setReplaceOutAnim(null);
            setReplaceOutImage(null);
          }
          setDiscardPile(drawnCard.value);
        }

        // Reset des états et fin de tour
        setDrawnCard(null);
        setShowCardActions(false);
        setIsKingPowerActive(false);
        setKingPowerActivated(false); // Réinitialiser pour permettre une nouvelle activation
        setKingSelections([]);
        
        // Notifier le serveur que le pouvoir est terminé
        if (socket) {
          socket.emit('game:power_completed', {
            tableId: tableData?.tableId,
            userId: tableData?.currentUserId,
            powerType: 'king'
          });
          
          // Défausser le Roi
          if (drawnCard) {
            socket.emit('game:discard_card', {
              tableId: tableData?.tableId,
              userId: tableData?.currentUserId,
              cardIndex: -1, // -1 = carte piochée (pas encore dans la main)
              card: drawnCard.value
            });
          }
        }
      } catch (e) {
        // En cas d'erreur, reset du mode
        setIsKingPowerActive(false);
        setKingPowerActivated(false); // Réinitialiser pour permettre une nouvelle activation
        setKingSelections([]);
        console.error('👑 Erreur lors de l\'application du pouvoir du Roi:', e);
      }
      return;
    }
    
    // Mode pouvoir de la Dame: cliquer une carte ADVERSE pour la voir 3s
    if (isQueenPowerActive) {
      // CORRECTION FINALE: La Dame permet de voir une carte ADVERSE
      // Dans l'interface, le joueur est TOUJOURS en bas (bottom) et l'adversaire en haut (top)
      // Donc avec le pouvoir de la Dame, on doit pouvoir cliquer sur les cartes du HAUT (top)
      
      // Avec le pouvoir de la Dame, on ne peut cliquer que sur les cartes adverses (top)
      if (player !== 'top') {
        console.log('💫 Dame: Vous ne pouvez voir que les cartes ADVERSES (en haut)');
        return;
      }
      
      console.log('💫 Dame: Tentative de voir une carte adverse sur le côté', player);
      const targetCards = player === 'top' ? player1Cards : player2Cards;
      if (targetCards[index].value === -1) return;
      
      // Activer le blocage global des clics
      setQueenCardSelected(true);
      
      console.log('💫 Dame: Carte sélectionnée, blocage des autres clics');

      // Retourner face visible 3 secondes (sans changer la logique du tour)
      if (player === 'top') {
        setPlayer1Cards(prev => {
          const next = [...prev];
          next[index] = { ...next[index], isFlipped: true };
          return next;
        });
      } else {
        setPlayer2Cards(prev => {
          const next = [...prev];
          next[index] = { ...next[index], isFlipped: true };
          return next;
        });
      }

      // Attendre 3s puis rebasculer face cachée
      await new Promise(resolve => setTimeout(resolve, 3000));
      if (player === 'top') {
        setPlayer1Cards(prev => {
          const next = [...prev];
          next[index] = { ...next[index], isFlipped: false };
          return next;
        });
      } else {
        setPlayer2Cards(prev => {
          const next = [...prev];
          next[index] = { ...next[index], isFlipped: false };
          return next;
        });
      }

      // Défausser la Dame piochée avec animation deck -> défausse
      if (drawnCard) {
        const deckRect = deckRef.current?.getBoundingClientRect();
        const discardRect = discardRef.current?.getBoundingClientRect();
        if (deckRect && discardRect) {
          const deckCenter = { x: deckRect.left + deckRect.width / 2, y: deckRect.top + deckRect.height / 2 };
          const discardCenter = { x: discardRect.left + discardRect.width / 2, y: discardRect.top + discardRect.height / 2 };
          setReplaceOutImage(getCardImage(drawnCard.value));
          setReplaceOutAnim({ from: deckCenter, to: discardCenter, toPlayer: currentPlayer === 'player1' ? 'top' : 'bottom', index: -1, cardValue: drawnCard.value });
          await new Promise(resolve => setTimeout(resolve, 1000));
          setReplaceOutAnim(null);
          setReplaceOutImage(null);
        }
        setDiscardPile(drawnCard.value);
      }

      // Reset états et fin de tour
      setIsQueenPowerActive(false);
      setDrawnCard(null);
      setShowCardActions(false);
      
      // Réinitialiser le blocage global après un délai
      setTimeout(() => {
        setQueenCardSelected(false);
        console.log('💫 Dame: Déblocage des clics après fin du pouvoir');
      }, 2000);
      
      // Notifier le serveur que le pouvoir est terminé
      if (socket) {
        socket.emit('game:power_completed', {
          tableId: tableData?.tableId,
          userId: tableData?.currentUserId,
          powerType: 'queen'
        });
        
        // Défausser la Dame
        if (drawnCard) {
          socket.emit('game:discard_card', {
            tableId: tableData?.tableId,
            userId: tableData?.currentUserId,
            cardIndex: -1, // -1 = carte piochée (pas encore dans la main)
            card: drawnCard.value
          });
        }
      }
      return;
    }

    // Mode pouvoir du Valet: cliquer UNE SEULE carte PERSONNELLE pour la voir 3s
    if (isJackPowerActive) {
      // Vérifier si le pouvoir a déjà été utilisé (bloque immédiatement les clics multiples)
      if (jackPowerUsedRef.current) {
        console.log(' Valet: Pouvoir déjà utilisé, clic ignoré');
        return;
      }
      
      // Ne permettre de cliquer que sur nos propres cartes (bottom)
      if (player !== 'bottom') return;
      
      // Vérifier que la carte existe et n'est pas vide
      if (player2Cards[index].value === -1) return;
      
      // Marquer le pouvoir comme utilisé IMMEÉDIATEMENT pour bloquer tout autre clic
      jackPowerUsedRef.current = true;
      
      // Activer le blocage global des clics
      setJackCardSelected(true);
      
      // Désactiver l'état du pouvoir (pour l'UI)
      setIsJackPowerActive(false);
      
      console.log(' Valet: Affichage de la carte sélectionnée pendant 3 secondes');
      
      // Retourner face visible 3 secondes
      setPlayer2Cards(prev => {
        const next = [...prev];
        next[index] = { ...next[index], isFlipped: true };
        return next;
      });
      
      // Attendre 3s puis rebasculer face cachée
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log(' Valet: Masquage de la carte après 3 secondes');
      
      // Remettre face cachée
      setPlayer2Cards(prev => {
        const next = [...prev];
        next[index] = { ...next[index], isFlipped: false };
        return next;
      });

      console.log(' Valet: Défausse du Valet');
      
      // Défausser le Valet
      if (drawnCard) {
        // Animation de défausse
        const deckRect = deckRef.current?.getBoundingClientRect();
        const discardRect = discardRef.current?.getBoundingClientRect();
        if (deckRect && discardRect) {
          const deckCenter = { x: deckRect.left + deckRect.width / 2, y: deckRect.top + deckRect.height / 2 };
          const discardCenter = { x: discardRect.left + discardRect.width / 2, y: discardRect.top + discardRect.height / 2 };
          setReplaceOutImage(getCardImage(drawnCard.value));
          setReplaceOutAnim({ from: deckCenter, to: discardCenter, toPlayer: currentPlayer === 'player1' ? 'top' : 'bottom', index: -1, cardValue: drawnCard.value });
          await new Promise(resolve => setTimeout(resolve, 1000));
          setReplaceOutAnim(null);
          setReplaceOutImage(null);
        }
        setDiscardPile(drawnCard.value);
        
        // Notifier le serveur
        if (socket) {
          console.log(' Valet: Notification au serveur');
          socket.emit('game:power_completed', {
            tableId: tableData?.tableId,
            userId: tableData?.currentUserId,
            powerType: 'jack'
          });
          
          socket.emit('game:discard_card', {
            tableId: tableData?.tableId,
            userId: tableData?.currentUserId,
            cardIndex: -1,
            card: drawnCard.value
          });
        }
      }
      
      // Reset états
      setDrawnCard(null);
      setShowCardActions(false);
      
      // Réinitialiser la référence et le blocage global pour le prochain tour
      setTimeout(() => {
        jackPowerUsedRef.current = false;
        setJackCardSelected(false);
        console.log(' Valet: Réinitialisation des blocages pour le prochain tour');
      }, 2000);
      return;
    }

    // Si on est en train de sélectionner une carte à remplacer, ce mode a la priorité
    if (selectingCardToReplace) {
      // Vérifier si le joueur actuel est bien celui qui doit jouer
      // Prendre en compte amIPlayer1 pour déterminer correctement le joueur actuel
      let isCurrentPlayer;
      if (amIPlayer1) {
        // Je suis player1, mes cartes sont en bas (bottom)
        isCurrentPlayer = (player === 'bottom' && currentPlayer === 'player1');
      } else {
        // Je suis player2, mes cartes sont en bas (bottom)
        isCurrentPlayer = (player === 'bottom' && currentPlayer === 'player2');
      }
      
      if (isCurrentPlayer && drawnCard) {
        // Récupérer les rectangles pour les animations
        const oldCard = playerCards[index];
        const oldCardId = oldCard.id;
        // Chercher d'abord par id, sinon fallback par index
        let selEl = document.querySelector(`[data-player="${player}"][data-card-id="${oldCardId}"]`) as HTMLElement | null;
        if (!selEl) {
          selEl = document.querySelector(`[data-player="${player}"][data-card-index="${index}"]`) as HTMLElement | null;
        }
        const deckRect = deckRef.current?.getBoundingClientRect();
        const discardRect = discardRef.current?.getBoundingClientRect();

        if (selEl && deckRect && discardRect) {
          // Masquer la carte source pendant l'animation sortante
          selEl.style.visibility = 'hidden';
          const selRect = selEl.getBoundingClientRect();
          const selCenter = { x: selRect.left + selRect.width / 2, y: selRect.top + selRect.height / 2 };
          const deckCenter = { x: deckRect.left + deckRect.width / 2, y: deckRect.top + deckRect.height / 2 };
          const discardCenter = { x: discardRect.left + discardRect.width / 2, y: discardRect.top + discardRect.height / 2 };

          // Animation 1: la carte sélectionnée vers la défausse (1s)
          const oldCardValue = oldCard.value;
          setReplaceOutImage(getCardImage(oldCardValue));
          setReplaceOutAnim({ from: selCenter, to: discardCenter, toPlayer: player, index, cardValue: oldCardValue });
          await new Promise(resolve => setTimeout(resolve, 1000));
          setReplaceOutAnim(null);
          setReplaceOutImage(null);
          if (oldCardValue !== -1) setDiscardPile(oldCardValue);

          // Animation 2: la carte piochée depuis le deck vers l'emplacement sélectionné (1s)
          setReplaceInImage(getCardImage(drawnCard.value));
          setReplaceInAnim({ from: deckCenter, to: selCenter, toPlayer: player, index, cardValue: drawnCard.value });
          await new Promise(resolve => setTimeout(resolve, 1000));
          setReplaceInAnim(null);
          setReplaceInImage(null);
        }

        // Utiliser updateCardArray pour mettre à jour les cartes de manière cohérente
        const updatedCards = [...playerCards];
        
        // S'assurer que le tableau a la bonne taille
        while (updatedCards.length <= index) {
          updatedCards.push({
            id: `card-filler-${Date.now()}-${Math.random()}`,
            value: -1,
            isFlipped: false
          });
        }
        
        // Mettre à jour la carte à l'index spécifié
        updatedCards[index] = {
          id: `replaced-${Date.now()}-${Math.random()}`,
          value: drawnCard.value,
          isFlipped: false
        };
        
        console.log(`✅ Updated my cards with replacement. Now has ${updatedCards.length} cards with updated card at index ${index}`);
        
        if (player === 'top') {
          setPlayer1Cards(updatedCards);
        } else {
          setPlayer2Cards(updatedCards);
        }

        // Réinitialiser les états
        setDrawnCard(null);
        setShowCardActions(false);
        setSelectingCardToReplace(false);

        // Émettre l'événement de remplacement de carte au serveur
        if (socket) {
          socket.emit('game:replace_card', {
            tableId: tableData?.tableId,
            userId: tableData?.currentUserId,
            cardIndex: index,
            newCard: {
              id: `drawn-${Date.now()}`,
              value: drawnCard.value,
              isFlipped: false,
              isVisible: false,
              position: index
            }
          });
        }
        
        // Ne pas appeler handleTurnEnd ici, le serveur gérera le changement de tour

        // Après le re-render, réafficher le slot
        try {
          await new Promise(requestAnimationFrame);
          const selEl2 = document.querySelector(`[data-player="${player}"][data-card-index="${index}"]`) as HTMLElement | null;
          if (selEl2) selEl2.style.visibility = '';
        } catch {}
      }
      return;
    }

    // Vérifier si on est en mode défausse rapide (après la phase de mémorisation)
    // IMPORTANT: On ne peut défausser QUE ses propres cartes (bottom)
    if (player === 'bottom' && gamePhase !== 'preparation' && gamePhase !== 'before_round' && discardPile !== null && !drawnCard && !selectingCardToReplace && quickDiscardActive) {
      // Retourner la carte cliquée face visible
      setPlayer2Cards(prev => {
        const newCards = [...prev];
        newCards[index] = { ...newCards[index], isFlipped: true };
        return newCards;
      });
      
      // Petite pause pour montrer la carte
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const topRaw = discardPile;
      const clickedRaw = playerCards[index].value;
      const topCardValue = getCardValue(topRaw);
      const clickedCardValue = getCardValue(clickedRaw);

      // Correspondance: si les deux sont des Jokers, il faut même type (joker vs joker2)
      // Sinon, comparer les valeurs de rang.
      const isMatch = (() => {
        if (isJoker(topRaw) && isJoker(clickedRaw)) {
          const topType = topRaw >= 110 ? 2 : 1; // 110..115 => joker2
          const clickedType = clickedRaw >= 110 ? 2 : 1;
          return topType === clickedType;
        }
        if (isJoker(topRaw) || isJoker(clickedRaw)) return false;
        return clickedCardValue === topCardValue;
      })();

      // Vérifier si la carte cliquée correspond à la valeur/type de la défausse
      if (isMatch) {
        console.log('✅ Quick discard match! Emitting to server...');
        // Émettre au serveur pour défausse rapide
        if (socket) {
          socket.emit('game:quick_discard', {
            tableId: tableData?.tableId,
            userId: myPlayerInfo?.userId,
            cardIndex: index,
            card: clickedRaw
          });
        }
        return;
      } else {
        console.log('❌ Quick discard mismatch! Emitting penalty to server...');
        // Émettre au serveur pour pénalité
        if (socket) {
          socket.emit('game:quick_discard_penalty', {
            tableId: tableData?.tableId,
            userId: myPlayerInfo?.userId,
            cardIndex: index
          });
        }
        return;
      }
    }
    
    // En phase d'avant tour, on laisse chaque joueur retourner 2 cartes
    if (gamePhase === 'before_round') {
      const playerKey = player === 'top' ? 'player1' : 'player2';
      const playerCards = player === 'top' ? player1Cards : player2Cards;
      
      // Vérifier si la carte est déjà retournée
      if (playerCards[index].isFlipped) return;
      
      // Vérifier si le joueur a déjà retourné 2 cartes
      if (cardsFlipped[playerKey].count >= 2) return;
      
      // Retourner la carte
      const newCards = [...playerCards];
      newCards[index] = { ...newCards[index], isFlipped: true };
      
      if (player === 'top') {
        setPlayer1Cards(newCards);
      } else {
        setPlayer2Cards(newCards);
      }
      
      // Mettre à jour le compteur de cartes retournées et vérifier si on doit démarrer le minuteur
      setCardsFlipped(prev => {
        const updated = {
          ...prev,
          [playerKey]: {
            count: prev[playerKey].count + 1,
            indexes: [...prev[playerKey].indexes, index]
          }
        };
        
        return updated;
      });
      
      return;
    }
    
    // Après la phase 'before_round', les cartes ne peuvent plus être retournées
    if (gamePhase === 'player1_turn' || gamePhase === 'player2_turn') {
      console.log('La phase de retournement des cartes est terminée');
      return;
    }
    
    console.log('Tentative de retournement - Phase:', gamePhase, 'Joueur actuel:', currentPlayer, 'Clic sur:', player);
    
    // Vérifier si c'est bien le tour du joueur qui clique
    const isPlayer1Turn = currentPlayer === 'player1';
    const isCorrectPlayer = (player === 'top' && isPlayer1Turn) || (player === 'bottom' && !isPlayer1Turn);
    
    if (!isCorrectPlayer) {
      console.log('Ce n\'est pas votre tour!');
      return;
    }

    // Retourner la carte du joueur concerné
    const updateCards = (prevCards: CardState[]) => {
      // Ne pas retourner si la carte est déjà face visible ou n'existe pas
      if (prevCards[index].isFlipped || prevCards[index].value === -1) {
        return prevCards;
      }
      
      console.log('Retournement de la carte', index, 'du joueur', player);
      const newCards = [...prevCards];
      newCards[index] = { 
        ...newCards[index],
        isFlipped: true 
      };
      return newCards;
    };

    if (player === 'top') {
      setPlayer1Cards(updateCards);
    } else {
      setPlayer2Cards(updateCards);
    }
  };

  // Toggle Ready status
  const handleToggleReady = React.useCallback(() => {
    console.log('🎮 handleToggleReady called');
    console.log('  - socket:', socket ? 'connected' : 'null');
    console.log('  - tableData:', tableData);
    console.log('  - tableId:', tableData?.tableId);
    console.log('  - currentUserId:', tableData?.currentUserId);
    
    if (!socket) {
      console.error('❌ Socket not connected');
      return;
    }
    if (!tableData?.tableId) {
      console.error('❌ tableId missing');
      return;
    }
    if (!tableData?.currentUserId) {
      console.error('❌ currentUserId missing');
      return;
    }
    
    console.log('✅ Emitting player:toggle_ready');
    socket.emit('player:toggle_ready', {
      tableId: tableData.tableId,
      userId: tableData.currentUserId
    });
  }, [socket, tableData?.tableId, tableData?.currentUserId]);

  // Quitter la partie
  const handleQuitGame = React.useCallback(() => {
    if (!socket || !tableData?.tableId || !tableData?.currentUserId) return;
    
    console.log('🚪 Quitting game...');
    socket.emit('player:quit_game', {
      tableId: tableData.tableId,
      userId: tableData.currentUserId
    });
    setShowQuitConfirm(false);
  }, [socket, tableData?.tableId, tableData?.currentUserId]);

  // Lance la distribution stylée
  const handleStartNewGame = async (resetScores: boolean = true) => {
    if (isDealing) return; // Éviter les clics multiples
    
    // Réinitialiser les scores si demandé (bouton "Start a new game")
    if (resetScores) {
      setScores({ player1: 0, player2: 0 });
    }

    // Réinitialiser le jeu
    initializeDeck();
    
    // Attendre que le deck soit initialisé
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Crée un nouveau deck mélangé (2 jeux de 52 cartes) + 12 Jokers
    const baseDeck = [...Array(52).keys(), ...Array(52).keys()];
    const jokerCards = [104,105,106,107,108,109,110,111,112,113,114,115];
    const newDeck = [...baseDeck, ...jokerCards]
      .sort(() => Math.random() - 0.5);
    
    // Réinitialiser les cartes des joueurs avec des IDs uniques
    const resetCards = () => 
      Array(4).fill(null).map((_, i) => ({
        id: `card-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        value: -1,
        isFlipped: false
      }));
      
    // Réinitialiser l'état des cartes retournées
    setCardsFlipped({
      player1: { count: 0, indexes: [] },
      player2: { count: 0, indexes: [] }
    });
    
    setPlayer1Cards(resetCards());
    setPlayer2Cards(resetCards());
    setCardsDealt(0);
    
    setIsDealing(true);
    
    // Distribue 4 cartes à chaque joueur
    for (let i = 0; i < 4; i++) {
      // Distribution au joueur 1 (top) - prendre les cartes paires
      const cardValue1 = newDeck[i * 2];
      setPlayer1Cards(prev => {
        const newCards = [...prev];
        newCards[i] = {
          ...newCards[i],
          value: cardValue1,
          isFlipped: false
        };
        return newCards;
      });
      
      // Animation pour le joueur 1
      await new Promise(resolve => {
        setTimeout(() => {
          const deck = deckRef.current;
          const hand = player1HandRef.current;
          if (deck && hand) {
            const deckRect = deck.getBoundingClientRect();
            const handRect = hand.getBoundingClientRect();
            const cardOffset = i * 72;
            const from = {x: deckRect.left + deckRect.width/2, y: deckRect.top + deckRect.height/2};
            const to = {
              x: handRect.left + handRect.width/2 - 108 + cardOffset,
              y: handRect.top + handRect.height/2
            };
            // Ajouter un léger délai pour que l'animation soit plus visible
            setTimeout(() => {
              setDealAnim({
                from: { x: from.x, y: from.y },
                to: { x: to.x, y: to.y },
                toPlayer: 'top',
                index: i,
                cardValue: cardValue1
              });
            }, 20);
          }
          resolve(null);
        }, 10);
      });
      
      await new Promise(resolve => setTimeout(resolve, DEAL_DELAY));
      setDealAnim(null);
      
      // Distribution au joueur 2 (bottom) - prendre les cartes impaires
      const cardValue2 = newDeck[i * 2 + 1];
      setPlayer2Cards(prev => {
        const newCards = [...prev];
        newCards[i] = {
          ...newCards[i],
          value: cardValue2,
          isFlipped: false
        };
        return newCards;
      });
      
      // Animation pour le joueur 2
      await new Promise(resolve => {
        setTimeout(() => {
          const deck = deckRef.current;
          const hand = player2HandRef.current;
          if (deck && hand) {
            const deckRect = deck.getBoundingClientRect();
            const handRect = hand.getBoundingClientRect();
            const cardOffset = i * 72;
            const from = {x: deckRect.left + deckRect.width/2, y: deckRect.top + deckRect.height/2};
            const to = {
              x: handRect.left + handRect.width/2 - 108 + cardOffset,
              y: handRect.top + handRect.height/2
            };
            // Ajouter un léger délai pour que l'animation soit plus visible
            setTimeout(() => {
              setDealAnim({
                from: { x: from.x, y: from.y },
                to: { x: to.x, y: to.y },
                toPlayer: 'bottom',
                index: i,
                cardValue: cardValue2
              });
            }, 20);
          }
          resolve(null);
        }, 10);
      });
      
      await new Promise(resolve => setTimeout(resolve, DEAL_DELAY));
      setDealAnim(null);
      
      // Mettre à jour le nombre de cartes distribuées
      setCardsDealt(i + 1);
    }
    
    setDealingCard(null);
    setIsDealing(false);
    
    // La transition vers la phase avant tour est gérée par l'effet sur cardsDealt === 4.
    // On évite de forcer ici pour ne pas écraser l'overlay et le gel des actions.
    console.log('Distribution terminée');
    // Réinitialiser l'état des cartes retournées (sécurité)
    setCardsFlipped({
      player1: { count: 0, indexes: [] },
      player2: { count: 0, indexes: [] }
    });
  };

  // Effet pour gérer le défilement de la page
  useEffect(() => {
    const originalHtml = document.documentElement.style.overflow;
    const originalBody = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = originalHtml;
      document.body.style.overflow = originalBody;
    };
  }, []);

  // Fonction utilitaire pour déterminer si c'est le tour d'un joueur
  // ATTENTION: player1/player2 font référence à la POSITION VISUELLE (haut/bas)
  // Mais gamePhase fait référence aux JOUEURS RÉELS (Ali/Hicham)
  const isPlayerActive = (player: 'player1' | 'player2') => {
    // Pendant la phase de mémorisation (before_round), c'est le tour du premier joueur
    if (gamePhase === 'before_round') {
      return player === 'player1';
    }
    
    // Si amIPlayer1 est null, on ne peut pas déterminer
    if (amIPlayer1 === null) return false;
    
    // Mapper la position visuelle au joueur réel
    // IMPORTANT: Dans l'interface, le joueur actuel est TOUJOURS en bas (player2)
    // et l'adversaire est TOUJOURS en haut (player1), quelle que soit l'identité réelle
    
    if (amIPlayer1) {
      // Je suis player1 (réel), affiché en bas (position player2)
      if (player === 'player1') return gamePhase === 'player2_turn'; // Haut (visuel) = tour de player2 (réel)
      if (player === 'player2') return gamePhase === 'player1_turn'; // Bas (visuel) = tour de player1 (réel)
    } else {
      // Je suis player2 (réel), affiché en bas (position player2)
      if (player === 'player1') return gamePhase === 'player1_turn'; // Haut (visuel) = tour de player1 (réel)
      if (player === 'player2') return gamePhase === 'player2_turn'; // Bas (visuel) = tour de player2 (réel)
    }
    
    return false;
  };

  // Effet pour gérer l'animation de la carte piochée
  React.useEffect(() => {
    if (drawnCard) {
      // Activer l'effet de brillance du deck
      setIsDeckGlowing(true);
      
      // Démarrer l'animation de la carte piochée après un court délai
      const timer = setTimeout(() => {
        setDrawnCardAnim({
          value: drawnCard.value,
          position: {x: window.innerWidth / 2, y: window.innerHeight / 2},
          isRevealed: false
        });
        
        // Retourner la carte après un court délai
        setTimeout(() => {
          setDrawnCardAnim(prev => prev ? {...prev, isRevealed: true} : null);
        }, 300);
        
        // Cacher l'animation après 2 secondes
        setTimeout(() => {
          setDrawnCardAnim(null);
          setIsDeckGlowing(false);
          // Show card actions after animation completes
          setTimeout(() => {
            setShowCardActions(true);
          }, 300);
        }, 2000);
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [drawnCard]);

  // Carte piochée en animation (composant)
  const drawnCardAnimation = <DrawnCardAnimation state={drawnCardAnim} />;

  // Animations de remplacement (sortant vers défausse, entrant depuis deck)
  const [replaceOutAnim, setReplaceOutAnim] = React.useState<DealAnimState | null>(null);
  const [replaceInAnim, setReplaceInAnim] = React.useState<DealAnimState | null>(null);
  const [replaceOutImage, setReplaceOutImage] = React.useState<string | null>(null);
  const [replaceInImage, setReplaceInImage] = React.useState<string | null>(null);
  // Animations d'échange (carte A -> B et carte B -> A), face cachée
  const [swapAnimA, setSwapAnimA] = React.useState<DealAnimState | null>(null);
  const [swapAnimB, setSwapAnimB] = React.useState<DealAnimState | null>(null);
  // Carte animée en vol (composant)
  const flyingCard = <FlyingCard state={dealAnim} />;
  // Superposer les animations de remplacement (sortie/entrée)
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
      {/* Cue d'annonce de pénalité (arbitre qui siffle) */}
      {penaltyCue && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <style>{`
            @keyframes refShake { 0%,100%{ transform: translateX(0) } 20%{ transform: translateX(-6px) } 40%{ transform: translateX(6px) } 60%{ transform: translateX(-4px) } 80%{ transform: translateX(4px) } }
            @keyframes refFlash { 0%,100%{ opacity: 0.9 } 50%{ opacity: 1 } }
            @keyframes rays { 0%{ transform: scale(0.8); opacity: .2 } 100%{ transform: scale(1.2); opacity: 0 } }
          `}</style>
          <div className="relative">
            <div className="absolute -inset-6 rounded-full bg-yellow-400/30 blur-xl" style={{animation: 'refFlash 1s ease-in-out 2'}} />
            <div className="absolute -inset-10 rounded-full border-2 border-yellow-300/60" style={{animation: 'rays 1.2s ease-out 2'}} />
            <div className="relative px-6 py-4 rounded-2xl bg-black/80 border-4 border-yellow-400 shadow-2xl text-center" style={{animation: 'refShake 0.6s ease-in-out 2'}}>
              <div className="text-4xl">🚨🟨</div>
              <div className="mt-1 text-xl font-extrabold text-yellow-200 tracking-wide uppercase">Pénalité !</div>
            </div>
          </div>
        </div>
      )}
      {/* Overlay de pénalité: assombrit tout sauf la zone du joueur pénalisé (même style que PrepOverlay) */}
      {showPenaltyDim && (
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
                'repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 2px, transparent 3px, transparent 6px)'
            }}
          />
        </div>
      )}
      {/* Cue d'activation de pouvoir */}
      {powerCue && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="relative px-6 py-4 rounded-2xl bg-indigo-700/90 border-4 border-yellow-300 shadow-2xl text-center animate-pulse">
            <div className="text-4xl">⚡️👑</div>
            <div className="mt-1 text-xl font-extrabold text-yellow-200 tracking-wide uppercase">Pouvoir du Roi activé</div>
          </div>
        </div>
      )}
      {queenCue && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="relative px-6 py-4 rounded-2xl bg-purple-700/90 border-4 border-pink-300 shadow-2xl text-center animate-pulse">
            <div className="text-4xl">✨👸</div>
            <div className="mt-1 text-xl font-extrabold text-pink-200 tracking-wide uppercase">Pouvoir de la Dame activé</div>
          </div>
        </div>
      )}
      {jackCue && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="relative px-6 py-4 rounded-2xl bg-blue-700/90 border-4 border-cyan-300 shadow-2xl text-center animate-pulse">
            <div className="text-4xl">💡🤵</div>
            <div className="mt-1 text-xl font-extrabold text-cyan-200 tracking-wide uppercase">Pouvoir du Valet activé</div>
          </div>
        </div>
      )}
      {/* Bannière flash pour la défausse rapide */}
      {quickDiscardFlash && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="px-6 py-3 rounded-2xl bg-red-600/90 text-white text-2xl font-extrabold uppercase shadow-2xl border-4 border-white animate-pulse">
            {quickDiscardFlash}
          </div>
        </div>
      )}
      {/* Prompt ShowTime suite à Bombom */}
      {showShowTimePrompt && (
        // Console.log déjà ajouté ailleurs
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative z-10 px-6 py-5 rounded-2xl bg-yellow-400 text-gray-900 border-4 border-white shadow-2xl text-center w-[min(90%,420px)]">
            <div className="text-4xl mb-2">🎬</div>
            <div className="text-xl font-extrabold mb-3">ShowTime déclenché par Bombom</div>
            {!bombomCancelUsed[amIPlayer1 ? 'player1' : 'player2'] ? (
              <div className="space-y-2">
                <button onClick={() => {
                  // Arrêter le timer Bombom s'il est en cours
                  if (bombomTimerRef.current) {
                    console.log('🕔 Stopping Bombom auto-ShowTime timer (user clicked ShowTime)');
                    clearTimeout(bombomTimerRef.current);
                    bombomTimerRef.current = null;
                  }
                  
                  // Fermer d'abord le message
                  setShowShowTimePrompt(false);
                  // Puis déclencher ShowTime après une courte pause
                  setTimeout(() => triggerShowTime(), 50);
                }} className="w-full bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-semibold shadow border-2 border-white">Lancer ShowTime</button>
                <button onClick={handleCancelBombom} className="w-full bg-gray-800 hover:bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-semibold shadow border-2 border-white">Annuler Bombom (une seule fois)</button>
              </div>
            ) : (
              <div className="space-y-2">
                <button onClick={() => {
                  // Arrêter le timer Bombom s'il est en cours
                  if (bombomTimerRef.current) {
                    console.log('🕔 Stopping Bombom auto-ShowTime timer (user clicked ShowTime)');
                    clearTimeout(bombomTimerRef.current);
                    bombomTimerRef.current = null;
                  }
                  
                  // Fermer d'abord le message
                  setShowShowTimePrompt(false);
                  // Puis déclencher ShowTime après une courte pause
                  setTimeout(() => triggerShowTime(), 50);
                }} className="w-full bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-semibold shadow border-2 border-white">Lancer ShowTime</button>
                <div className="text-sm mt-2">Annulation déjà utilisée. ShowTime est obligatoire.</div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Overlay de victoire (3s) */}
      {showVictory && winner && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative z-10 px-8 py-6 rounded-2xl bg-yellow-400 text-gray-900 border-4 border-white shadow-2xl text-center">
            <div className="text-5xl mb-2">{(winner === 'player1' && amIPlayer1) || (winner === 'player2' && !amIPlayer1) ? '🏆' : '😢'}</div>
            <div className="text-2xl font-extrabold">
              {(winner === 'player1' && amIPlayer1) || (winner === 'player2' && !amIPlayer1) 
                ? 'Tu as gagné cette manche !' 
                : 'Tu as perdu cette manche !'}
            </div>
          </div>
        </div>
      )}
      {/* Overlay de préparation */}
      <PrepOverlay show={showPrepOverlay} />
      {/* Overlay "Mémorisation terminée" */}
      {showMemorizationEndOverlay && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="px-8 py-4 rounded-2xl bg-green-600/90 text-white text-2xl font-extrabold uppercase shadow-2xl border-4 border-white animate-pulse">
            ✅ Mémorisation terminée !
          </div>
        </div>
      )}
      {/* Bouton Ready/Not Ready ou Quit en haut à gauche */}
      {!gameStarted ? (
        <button
          className={`absolute top-3 left-3 z-30 rounded-lg shadow-lg px-4 py-2 flex items-center justify-center text-base font-bold border-2 border-white focus:outline-none focus:ring-2 ${
            myReadyStatus 
              ? 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-400' 
              : 'bg-green-600 hover:bg-green-700 focus:ring-green-400'
          } text-white`}
          title={myReadyStatus ? "Cliquez pour annuler" : "Cliquez quand vous êtes prêt"}
          onClick={handleToggleReady}
        >
          <span className="mr-2">{myReadyStatus ? '⏸️' : '✅'}</span> 
          {myReadyStatus ? 'Not Ready' : 'Ready'}
        </button>
      ) : (
        <button
          className="absolute top-3 left-3 z-30 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-lg px-4 py-2 flex items-center justify-center text-base font-bold border-2 border-white focus:outline-none focus:ring-2 focus:ring-red-400"
          title="Quitter la partie"
          onClick={() => setShowQuitConfirm(true)}
        >
          <span className="mr-2">🚪</span> Quit
        </button>
      )}
      
      {/* Modal de confirmation Quit */}
      {showQuitConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowQuitConfirm(false)} />
          <div className="relative z-10 px-8 py-6 rounded-2xl bg-red-600 text-white border-4 border-white shadow-2xl text-center max-w-md">
            <div className="text-5xl mb-4">⚠️</div>
            <div className="text-2xl font-extrabold mb-4">Quitter la partie ?</div>
            <div className="text-base mb-6">
              Vous allez perdre automatiquement et votre adversaire gagnera par forfait.
            </div>
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleQuitGame}
                className="bg-white text-red-600 px-6 py-2 rounded-lg font-bold hover:bg-gray-100"
              >
                Oui, quitter
              </button>
              <button
                onClick={() => setShowQuitConfirm(false)}
                className="bg-gray-800 text-white px-6 py-2 rounded-lg font-bold hover:bg-gray-700"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Boutons en haut à droite */}
      <div className="absolute top-3 right-3 z-30 flex space-x-2">
        <button
          className="bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg w-12 h-12 flex items-center justify-center text-2xl border-2 border-white focus:outline-none focus:ring-2 focus:ring-purple-400"
          title="Afficher les cartes (2s)"
          onClick={() => {
            // Retourner toutes les cartes
            setPlayer1Cards(prev => prev.map(card => ({ ...card, isFlipped: true })));
            setPlayer2Cards(prev => prev.map(card => ({ ...card, isFlipped: true })));
            
            // Les remettre face cachée après 2 secondes
            setTimeout(() => {
              setPlayer1Cards(prev => prev.map(card => ({ ...card, isFlipped: false })));
              setPlayer2Cards(prev => prev.map(card => ({ ...card, isFlipped: false })));
            }, 2000);
          }}
        >
          <span role="img" aria-label="Voir les cartes">👁️</span>
        </button>
        <button
          className={`${isPowerfulMode ? 'bg-red-600 hover:bg-red-700 focus:ring-red-400' : 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-400'} text-white rounded-full shadow-lg w-12 h-12 flex items-center justify-center text-2xl border-2 border-white focus:outline-none focus:ring-2`}
          title={isPowerfulMode ? 'Désactiver Powerful mode' : 'Activer Powerful mode'}
          onClick={togglePowerfulMode}
        >
          <span role="img" aria-label="Powerful">⚡</span>
        </button>
        <div className="relative">
          <button
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg w-12 h-12 flex items-center justify-center text-2xl border-2 border-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
            title="Forcer la prochaine pioche"
            onClick={() => setShowForceMenu(v => !v)}
          >
            <span role="img" aria-label="Force Draw">🎯</span>
          </button>
          {showForceMenu && (
            <div className="absolute right-0 mt-2 bg-black/80 text-white rounded-xl shadow-2xl border border-white/20 p-3 w-52">
              <div className="text-xs mb-2 opacity-80">Choisir la prochaine carte</div>
              <div className="grid grid-cols-4 gap-2 text-sm">
                {['A','2','3','4','5','6','7','8','9','10','J','Q','K','Jok1','Jok2'].map(lbl => (
                  <button
                    key={lbl}
                    className={`px-2 py-1 rounded-md border border-white/30 hover:bg-white/10 ${
                      (forcedNextDraw && (
                        (forcedNextDraw.kind==='rank' && lbl === (forcedNextDraw.rank===0?'A': forcedNextDraw.rank>=1 && forcedNextDraw.rank<=8 ? String(forcedNextDraw.rank+1) : forcedNextDraw.rank===9?'10': forcedNextDraw.rank===10?'J': forcedNextDraw.rank===11?'Q':'K')) ||
                        (forcedNextDraw?.kind==='joker' && ((forcedNextDraw.type===1 && lbl==='Jok1') || (forcedNextDraw.type===2 && lbl==='Jok2')))
                      )) ? 'bg-white/10' : ''
                    }`}
                    onClick={() => {
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
                    }}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
              {forcedNextDraw && (
                <div className="mt-3 text-xs opacity-80 flex items-center justify-between">
                  <span>
                    Forcé: {
                      forcedNextDraw.kind==='rank'
                        ? (forcedNextDraw.rank===0?'A': forcedNextDraw.rank>=1 && forcedNextDraw.rank<=8 ? String(forcedNextDraw.rank+1) : forcedNextDraw.rank===9?'10': forcedNextDraw.rank===10?'J': forcedNextDraw.rank===11?'Q':'K')
                        : (forcedNextDraw.type===1?'Jok1':'Jok2')
                    }
                  </span>
                  <button className="underline" onClick={() => setForcedNextDraw(null)}>Effacer</button>
                </div>
              )}
            </div>
          )}
        </div>
        <button
          className="bg-amber-600 hover:bg-amber-700 text-white rounded-full shadow-lg w-12 h-12 flex items-center justify-center text-2xl border-2 border-white focus:outline-none focus:ring-2 focus:ring-amber-400"
          title="Voir le tableau des scores"
          onClick={openScoreboard}
        >
          <span role="img" aria-label="Scores">📊</span>
        </button>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg w-12 h-12 flex items-center justify-center text-2xl border-2 border-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          title="Retour au Dashboard"
          onClick={() => navigate('/dashboard')}
        >
          <span role="img" aria-label="Dashboard">🏠</span>
        </button>
      </div>
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

      {/* Joueur 1 (haut) */}
      <div className={`row-start-2 row-end-3 flex items-end justify-center min-h-[40px] ${isInPenalty && penaltyPlayer === 'player1' ? 'relative z-50' : ''}` }>
        <div ref={player1HandRef} style={{minHeight: 0}}>
          <div style={isPlayerActive('player1') ? activePlayerStyle : inactivePlayerStyle}>
            <PlayerZone 
              position="top" 
              playerName={opponentInfo?.name || 'Adversaire'} 
              cardsDealt={cardsDealt} 
              cards={player1Cards}
              onCardClick={(index) => handleCardClick('top', index)}
              highlight={(isKingPowerActive && isPlayerTurn) || (isQueenPowerActive && isPlayerTurn)}
            />
            <div className="mt-2 flex items-center justify-center gap-2">
              {/* Le message Bombom activé ne doit pas apparaître en haut */}
            </div>
          </div>
        </div>
      </div>
      {/* Plateau (milieu) : deck (gauche) • centre (info + carte piochée) • défausse (droite) */}
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
            onClick={async () => {
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
            }}
            >
              <span className="absolute -top-3 left-2 bg-yellow-400 text-gray-900 font-bold px-2 py-1 rounded-full text-xs shadow">Cartes</span>
              <span className="text-3xl">🂠</span>
              <span className="mt-2 text-sm font-bold">Piocher</span>
              <div className="absolute bottom-2 text-xs text-gray-200">{deck.length} cartes</div>
              {/* Panneau de carte piochée (absolu sous le deck) */}
              {drawnCard && showCardActions && !anyPowerActive && (
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
              )}
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

      {/* Joueur 2 (bas) */}
      <div className={`row-start-4 row-end-5 flex items-start justify-center min-h-[60px] ${isInPenalty && penaltyPlayer === 'player2' ? 'relative z-50' : ''}` }>
        <div ref={player2HandRef} style={{minHeight: 0}}>
          <div style={isPlayerActive('player2') ? activePlayerStyle : inactivePlayerStyle}>
            <PlayerZone 
              position="bottom" 
              playerName={myPlayerInfo?.name || 'Moi'} 
              cardsDealt={cardsDealt} 
              cards={player2Cards}
              onCardClick={(index) => handleCardClick('bottom', index)}
              highlight={isMemorizationPhase || (selectingCardToReplace && isPlayerTurn) || (isKingPowerActive && isPlayerTurn) || (isJackPowerActive && isPlayerTurn) || false}
            />
            <div className="mt-2 flex items-center justify-center gap-2">
              {/* Afficher le bouton Bombom pour tous les joueurs, mais actif uniquement pour celui dont c'est le tour */}
              <button
                className={`px-3 py-1 rounded-full text-sm font-bold border-2 ${isPlayerTurn && bombomDeclaredBy === null ? 'bg-pink-600 hover:bg-pink-700 text-white' : 'bg-gray-400 text-gray-600 cursor-not-allowed'} border-white`}
                disabled={!isPlayerTurn || drawnCard !== null || selectingCardToReplace || isInPenalty || bombomDeclaredBy !== null}
                title={bombomDeclaredBy !== null ? 'Un Bombom est déjà activé' : isPlayerTurn ? 'Déclarer Bombom' : 'Vous ne pouvez pas déclarer Bombom pendant le tour de l\'adversaire'}
                onClick={() => handleDeclareBombomFor(amIPlayer1 ? 'player1' : 'player2')}
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
    </div>
  );
};

export default TwoPlayersGamePage;
