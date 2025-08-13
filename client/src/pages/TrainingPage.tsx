import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import PlayerZone from '../components/training/PlayerZone';
import PrepOverlay from '../components/training/PrepOverlay';
import DrawnCardAnimation from '../components/training/DrawnCardAnimation';
import FlyingCard, { type DealAnimState } from '../components/training/FlyingCard';
import TopBanner from '../components/training/TopBanner';
import { getCardImage, getCardValue, getRankLabel } from '../utils/cards';

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

const TrainingPage: React.FC = () => {
  const navigate = useNavigate();
  const deckRef = React.useRef<HTMLDivElement>(null);
  const player1HandRef = React.useRef<HTMLDivElement>(null);
  const player2HandRef = React.useRef<HTMLDivElement>(null);

  // État pour le deck et la distribution
  const [isDealing, setIsDealing] = React.useState(false);
  const [dealingCard, setDealingCard] = React.useState<{to: 'top'|'bottom', index: number, cardValue: number} | null>(null);
  const [player1Cards, setPlayer1Cards] = React.useState<CardState[]>([]);
  const [player2Cards, setPlayer2Cards] = React.useState<CardState[]>([]);
  const [cardsDealt, setCardsDealt] = React.useState(0);
  const [drawnCard, setDrawnCard] = React.useState<{value: number, isFlipped: boolean} | null>(null);
  const [showCardActions, setShowCardActions] = React.useState(false);
  const [selectingCardToReplace, setSelectingCardToReplace] = React.useState(false);
  const [deck, setDeck] = React.useState<number[]>([]);
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
  // Zone à laisser visible pendant la pénalité
  const [penaltyPlayer, setPenaltyPlayer] = React.useState<'player1' | 'player2' | null>(null);
  // Animation sifflet arbitre juste avant l'assombrissement
  const [penaltyCue, setPenaltyCue] = React.useState(false);
  // Contrôle spécifique de l'overlay sombre (décorrélé du blocage logique isInPenalty)
  const [showPenaltyDim, setShowPenaltyDim] = React.useState(false);

  // Ref pour connaître en temps réel si une pénalité est en cours (utilisé dans les callbacks setInterval)
  const isInPenaltyRef = React.useRef(false);
  // Références visuelles
  const discardRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    isInPenaltyRef.current = isInPenalty;
  }, [isInPenalty]);

  // Initialiser et mélanger le deck au chargement
  React.useEffect(() => {
    initializeDeck();
  }, []);

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
    // Créer un nouveau tableau avec des objets uniques pour chaque carte
    const initialCards = Array(4).fill(null).map((_, i) => ({
      id: `card-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      value: -1,
      isFlipped: false
    }));
    
    // Créer un nouveau deck mélangé (2 jeux de 52 cartes)
    const newDeck = [...Array(52).keys(), ...Array(52).keys()]
      .sort(() => Math.random() - 0.5);
    
    // Retirer 8 cartes du deck pour la distribution initiale (4 par joueur)
    const initialDeck = newDeck.slice(8);
    
    setDeck(initialDeck);
    setPlayer1Cards([...initialCards]);
    setPlayer2Cards([...initialCards]);
    setCardsDealt(0);
    setCurrentPlayer('player1');
    setIsPlayerTurn(false);
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
  }, [currentPlayer, handleTurnEnd, drawnCard]);
  
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
      setTimeout(() => {
        setShowPrepOverlay(false);
        // Démarrer de manière idempotente (protégée par ref)
        startBeforeRoundTimer();
      }, 2000);
    }
  }, [cardsDealt, gamePhase]);

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
      
      const topCardValue = getCardValue(discardPile);
      const clickedCardValue = getCardValue(playerCards[index].value);
      
      // Vérifier si la carte cliquée correspond à la valeur de la défausse
      if (clickedCardValue === topCardValue) {
        // Défausse réussie
        const newCards = [...playerCards];
        const discardedCard = newCards[index].value;
        
        // Mettre à jour la défausse
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
        
        // Vérifier si le joueur a gagné
        const remainingCards = newCards.filter(card => card.value !== -1).length;
        if (remainingCards === 0) {
          // Le joueur a gagné
          alert(`Félicitations ${playerKey === 'player1' ? 'Joueur 1' : 'Joueur 2'} a gagné !`);
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

  // Lance la distribution stylée
  const handleStartNewGame = async () => {
    if (isDealing) return; // Éviter les clics multiples
    
    // Réinitialiser le jeu
    initializeDeck();
    
    // Attendre que le deck soit initialisé
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Crée un nouveau deck mélangé (2 jeux de 52 cartes)
    const newDeck = [...Array(52).keys(), ...Array(52).keys()]
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

  return (
    <div
      className="h-screen w-full bg-cover bg-center homepage-bg grid grid-rows-[min-content_minmax(40px,1fr)_1.7fr_minmax(40px,1fr)] text-gray-200 overflow-hidden relative"
    >
      {flyingCard}
      {replaceOutOverlay}
      {replaceInOverlay}
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
      {/* Bannière flash pour la défausse rapide */}
      {quickDiscardFlash && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="px-6 py-3 rounded-2xl bg-red-600/90 text-white text-2xl font-extrabold uppercase shadow-2xl border-4 border-white animate-pulse">
            {quickDiscardFlash}
          </div>
        </div>
      )}
      {/* Overlay de préparation */}
      <PrepOverlay show={showPrepOverlay} />
      {/* Bouton Start a new game en haut à gauche */}
      <button
        className="absolute top-3 left-3 z-30 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-lg px-4 py-2 flex items-center justify-center text-base font-bold border-2 border-white focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-60 disabled:cursor-not-allowed"
        title="Start a new game"
        onClick={handleStartNewGame}
        disabled={isDealing}
      >
        <span className="mr-2">🆕</span> Start a new game
      </button>
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
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg w-12 h-12 flex items-center justify-center text-2xl border-2 border-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          title="Retour au Dashboard"
          onClick={() => navigate('/dashboard')}
        >
          <span role="img" aria-label="Dashboard">🏠</span>
        </button>
      </div>
      {/* Titre */}
      <TopBanner gamePhase={gamePhase} currentPlayer={currentPlayer} timeLeft={timeLeft} />

      {/* Joueur 1 (haut) */}
      <div className={`row-start-2 row-end-3 flex items-end justify-center min-h-[40px] ${isInPenalty && penaltyPlayer === 'player1' ? 'relative z-50' : ''}` }>
        <div ref={player1HandRef} style={{minHeight: 0}}>
          <div style={isPlayerActive('player1') ? activePlayerStyle : inactivePlayerStyle}>
            <PlayerZone 
              position="top" 
              playerName="Joueur 1" 
              cardsDealt={cardsDealt} 
              cards={player1Cards}
              onCardClick={(index) => handleCardClick('top', index)}
              highlight={selectingCardToReplace && currentPlayer === 'player1'}
            />
          </div>
        </div>
      </div>
      {/* Plateau (milieu) : deck (gauche) • centre (info + carte piochée) • défausse (droite) */}
      <div className="row-start-3 row-end-4 flex justify-between items-center relative min-h-[240px] px-6 gap-6">
        {/* Deck à gauche */}
        <div className="flex flex-col items-center ml-6">
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
              if (!isPlayerTurn || showCardActions || selectingCardToReplace || drawnCard || gamePhase === 'before_round' || memorizationTimerStarted) return;
              
              // Piocher une carte du deck
              if (deck.length > 0) {
                const newDeck = [...deck];
                const cardValue = newDeck.pop();
                setDeck(newDeck);
                
                if (cardValue !== undefined) {
                  // Démarrer l'animation de pioche
                  const deckRect = deckRef.current?.getBoundingClientRect();
                  if (deckRect) {
                    setDrawnCard({ 
                      value: cardValue, 
                      isFlipped: false 
                    });
                  }
                  
                  // Mettre en pause le minuteur pendant que le joueur prend sa décision
                  if (timerRef.current) {
                    clearInterval(timerRef.current);
                  }
                }
              } else {
                console.log('Le deck est vide');
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
                    top: 'calc(100% + 12px)'
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
                    <button
                      onClick={() => {
                        if (drawnCard) {
                          setDiscardPile(drawnCard.value);
                          // Si défausse rapide active, afficher une bannière 1s
                          if (quickDiscardActive) {
                            const rank = getRankLabel(drawnCard.value);
                            const who = currentPlayer === 'player1' ? 'Joueur 1' : 'Joueur 2';
                            setQuickDiscardFlash(`${who} a jeté ${rank}`);
                            setTimeout(() => setQuickDiscardFlash(null), 1000);
                          }
                          setDrawnCard(null);
                          setShowCardActions(false);
                          handleTurnEnd(currentPlayer);
                        }
                      }}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-semibold shadow"
                    >
                      Défausser
                    </button>
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
                </div>
              )}
            </div>
            <div className="text-sm text-gray-300 mt-1">Cliquez pour piocher</div>
          </div>

        {/* Zone centrale avec les informations de jeu (sans message d'invite ni timer) */}
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
              playerName="Joueur 2" 
              cardsDealt={cardsDealt} 
              cards={player2Cards}
              onCardClick={(index) => handleCardClick('bottom', index)}
              highlight={selectingCardToReplace && currentPlayer === 'player2'}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrainingPage;
