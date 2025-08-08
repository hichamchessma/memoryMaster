import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import cardBack from '../assets/cards/card_back.png';

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

interface PlayerZoneProps {
  position: 'top' | 'bottom';
  playerName: string;
  cardsDealt: number;
  cards: CardState[];
  onCardClick?: (index: number) => void;
}

// Fonction utilitaire pour obtenir le chemin de l'image d'une carte
const getCardImage = (value: number): string => {
  if (value === -1) return ''; // Retourne une chaîne vide pour les cartes non distribuées
  
  const suits = ['c', 'd', 'h', 's'];
  const ranks = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'j', 'q', 'k'];
  
  const suitIndex = Math.floor((value % 52) / 13); // S'assure que l'index est entre 0 et 3
  const rankIndex = (value % 52) % 13; // S'assure que l'index est entre 0 et 12
  
  // Format: card_1c.png, card_2d.png, etc.
  const imageName = `card_${ranks[rankIndex]}${suits[suitIndex]}.png`;
  
  // Utilisation d'une importation dynamique pour les assets
  try {
    return new URL(`../assets/cards/${imageName}`, import.meta.url).href;
  } catch (e) {
    console.error(`Impossible de charger l'image de la carte: ${imageName} (valeur: ${value})`, e);
    return '';
  }
};

const PlayerZone: React.FC<PlayerZoneProps> = ({ position, playerName, cardsDealt, cards = [], onCardClick = () => {} }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      {/* Board de 4 cartes face cachée */}
      {position === 'bottom' && cardsDealt > 0 && (
        <div className="flex flex-row items-center justify-center mb-2">
          {cards.slice(0, cardsDealt).map((card, idx) => (
            <div
              key={idx}
              className="card-shine w-16 h-24 mx-2 rounded shadow-md border-2 border-gray-300 bg-white relative overflow-hidden"
              style={{
                cursor: card.value !== -1 ? 'pointer' : 'default',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: 'scale(1)',
                zIndex: 1,
                transformStyle: 'preserve-3d',
              }}
              onClick={() => card.value !== -1 && onCardClick(idx)}
              onMouseEnter={(e) => {
                if (card.value === -1) return;
                e.currentTarget.style.transform = 'scale(1.15) translateY(-10px)';
                e.currentTarget.style.zIndex = '20';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={(e) => {
                if (card.value === -1) return;
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.zIndex = '1';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
              }}
            >
              <div 
                className="relative w-full h-full" 
                style={{
                  transformStyle: 'preserve-3d',
                  transition: 'transform 0.6s',
                  transform: card.isFlipped ? 'rotateY(180deg)' : 'rotateY(0)',
                  pointerEvents: 'none' // Empêche les interactions avec les éléments enfants
                }}
              >
                {/* Face arrière */}
                <div 
                  className="absolute w-full h-full" 
                  style={{
                    WebkitBackfaceVisibility: 'hidden',
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(0deg)'
                  }}
                >
                  <img
                    src={cardBack}
                    alt="Dos de carte"
                    className="w-full h-full object-cover rounded select-none"
                    draggable="false"
                  />
                </div>
                
                {/* Face avant */}
                <div 
                  className="absolute w-full h-full" 
                  style={{
                    WebkitBackfaceVisibility: 'hidden',
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)'
                  }}
                >
                  <img
                    src={getCardImage(card.value)}
                    alt={`Carte ${card.value}`}
                    className="w-full h-full object-cover rounded select-none"
                    draggable="false"
                    onError={(e) => {
                      // En cas d'erreur de chargement de l'image
                      const target = e.target as HTMLImageElement;
                      target.src = cardBack;
                      target.alt = 'Dos de carte';
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Avatar et nom du joueur */}
      <div className={`flex flex-col items-center ${position === 'bottom' ? 'mt-2' : 'mb-2'}`}>
        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-2xl">
          {position === 'top' ? '👤' : '👤'}
        </div>
        <span className="text-sm font-medium mt-1">{playerName}</span>
      </div>

      {/* Cartes du joueur (pour le joueur du haut) */}
      {position === 'top' && cardsDealt > 0 && (
        <div className="flex flex-row items-center justify-center mt-2">
          {cards.slice(0, cardsDealt).map((card, idx) => (
            <div
              key={idx}
              className="card-shine w-16 h-24 mx-2 rounded shadow-md border-2 border-gray-300 bg-white relative overflow-hidden"
              style={{
                cursor: card.value !== -1 ? 'pointer' : 'default',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: 'scale(1)',
                zIndex: 1,
                transformStyle: 'preserve-3d',
              }}
              onClick={() => card.value !== -1 && onCardClick(idx)}
              onMouseEnter={(e) => {
                if (card.value === -1) return;
                e.currentTarget.style.transform = 'scale(1.15) translateY(-10px)';
                e.currentTarget.style.zIndex = '20';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={(e) => {
                if (card.value === -1) return;
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.zIndex = '1';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
              }}
            >
              <div 
                className="relative w-full h-full" 
                style={{
                  transformStyle: 'preserve-3d',
                  transition: 'transform 0.6s',
                  transform: card.isFlipped ? 'rotateY(180deg)' : 'rotateY(0)',
                  pointerEvents: 'none' // Empêche les interactions avec les éléments enfants
                }}
              >
                {/* Face arrière */}
                <div 
                  className="absolute w-full h-full" 
                  style={{
                    WebkitBackfaceVisibility: 'hidden',
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(0deg)'
                  }}
                >
                  <img
                    src={cardBack}
                    alt="Dos de carte"
                    className="w-full h-full object-cover rounded select-none"
                    draggable="false"
                  />
                </div>
                
                {/* Face avant */}
                <div 
                  className="absolute w-full h-full" 
                  style={{
                    WebkitBackfaceVisibility: 'hidden',
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)'
                  }}
                >
                  <img
                    src={getCardImage(card.value)}
                    alt={`Carte ${card.value}`}
                    className="w-full h-full object-cover rounded select-none"
                    draggable="false"
                    onError={(e) => {
                      // En cas d'erreur de chargement de l'image
                      const target = e.target as HTMLImageElement;
                      target.src = cardBack;
                      target.alt = 'Dos de carte';
                    }}
                  />
                </div>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
};

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
  const [drawnCardAnim, setDrawnCardAnim] = React.useState<{
    value: number;
    position: {x: number, y: number};
    isRevealed: boolean;
  } | null>(null);

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
    setTimeLeft(15);
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
  
  // Formatage du temps restant en MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
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
    console.log('Démarrage du minuteur de 5 secondes pour la phase de mémorisation');
    
    // Nettoyer l'ancien timer s'il existe
    if (beforeRoundTimerRef.current) {
      clearInterval(beforeRoundTimerRef.current);
    }
    
    // Démarrer le compte à rebours de 5 secondes
    setTimeLeft(5);
    
    // Mettre à jour le temps toutes les secondes
    beforeRoundTimerRef.current = setInterval(() => {
      setTimeLeft(prev => {
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
      setIsPlayerTurn(true);
      setTimeLeft(5);
    }
  }, [cardsDealt, gamePhase]);

  // Fonction utilitaire pour obtenir la valeur d'une carte (0-12 pour les valeurs, 13-25 pour les couleurs suivantes, etc.)
  const getCardValue = (card: number): number => {
    return card % 13; // Retourne une valeur de 0 à 12 (As à Roi)
  };

  // Gère la pénalité de défausse rapide
  const handleQuickDiscardPenalty = async (player: 'player1' | 'player2') => {
    if (deck.length < 2) {
      console.log('Pas assez de cartes dans le deck pour la pénalité');
      return;
    }

    setIsInPenalty(true);
    const newDeck = [...deck];
    const penaltyCards = [newDeck.pop()!, newDeck.pop()!];
    setDeck(newDeck);

    // Mettre à jour les cartes du joueur et afficher chaque carte pendant 5 secondes
    for (let i = 0; i < 2; i++) {
      if (player === 'player1') {
        setPlayer1Cards(prev => {
          const newCards = [...prev];
          const emptyIndex = newCards.findIndex(card => card.value === -1);
          if (emptyIndex !== -1) {
            newCards[emptyIndex] = {
              ...newCards[emptyIndex],
              value: penaltyCards[i],
              isFlipped: true
            };
          }
          return newCards;
        });
      } else {
        setPlayer2Cards(prev => {
          const newCards = [...prev];
          const emptyIndex = newCards.findIndex(card => card.value === -1);
          if (emptyIndex !== -1) {
            newCards[emptyIndex] = {
              ...newCards[emptyIndex],
              value: penaltyCards[i],
              isFlipped: true
            };
          }
          return newCards;
        });
      }

      // Attendre 5 secondes avant de passer à la carte suivante
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Retourner la carte face cachée
      if (player === 'player1') {
        setPlayer1Cards(prev => prev.map(card => ({...card, isFlipped: false})));
      } else {
        setPlayer2Cards(prev => prev.map(card => ({...card, isFlipped: false})));
      }
      
      // Petite pause entre les cartes
      if (i === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    setIsInPenalty(false);
  };

  // Gère le clic sur une carte
  const handleCardClick = async (player: 'top' | 'bottom', index: number) => {
    // Vérifie si l'index est valide
    if (index < 0 || index >= 4 || isInPenalty) return; // 4 cartes par joueur
    
    const playerKey = player === 'top' ? 'player1' : 'player2';
    const playerCards = player === 'top' ? player1Cards : player2Cards;
    
    // Vérifier si on est en mode défausse rapide (après la phase de mémorisation)
    if (gamePhase !== 'preparation' && gamePhase !== 'before_round' && discardPile !== null) {
      const topCardValue = getCardValue(discardPile);
      const clickedCardValue = getCardValue(playerCards[index].value);
      
      // Vérifier si la carte cliquée correspond à la valeur de la défausse
      if (clickedCardValue === topCardValue) {
        // Défausse réussie
        const newCards = [...playerCards];
        const discardedCard = newCards[index].value;
        
        // Mettre à jour la défausse
        setDiscardPile(discardedCard);
        
        // Retirer la carte de la main du joueur
        newCards[index] = {
          ...newCards[index],
          value: -1,
          isFlipped: false
        };
        
        if (player === 'top') {
          setPlayer1Cards(newCards);
        } else {
          setPlayer2Cards(newCards);
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
        await handleQuickDiscardPenalty(playerKey);
        return;
      }
    }
    
    // Si on est en train de sélectionner une carte à remplacer
    if (selectingCardToReplace) {
      // Vérifier si le joueur actuel est bien celui qui doit jouer
      const isCurrentPlayer = (player === 'top' && currentPlayer === 'player1') || 
                             (player === 'bottom' && currentPlayer === 'player2');
      
      if (isCurrentPlayer && drawnCard) {
        // Mettre l'ancienne carte dans la défausse
        const oldCardValue = playerCards[index].value;
        if (oldCardValue !== -1) {  // Ne pas défausser les cartes vides
          setDiscardPile(oldCardValue);
        }
        
        // Remplacer la carte sélectionnée par la carte piochée
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
      }
      return;
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
        
        // Vérifier si les deux joueurs ont retourné 2 cartes
        if (updated.player1.count === 2 && updated.player2.count === 2) {
          console.log('Les deux joueurs ont retourné leurs cartes, démarrage du minuteur de 5 secondes');
          // Utiliser un setTimeout pour s'assurer que l'état est mis à jour avant de démarrer le minuteur
          setTimeout(() => {
            startBeforeRoundTimer();
          }, 0);
        }
        
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
    
    // Démarrer la phase d'avant tour
    console.log('Démarrage de la phase avant tour');
    setGamePhase('before_round');
    setCurrentPlayer('player1');
    setIsPlayerTurn(true);
    setTimeLeft(5); // 5 secondes pour la phase de mémorisation
    
    // Réinitialiser l'état des cartes retournées
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
        }, 2000);
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [drawnCard]);

  // Carte piochée en animation
  const drawnCardAnimation = drawnCardAnim ? (
    <div 
      className="fixed z-[1000] w-24 h-36 transition-all duration-500 ease-out"
      style={{
        left: `${drawnCardAnim.position.x}px`,
        top: `${drawnCardAnim.position.y}px`,
        transform: 'translate(-50%, -50%)',
        transformStyle: 'preserve-3d',
        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div 
        className="relative w-full h-full"
        style={{
          transform: drawnCardAnim.isRevealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Face arrière */}
        <div 
          className="absolute w-full h-full rounded-lg shadow-2xl overflow-hidden border-2 border-white"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(0deg)',
            boxShadow: '0 0 30px rgba(255, 255, 0, 0.7)',
          }}
        >
          <img
            src={cardBack}
            alt="Dos de carte"
            className="w-full h-full object-cover"
          />
        </div>
        {/* Face avant */}
        <div 
          className="absolute w-full h-full rounded-lg shadow-2xl overflow-hidden border-2 border-white"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            boxShadow: '0 0 30px rgba(0, 255, 255, 0.7)',
          }}
        >
          <img
            src={getCardImage(drawnCardAnim.value)}
            alt="Carte piochée"
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = cardBack;
              target.alt = 'Dos de carte';
            }}
          />
        </div>
      </div>
    </div>
  ) : null;

  // Carte animée en vol (flyingCard) avec animation fluide et réaliste
  const flyingCard = dealAnim ? (
    <div 
      className="absolute w-16 h-24 z-50"
      style={{
        left: `${dealAnim.from.x}px`,
        top: `${dealAnim.from.y}px`,
        transform: 'translate(-50%, -50%)',
        zIndex: 1000,
        transformStyle: 'preserve-3d',
        pointerEvents: 'none',
        willChange: 'transform, left, top',
        transition: 'none',
      }}
    >
      <div 
        className="relative w-full h-full"
        style={{
          animation: `cardDeal 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards`,
          transformOrigin: 'center',
          willChange: 'transform',
        }}
      >
        <style>
          {`
            @keyframes cardDeal {
              0% {
                transform: 
                  translate(0, 0) 
                  rotateY(0deg) 
                  rotateZ(0deg) 
                  scale(1);
                opacity: 1;
              }
              20% {
                transform: 
                  translate(
                    ${(dealAnim.to.x - dealAnim.from.x) * 0.2}px, 
                    ${(dealAnim.to.y - dealAnim.from.y) * 0.2}px
                  )
                  rotateY(180deg)
                  rotateZ(5deg)
                  scale(1.1);
                opacity: 1;
              }
              80% {
                transform: 
                  translate(
                    ${(dealAnim.to.x - dealAnim.from.x) * 1.1}px, 
                    ${(dealAnim.to.y - dealAnim.from.y) * 1.1}px
                  )
                  rotateY(540deg)
                  rotateZ(-2deg)
                  scale(0.95);
                opacity: 1;
              }
              100% {
                transform: 
                  translate(
                    ${dealAnim.to.x - dealAnim.from.x}px, 
                    ${dealAnim.to.y - dealAnim.from.y}px
                  )
                  rotateY(720deg)
                  rotateZ(0deg)
                  scale(1);
                opacity: 0;
              }
            }
          `}
        </style>
        <div 
          className="absolute w-full h-full rounded-lg shadow-xl overflow-hidden border-2 border-white"
          style={{
            transformStyle: 'preserve-3d',
            backfaceVisibility: 'hidden',
            transition: 'transform 0.3s ease-out',
          }}
        >
          <img
            src={cardBack}
            alt="Carte en vol"
            className="w-full h-full object-cover"
            style={{
              borderRadius: '6px',
              backfaceVisibility: 'hidden',
              transformStyle: 'preserve-3d',
            }}
          />
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div
      className="h-screen w-full bg-cover bg-center homepage-bg grid grid-rows-[min-content_minmax(40px,0.9fr)_1.7fr_minmax(40px,0.9fr)] text-gray-200 overflow-hidden relative"
    >
      {flyingCard}
      {drawnCardAnimation}
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

      {/* Joueur 1 (haut) */}
      <div className="row-start-2 row-end-3 flex items-end justify-center min-h-[40px]">
        <div ref={player1HandRef} style={{minHeight: 0}}>
          <div style={isPlayerActive('player1') ? activePlayerStyle : inactivePlayerStyle}>
            <PlayerZone 
              position="top" 
              playerName="Joueur 1" 
              cardsDealt={cardsDealt} 
              cards={player1Cards}
              onCardClick={(index) => handleCardClick('top', index)}
            />
          </div>
        </div>
      </div>
      {/* Plateau (milieu) : deck à gauche, pile à droite, centre vide */}
      <div className="row-start-3 row-end-4 flex justify-start items-center relative min-h-[140px]">
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
              if (!isPlayerTurn || showCardActions || selectingCardToReplace || drawnCard) return;
              
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
                  
                  // Afficher les actions après l'animation
                  setTimeout(() => {
                    setShowCardActions(true);
                  }, 2000);
                  
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
          </div>
          <div className="text-sm text-gray-300 mt-1">Cliquez pour piocher</div>
        </div>
        {/* Zone centrale avec les informations de jeu */}
        <div className="flex flex-col items-center justify-center">
          <div className="text-center mb-4">
            <div className="text-2xl font-bold mb-2">Memory Master</div>
            <div className="text-lg mb-2">Mode Entraînement</div>
            {isPlayerTurn && (
              <div className="text-yellow-300 font-medium animate-pulse">
                {currentPlayer === 'player1' ? 'Joueur 1' : 'Joueur 2'}, à vous de jouer !
              </div>
            )}
            <div className="mt-2 text-sm bg-black bg-opacity-30 px-3 py-1 rounded-full">
              Temps restant: {formatTime(timeLeft)}
            </div>
            {quickDiscardActive && discardPile !== null && (
              <div className="mt-2 text-sm bg-blue-600 bg-opacity-70 px-3 py-1 rounded-full">
                Défausse rapide active ! Défaussez un {getCardValue(discardPile) + 1}
              </div>
            )}
            {isInPenalty && (
              <div className="mt-2 text-sm bg-red-600 bg-opacity-70 px-3 py-1 rounded-full animate-pulse">
                Mauvaise carte ! Pénalité en cours...
              </div>
            )}
          </div>
          
          {/* Carte piochée */}
          {drawnCard && (
            <div className="relative mb-4 z-50">
              <div className="w-24 h-36 mx-auto mb-2">
                <img
                  src={getCardImage(drawnCard.value)}
                  alt="Carte piochée"
                  className="w-full h-full object-cover rounded-lg shadow-lg"
                />
              </div>
              {showCardActions && (
                <div className="flex flex-col space-y-2 mt-2">
                  <button
                    onClick={() => {
                      // Défausser la carte
                      if (drawnCard) {
                        setDiscardPile(drawnCard.value);
                        setDrawnCard(null);
                        setShowCardActions(false);
                        // Passer au tour suivant
                        handleTurnEnd(currentPlayer);
                      }
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium"
                  >
                    Défausser
                  </button>
                  <button
                    onClick={() => {
                      setShowCardActions(false);
                      setSelectingCardToReplace(true);
                      // Le joueur doit maintenant cliquer sur une carte à remplacer
                    }}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium"
                  >
                    Ajouter à ma main
                  </button>
                </div>
              )}
              {selectingCardToReplace && (
                <div className="text-yellow-300 text-sm mt-2">
                  Cliquez sur la carte à remplacer
                </div>
              )}
            </div>
          )}
          
          {/* Défausse */}
          <div className="flex flex-col items-center">
            <div className="w-24 h-36 bg-gray-800 border-4 border-yellow-400 rounded-xl shadow-xl flex flex-col items-center justify-center mb-2 relative overflow-hidden">
              <span className="absolute -top-3 left-2 bg-yellow-400 text-gray-900 font-bold px-2 py-1 rounded-full text-xs shadow z-10">Défausse</span>
              {discardPile !== null ? (
                <div className="w-full h-full">
                  <img
                    src={getCardImage(discardPile)}
                    alt="Carte défaussée"
                    className="w-full h-full object-cover rounded-lg"
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
      </div>

      {/* Joueur 2 (bas) */}
      <div className="row-start-4 row-end-5 flex items-start justify-center min-h-[60px]">
        <div ref={player2HandRef} style={{minHeight: 0}}>
          <div style={isPlayerActive('player2') ? activePlayerStyle : inactivePlayerStyle}>
            <PlayerZone 
              position="bottom" 
              playerName="Joueur 2" 
              cardsDealt={cardsDealt} 
              cards={player2Cards}
              onCardClick={(index) => handleCardClick('bottom', index)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrainingPage;
