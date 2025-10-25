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
  const [kingSelections, setKingSelections] = React.useState<Array<{player: 'top'|'bottom', index: number}>>([]);
  const [powerCue, setPowerCue] = React.useState(false);
  // Pouvoir de la Dame: voir une carte adverse 3s
  const [isQueenPowerActive, setIsQueenPowerActive] = React.useState(false);
  const [queenCue, setQueenCue] = React.useState(false);
  // Pouvoir du Valet: voir une de SES cartes 3s
  const [isJackPowerActive, setIsJackPowerActive] = React.useState(false);
  const [jackCue, setJackCue] = React.useState(false);
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
  const [memorizationTimerStarted, setMemorizationTimerStarted] = React.useState(false);
  // Garde contre démarrage multiple (StrictMode)
  const memorizationStartedRef = React.useRef(false);
  // Phase de mémorisation : compter les cartes cliquées
  const [isMemorizationPhase, setIsMemorizationPhase] = React.useState(false);
  const [memorizedCardsCount, setMemorizedCardsCount] = React.useState(0);
  const [memorizedCardIndexes, setMemorizedCardIndexes] = React.useState<number[]>([]);
  // Zone à laisser visible pendant la pénalité
  const [penaltyPlayer, setPenaltyPlayer] = React.useState<'player1' | 'player2' | null>(null);
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
  // Références visuelles
  const discardRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    isInPenaltyRef.current = isInPenalty;
  }, [isInPenalty]);

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
      console.log('  amIPlayer1:', data.amIPlayer1);
      
      // Sauvegarder si je suis player1 ou player2
      setAmIPlayer1(data.amIPlayer1);
      
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
          
          // Après la dernière carte, démarrer la phase de mémorisation
          if (idx === allCards.length - 1) {
            setTimeout(() => {
              // Changer la phase de jeu
              setGamePhase('before_round');
              setCurrentPlayer('player1');
              setIsPlayerTurn(false);
              
              // Afficher "Préparez-vous !" pendant 2 secondes
              setShowPrepOverlay(true);
              
              setTimeout(() => {
                // Cacher l'overlay après 2 secondes
                setShowPrepOverlay(false);
                
                // PHASE 2 : Phase de mémorisation (2 secondes)
                // Les cartes restent FACE CACHÉE
                // Le joueur peut cliquer sur 2 cartes maximum pour les voir
                setIsMemorizationPhase(true);
                setMemorizedCardsCount(0);
                setMemorizedCardIndexes([]);
                setTimeLeft(2);
                
                console.log('🧠 Memorization phase started - Click on 2 of YOUR cards to memorize');
          
          // Timer de mémorisation
          const timer = setInterval(() => {
            setTimeLeft((prev: number) => {
              if (prev <= 1) {
                clearInterval(timer);
                console.log('✅ Memorization phase ended - Starting game');
                
                // PHASE 3 : Fin de la mémorisation
                setIsMemorizationPhase(false);
                
                // Retourner toutes les cartes FACE CACHÉE
                setPlayer1Cards(cards => cards.map(c => ({ ...c, isFlipped: false })));
                setPlayer2Cards(cards => cards.map(c => ({ ...c, isFlipped: false })));
                setMemorizedCardsCount(0);
                setMemorizedCardIndexes([]);
                
                // PHASE 4 : Début du jeu - Tour du joueur 1
                setGamePhase('player1_turn');
                setCurrentPlayer('player1');
                
                // Déterminer qui est le joueur 1 (celui qui commence)
                // Pour l'instant, on suppose que c'est l'adversaire (en haut)
                // TODO: Le serveur devrait décider qui commence
                setIsPlayerTurn(false); // Ce n'est pas notre tour au début
                
                console.log('🎮 Game started - Player 1 turn');
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
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
      const { currentPlayerId, currentPlayerName } = data;
      
      // Utiliser tableData.currentUserId pour comparer
      const myUserId = tableData?.currentUserId;
      console.log(`  🆔 My userId: ${myUserId}, Current turn userId: ${currentPlayerId}`);
      console.log(`  🎮 Am I player1? ${amIPlayer1}`);
      
      // Déterminer si c'est notre tour
      const isMyTurn = currentPlayerId === myUserId;
      setIsPlayerTurn(isMyTurn);
      
      // Mettre à jour la phase de jeu EN FONCTION DE QUI JE SUIS
      if (isMyTurn) {
        // C'est MON tour
        if (amIPlayer1) {
          setGamePhase('player1_turn');
          setCurrentPlayer('player1');
        } else {
          setGamePhase('player2_turn');
          setCurrentPlayer('player2');
        }
        console.log(`✅ It's MY turn! (${currentPlayerName})`);
      } else {
        // C'est le tour de l'adversaire
        if (amIPlayer1) {
          setGamePhase('player2_turn');
          setCurrentPlayer('player2');
        } else {
          setGamePhase('player1_turn');
          setCurrentPlayer('player1');
        }
        console.log(`⏳ Waiting for opponent... (${currentPlayerName})`);
      }
      
      // Nettoyer l'ancien timer s'il existe
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      // Réinitialiser le timer à 5 secondes pour chaque tour
      setTimeLeft(5);
      
      // Démarrer le timer du tour
      timerRef.current = setInterval(() => {
        setTimeLeft((prev: number) => {
          if (prev <= 1) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            console.log('⏰ Time\'s up for this turn!');
            // TODO: Passer au joueur suivant automatiquement
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
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
      // TODO: Afficher une animation de pioche côté adversaire
    };
    
    // Écouter quand une carte est défaussée
    const handleCardDiscarded = (data: any) => {
      console.log('🗑️ Card discarded:', data);
      const { playerId, card, cardIndex } = data;
      
      // Mettre à jour la défausse (visible par tous)
      setDiscardPile(card);
      
      // Si c'est l'adversaire qui a défaussé, mettre à jour ses cartes
      if (playerId !== myPlayerInfo?.userId) {
        setPlayer1Cards(prev => {
          const newCards = [...prev];
          newCards.splice(cardIndex, 1);
          return newCards;
        });
      } else {
        // Si c'est nous, mettre à jour nos cartes
        setPlayer2Cards(prev => {
          const newCards = [...prev];
          newCards.splice(cardIndex, 1);
          return newCards;
        });
      }
    };
    
    // Écouter quand une carte est remplacée
    const handleCardReplaced = (data: any) => {
      console.log('🔄 Card replaced:', data);
      const { playerId, cardIndex, discardedCard } = data;
      
      // Mettre à jour la défausse
      setDiscardPile(discardedCard);
      
      // Si c'est l'adversaire, on ne voit pas sa nouvelle carte (reste face cachée)
      // Pas besoin de mettre à jour, la carte reste face cachée
    };

    socket.on('player:ready_changed', handleReadyChanged);
    socket.on('game:auto_start', handleAutoStart);
    socket.on('game:cards_dealt', handleCardsDealt);
    socket.on('game:player_quit', handlePlayerQuit);
    socket.on('game:turn_changed', handleTurnChanged);
    socket.on('game:card_drawn', handleCardDrawn);
    socket.on('game:opponent_drew_card', handleOpponentDrewCard);
    socket.on('game:card_discarded', handleCardDiscarded);
    socket.on('game:card_replaced', handleCardReplaced);

    return () => {
      socket.off('playerJoined', handlePlayerJoined);
      socket.off('table_updated', handlePlayerJoined);
      socket.off('player:ready_changed', handleReadyChanged);
      socket.off('game:auto_start', handleAutoStart);
      socket.off('game:cards_dealt', handleCardsDealt);
      socket.off('game:player_quit', handlePlayerQuit);
      socket.off('game:turn_changed', handleTurnChanged);
      socket.off('game:card_drawn', handleCardDrawn);
      socket.off('game:opponent_drew_card', handleOpponentDrewCard);
      socket.off('game:card_discarded', handleCardDiscarded);
      socket.off('game:card_replaced', handleCardReplaced);
      socket.emit('leaveTableRoom', tableData.tableId);
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
    setTimeLeft(15);
    // Ne pas initialiser à 15s, on affichera uniquement
    // les 5s de mémorisation puis 7s par joueur
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
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  const beforeRoundTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const prepTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  
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
    
    // Démarrer le timer pour le prochain joueur après un court délai
    setTimeout(() => {
      setTimeLeft(7); // Réduit à 7 secondes
      if (startTurnTimerRef.current) {
        startTurnTimerRef.current();
      }
    }, 500);
  }, []);
  
  // Fonction pour démarrer le timer du tour
  const startTurnTimer = React.useCallback(() => {
    console.log('Démarrage du minuteur de tour pour', currentPlayer);
    
    // Mettre à jour la phase de jeu en fonction du joueur actuel
    const newPhase = currentPlayer === 'player1' ? 'player1_turn' : 'player2_turn';
    setGamePhase(newPhase);
    
    // Si Bombom a été déclaré précédemment par ce joueur, gérer ShowTime avant tout
    if (bombomDeclaredBy === currentPlayer) {
      // Stopper tout timer en cours par sécurité
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
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
    // Réinitialiser le temps à 7 secondes
    setTimeLeft(7);
    
    // Nettoyer l'ancien timer s'il existe
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    // Créer une copie locale de currentPlayer pour la fermeture
    const currentPlayerLocal = currentPlayer;
    
    // Démarrer le nouveau timer
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        // Si une pénalité est en cours, on fige le timer
        if (isInPenaltyRef.current) {
          return prev;
        }
        if (prev <= 1) {
          // Fin du tour, passer au joueur suivant
          console.log('Fin du temps pour', currentPlayerLocal);
          clearInterval(timerRef.current!);
          
          // Si une carte a été piochée mais aucune action n'a été effectuée, la défausser
          if (drawnCard) {
            setDrawnCard(null);
            setShowCardActions(false);
            setSelectingCardToReplace(false);
          }
          
          // Gérer la fin du tour
          handleTurnEnd(currentPlayerLocal);
          
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [currentPlayer, handleTurnEnd, drawnCard, bombomDeclaredBy, bombomCancelUsed]);

  // Déclenche ShowTime: révèle toutes les cartes, calcule le gagnant (score le plus bas gagne), affiche et enregistre les scores
  const triggerShowTime = React.useCallback(async () => {
    // Révéler toutes les cartes
    setPlayer1Cards(prev => prev.map(c => ({ ...c, isFlipped: true })));
    setPlayer2Cards(prev => prev.map(c => ({ ...c, isFlipped: true })));

    // Stopper timers
    if (timerRef.current) clearInterval(timerRef.current);
    if (beforeRoundTimerRef.current) clearInterval(beforeRoundTimerRef.current);

    // Calculer les totaux
    const p1Total = (player1Cards || []).reduce((sum, c) => sum + getCardScore(c.value), 0);
    const p2Total = (player2Cards || []).reduce((sum, c) => sum + getCardScore(c.value), 0);

    let winnerKey: 'player1' | 'player2' | null = null;
    if (p1Total < p2Total) winnerKey = 'player1';
    else if (p2Total < p1Total) winnerKey = 'player2';
    else winnerKey = null; // égalité

    // Affichage overlay victoire/égalité
    if (winnerKey) {
      setWinner(winnerKey);
      setShowVictory(true);
    }

    // Nettoyer état Bombom
    setBombomDeclaredBy(null);
    setShowShowTimePrompt(false);

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
  }, [player1Cards, player2Cards]);
  
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
    }
    
    // Démarrer le compte à rebours de 5 secondes
    setTimeLeft(5);
    setMemorizationTimerStarted(true);
    
    // Mettre à jour le temps toutes les secondes
    beforeRoundTimerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        // Pendant une pénalité, on fige aussi ce timer par sécurité
        if (isInPenaltyRef.current) {
          return prev;
        }
        if (prev <= 1) {
          // Fin du temps, passer au jeu normal
          clearInterval(beforeRoundTimerRef.current!);
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
  }, [setGamePhase, setCurrentPlayer, setIsPlayerTurn, setTimeLeft, setPlayer1Cards, setPlayer2Cards]);
  
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
    const correctPhase = (gamePhase === 'player1_turn' && player === 'player1') || (gamePhase === 'player2_turn' && player === 'player2');
    // Déclarable uniquement pendant le tour du joueur, sans action en cours, et si aucun Bombom actif
    return correctPhase && currentPlayer === player && isPlayerTurn && !drawnCard && !selectingCardToReplace && !isInPenalty && bombomDeclaredBy === null;
  }, [gamePhase, currentPlayer, isPlayerTurn, drawnCard, selectingCardToReplace, isInPenalty, bombomDeclaredBy]);

  const handleDeclareBombomFor = React.useCallback((player: 'player1' | 'player2') => {
    if (!canDeclareBombomFor(player)) return;
    setBombomDeclaredBy(player);
    const who = player === 'player1' ? 'Joueur 1' : 'Joueur 2';
    setQuickDiscardFlash(`${who} a déclaré Bombom!`);
    setTimeout(() => setQuickDiscardFlash(null), 1000);
  }, [canDeclareBombomFor]);

  const handleCancelBombom = React.useCallback(() => {
    // Annuler seulement lors du prompt au retour du tour, et seulement une fois par joueur
    if (!showShowTimePrompt || bombomDeclaredBy !== currentPlayer) return;
    if (bombomCancelUsed[currentPlayer]) return;
    setBombomCancelUsed(prev => ({ ...prev, [currentPlayer]: true }));
    setBombomDeclaredBy(null);
    setShowShowTimePrompt(false);
    // Reprendre le tour normalement
    setIsPlayerTurn(true);
    setTimeLeft(7);
    if (timerRef.current) clearInterval(timerRef.current);
    // Redémarrer le timer
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (isInPenaltyRef.current) return prev;
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          if (drawnCard) {
            setDrawnCard(null);
            setShowCardActions(false);
            setSelectingCardToReplace(false);
          }
          handleTurnEnd(currentPlayer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [showShowTimePrompt, bombomDeclaredBy, currentPlayer, bombomCancelUsed, drawnCard, handleTurnEnd]);

  // utilitaires déplacés dans ../utils/cards

  // Gère la pénalité de défausse rapide
  const handleQuickDiscardPenalty = async (player: 'player1' | 'player2', cardIndex: number) => {
    if (deck.length < 2) {
      console.log('Pas assez de cartes dans le deck pour la pénalité');
      return;
    }

    // Bloquer immédiatement, mémoriser le joueur fautif
    setIsInPenalty(true);
    setPenaltyPlayer(player);

    // Lancer l'animation d'annonce et l'assombrissement en même temps
    setPenaltyCue(true);
    setShowPenaltyDim(true);
    const penaltyVisualMs = 3000; // durée demandée
    const visualWait = new Promise<void>(resolve => setTimeout(resolve, penaltyVisualMs));
    const newDeck = [...deck];
    const penaltyCards = [newDeck.pop()!, newDeck.pop()!];
    setDeck(newDeck);

    // Animer la distribution des cartes pénalité
    for (let i = 0; i < 2; i++) {
      // Ajouter la carte avec animation — toujours à droite (append) et face cachée
      const newCard = {
        id: `penalty-${Date.now()}-${i}`,
        value: penaltyCards[i],
        isFlipped: false
      } as CardState;

      if (player === 'player1') {
        setPlayer1Cards(prev => {
          const newCards = [...prev];
          // Toujours ajouter à la fin pour être à droite, sans remplir les trous
          newCards.push(newCard);
          return newCards;
        });
      } else {
        setPlayer2Cards(prev => {
          const newCards = [...prev];
          newCards.push(newCard);
          return newCards;
        });
      }

      // Petite pause entre les 2 cartes: 1 seconde
      if (i === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Retourner face cachée la carte fautive (celle cliquée) après distribution
    if (player === 'player1') {
      setPlayer1Cards(prev => prev.map((card, idx) => idx === cardIndex ? { ...card, isFlipped: false } : card));
    } else {
      setPlayer2Cards(prev => prev.map((card, idx) => idx === cardIndex ? { ...card, isFlipped: false } : card));
    }

    // Fin de pénalité: attendre la fin des 3s d'assombrissement, puis retirer overlays et débloquer
    await visualWait;
    setPenaltyCue(false);
    setShowPenaltyDim(false);
    setIsInPenalty(false);
    setPenaltyPlayer(null);
  };

  // Gère le clic sur une carte
  const handleCardClick = async (player: 'top' | 'bottom', index: number) => {
    // Vérifie si l'index est valide
    const handLength = (player === 'top' ? player1Cards.length : player2Cards.length);
    if (index < 0 || index >= handLength || isInPenalty) return;
    
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
        setKingSelections([]);

        handleTurnEnd(currentPlayer);
      } catch (e) {
        // En cas d'erreur, reset du mode
        setIsKingPowerActive(false);
        setKingSelections([]);
      }
      return;
    }
    
    // Mode pouvoir de la Dame: cliquer une carte ADVERSE pour la voir 3s
    if (isQueenPowerActive) {
      const isPlayer1Turn = currentPlayer === 'player1';
      const allowedSide: 'top'|'bottom' = isPlayer1Turn ? 'bottom' : 'top';
      if (player !== allowedSide) return;
      const targetCards = player === 'top' ? player1Cards : player2Cards;
      if (targetCards[index].value === -1) return;

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
      handleTurnEnd(currentPlayer);
      return;
    }

    // Mode pouvoir du Valet: cliquer une carte PERSONNELLE pour la voir 3s
    if (isJackPowerActive) {
      const isPlayer1Turn = currentPlayer === 'player1';
      const allowedSide: 'top'|'bottom' = isPlayer1Turn ? 'top' : 'bottom';
      if (player !== allowedSide) return;
      const targetCards = player === 'top' ? player1Cards : player2Cards;
      if (targetCards[index].value === -1) return;

      // Retourner face visible 3 secondes
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

      // Défausser le Valet pioché avec animation deck -> défausse
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
      setIsJackPowerActive(false);
      setDrawnCard(null);
      setShowCardActions(false);
      handleTurnEnd(currentPlayer);
      return;
    }

    // Si on est en train de sélectionner une carte à remplacer, ce mode a la priorité
    if (selectingCardToReplace) {
      // Vérifier si le joueur actuel est bien celui qui doit jouer
      const isCurrentPlayer = (player === 'top' && currentPlayer === 'player1') || 
                             (player === 'bottom' && currentPlayer === 'player2');
      
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

        // Remplacer la carte sélectionnée par la carte piochée dans l'état
        const newCards = [...playerCards];
        newCards[index] = {
          ...newCards[index],
          value: drawnCard.value,
          isFlipped: false
        };

        if (player === 'top') {
          setPlayer1Cards(newCards);
        } else {
          setPlayer2Cards(newCards);
        }

        // Réinitialiser les états
        setDrawnCard(null);
        setShowCardActions(false);
        setSelectingCardToReplace(false);

        // Passer au tour suivant
        handleTurnEnd(currentPlayer);

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
    if (gamePhase !== 'preparation' && gamePhase !== 'before_round' && discardPile !== null && !drawnCard && !selectingCardToReplace && quickDiscardActive) {
      // Retourner la carte cliquée face visible
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
        // Défausse réussie
        const newCards = [...playerCards];
        const discardedCard = newCards[index].value;

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
        // Afficher une bannière 1s pour la défausse rapide (même hors tour)
        if (quickDiscardActive) {
          const rank = getRankLabel(discardedCard);
          const who = (player === 'top') ? 'Joueur 1' : 'Joueur 2';
          setQuickDiscardFlash(`${who} a jeté ${rank}`);
          setTimeout(() => setQuickDiscardFlash(null), 1000);
        }
        
        // Retirer complètement la carte du jeu
        if (player === 'top') {
          setPlayer1Cards(prev => {
            const updatedCards = [...prev];
            updatedCards[index] = {
              ...updatedCards[index],
              value: -1,
              isFlipped: false
            };
            return updatedCards;
          });
        } else {
          setPlayer2Cards(prev => {
            const updatedCards = [...prev];
            updatedCards[index] = {
              ...updatedCards[index],
              value: -1,
              isFlipped: false
            };
            return updatedCards;
          });
        }
        
        // Vérifier si le joueur a gagné (ignorer pendant un remplacement) (compter les cartes restantes APRÈS avoir retiré celle-ci)
        if (selectingCardToReplace) {
          return;
        }
        // newCards reflète l'état AVANT mise à -1; on soustrait donc 1
        const remainingCards = (playerCards.filter(card => card.value !== -1).length) - 1;
        if (remainingCards === 0) {
          // Le joueur a gagné: afficher overlay 3s puis tableau des scores
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
          return;
        }
        
        return;
      } else {
        // Mauvaise carte - appliquer la pénalité
        await handleQuickDiscardPenalty(playerKey, index);
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
  }, [socket, tableData]);

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
  const isPlayerActive = (player: 'player1' | 'player2') => {
    return (player === 'player1' && gamePhase === 'player1_turn') || 
           (player === 'player2' && gamePhase === 'player2_turn');
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
      {showShowTimePrompt && bombomDeclaredBy === currentPlayer && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative z-10 px-6 py-5 rounded-2xl bg-yellow-400 text-gray-900 border-4 border-white shadow-2xl text-center w-[min(90%,420px)]">
            <div className="text-4xl mb-2">🎬</div>
            <div className="text-xl font-extrabold mb-3">ShowTime déclenché par Bombom</div>
            {!bombomCancelUsed[currentPlayer] ? (
              <div className="space-y-2">
                <button onClick={() => triggerShowTime()} className="w-full bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-semibold shadow border-2 border-white">Lancer ShowTime</button>
                <button onClick={handleCancelBombom} className="w-full bg-gray-800 hover:bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-semibold shadow border-2 border-white">Annuler Bombom (une seule fois)</button>
              </div>
            ) : (
              <div className="space-y-2">
                <button onClick={() => triggerShowTime()} className="w-full bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-semibold shadow border-2 border-white">Lancer ShowTime</button>
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
            <div className="text-5xl mb-2">🏆</div>
            <div className="text-2xl font-extrabold">
              {winner === 'player1' ? (myPlayerInfo?.name || 'Moi') : (opponentInfo?.name || 'Adversaire')} a gagné !
            </div>
          </div>
        </div>
      )}
      {/* Overlay de préparation */}
      <PrepOverlay show={showPrepOverlay} />
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
        currentPlayer={currentPlayer} 
        timeLeft={timeLeft}
        tableCode={tableData?.tableCode}
        player1Name={myPlayerInfo?.name || 'Moi'}
        player2Name={opponentInfo?.name || 'Adversaire'}
        myReadyStatus={myReadyStatus}
        opponentReadyStatus={opponentReadyStatus}
        gameStarted={gameStarted}
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
              highlight={(selectingCardToReplace && currentPlayer === 'player1') || isKingPowerActive || (isQueenPowerActive && currentPlayer === 'player2') || (isJackPowerActive && currentPlayer === 'player1')}
            />
            <div className="mt-2 flex items-center justify-center gap-2">
              <button
                className={`px-3 py-1 rounded-full text-sm font-bold border-2 ${canDeclareBombomFor('player1') ? 'bg-pink-600 hover:bg-pink-700 text-white border-white' : 'bg-pink-600/40 text-white/60 border-white/40 cursor-not-allowed'}`}
                disabled={!canDeclareBombomFor('player1')}
                title="Déclarer Bombom (Joueur 1)"
                onClick={() => handleDeclareBombomFor('player1')}
              >
                🍬 Bombom
              </button>
              {bombomDeclaredBy === 'player1' && (
                <span className="text-[11px] bg-yellow-300/90 text-black px-2 py-0.5 rounded-full border border-yellow-600">Bombom activé</span>
              )}
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
              // Bloquer également pendant la phase de mémorisation
              if (!isPlayerTurn || showCardActions || selectingCardToReplace || drawnCard || gamePhase === 'before_round' || memorizationTimerStarted) {
                console.log('⛔ Cannot draw: not your turn or action in progress');
                return;
              }
              
              // Émettre l'événement WebSocket pour piocher du deck (UNE SEULE FOIS)
              console.log('🎴 Drawing card from deck...');
              if (socket) {
                // Désactiver temporairement pour éviter le spam
                setShowCardActions(true); // Bloque les clics suivants
                
                socket.emit('game:draw_card', {
                  tableId: tableData?.tableId,
                  userId: myPlayerInfo?.userId,
                  fromDeck: true
                });
              }
            }}
            >
              <span className="absolute -top-3 left-2 bg-yellow-400 text-gray-900 font-bold px-2 py-1 rounded-full text-xs shadow">Cartes</span>
              <span className="text-3xl">🂠</span>
              <span className="mt-2 text-sm font-bold">Piocher</span>
              <div className="absolute bottom-2 text-xs text-gray-200">{deck.length} cartes</div>
              {/* Panneau de carte piochée (absolu sous le deck) */}
              {drawnCard && showCardActions && (
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
                          setIsJackPowerActive(true);
                          setJackCue(true);
                          setTimeout(() => setJackCue(false), 900);
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
                          setQueenCue(true);
                          setTimeout(() => setQueenCue(false), 900);
                        }}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm font-semibold shadow"
                      >
                        Activer et défausser
                      </button>
                    )}
                    {drawnCard && !isJoker(drawnCard.value) && getCardValue(drawnCard.value) === 12 && (
                      <button
                        onClick={async () => {
                          // Activer le mode pouvoir du Roi
                          setShowCardActions(false);
                          setIsKingPowerActive(true);
                          setKingSelections([]);
                          setPowerCue(true);
                          setTimeout(() => setPowerCue(false), 900);
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
                            
                            // Émettre l'événement WebSocket pour défausser
                            socket.emit('game:discard_card', {
                              tableId: tableData?.tableId,
                              userId: myPlayerInfo?.userId,
                              cardIndex: -1, // -1 = carte piochée (pas encore dans la main)
                              card: drawnCard.value
                            });
                            
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
              highlight={isMemorizationPhase || (selectingCardToReplace && currentPlayer === 'player2') || isKingPowerActive || (isQueenPowerActive && currentPlayer === 'player1') || (isJackPowerActive && currentPlayer === 'player2')}
            />
            <div className="mt-2 flex items-center justify-center gap-2">
              <button
                className={`px-3 py-1 rounded-full text-sm font-bold border-2 ${canDeclareBombomFor('player2') ? 'bg-pink-600 hover:bg-pink-700 text-white border-white' : 'bg-pink-600/40 text-white/60 border-white/40 cursor-not-allowed'}`}
                disabled={!canDeclareBombomFor('player2')}
                title="Déclarer Bombom (Joueur 2)"
                onClick={() => handleDeclareBombomFor('player2')}
              >
                🍬 Bombom
              </button>
              {bombomDeclaredBy === 'player2' && (
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
