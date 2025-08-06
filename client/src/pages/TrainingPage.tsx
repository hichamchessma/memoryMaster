import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import cardBack from '../assets/cards/card_back.png';

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
    
    setPlayer1Cards([...initialCards]);
    setPlayer2Cards([...initialCards]);
    setCardsDealt(0);
  };

  // Pour stocker les positions deck/main (pour animation)
  const [dealAnim, setDealAnim] = React.useState<null | {
    from: {x: number, y: number},
    to: {x: number, y: number},
    toPlayer: 'top'|'bottom',
    index: number,
    cardValue: number
  }>(null);

  // Délai fixe pour la distribution des cartes (en ms)
  const DEAL_DELAY = 300;

  // Gère le clic sur une carte
  const handleCardClick = (player: 'top' | 'bottom', index: number) => {
    // Vérifie si l'index est valide
    if (index < 0 || index >= 4) return; // 4 cartes par joueur
    
    if (player === 'top') {
      setPlayer1Cards(prevCards => {
        const newCards = [...prevCards];
        if (newCards[index].value !== -1) {
          newCards[index] = { 
            ...newCards[index],
            isFlipped: !newCards[index].isFlipped 
          };
        }
        return newCards;
      });
    } else {
      setPlayer2Cards(prevCards => {
        const newCards = [...prevCards];
        if (newCards[index].value !== -1) {
          newCards[index] = { 
            ...newCards[index],
            isFlipped: !newCards[index].isFlipped 
          };
        }
        return newCards;
      });
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
            setDealAnim({from, to, toPlayer: 'top', index: i, cardValue: cardValue1});
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
            setDealAnim({from, to, toPlayer: 'bottom', index: i, cardValue: cardValue2});
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
  };

  // Désactive le scroll global quand la page est montée
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

  // Carte animée en vol (flyingCard) avec rotation progressive
  const flyingCard = dealAnim ? (
    <div 
      className="absolute w-16 h-24 rounded shadow-lg border-2 border-white bg-white z-50"
      style={{
        left: `${dealAnim.from.x}px`,
        top: `${dealAnim.from.y}px`,
        transform: 'translate(-50%, -50%)',
        transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        zIndex: 1000,
        transformStyle: 'preserve-3d',
        pointerEvents: 'none'
      }}
    >
      <div 
        style={{
          width: '64px',
          height: '96px',
          borderRadius: '8px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          animation: `cardDeal 0.6s cubic-bezier(.6,-0.28,.74,.05) forwards`,
          transformOrigin: 'center',
          position: 'absolute',
          top: 0,
          left: 0
        }}
      >
        <style>
          {`
            @keyframes cardDeal {
              0% {
                transform: translate(0, 0) rotateY(0deg);
              }
              100% {
                transform: translate(
                  ${dealAnim.to.x - dealAnim.from.x}px, 
                  ${dealAnim.to.y - dealAnim.from.y}px
                ) rotateY(720deg);
              }
            }
          `}
        </style>
        <img
          src={cardBack}
          alt="Carte en vol"
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '8px',
            objectFit: 'cover',
            backfaceVisibility: 'hidden',
            transformStyle: 'preserve-3d',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
          }}
        />
      </div>
    </div>
  ) : null;

  return (
    <div
      className="h-screen w-full bg-cover bg-center homepage-bg grid grid-rows-[min-content_minmax(40px,0.9fr)_1.7fr_minmax(40px,0.9fr)] text-gray-200 overflow-hidden relative"
    >
      {flyingCard}
      {/* Bouton Start a new game en haut à gauche */}
      <button
        className="absolute top-3 left-3 z-30 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-lg px-4 py-2 flex items-center justify-center text-base font-bold border-2 border-white focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-60 disabled:cursor-not-allowed"
        title="Start a new game"
        onClick={handleStartNewGame}
        disabled={isDealing}
      >
        <span className="mr-2">🆕</span> Start a new game
      </button>
      {/* Bouton Dashboard en haut à droite */}
      <button
        className="absolute top-3 right-3 z-30 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg w-12 h-12 flex items-center justify-center text-2xl border-2 border-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        title="Retour au Dashboard"
        onClick={() => navigate('/dashboard')}
      >
        <span role="img" aria-label="Dashboard">🏠</span>
      </button>
      {/* Titre */}
      <div className="absolute top-0 left-0 w-full flex items-center justify-center z-20" style={{margin:0,padding:0}}>
        <span className="bg-yellow-400 bg-opacity-90 text-gray-900 px-4 py-1 rounded-xl shadow-xl text-xl font-extrabold tracking-widest border-2 border-white drop-shadow-lg uppercase">Mode Entraînement</span>
      </div>

      {/* Joueur 1 (haut) */}
      <div className="row-start-2 row-end-3 flex items-end justify-center min-h-[40px]">
        <div ref={player1HandRef} style={{minHeight: 0}}>
          <PlayerZone 
            position="top" 
            playerName="Joueur 1" 
            cardsDealt={cardsDealt} 
            cards={player1Cards}
            onCardClick={(index) => handleCardClick('top', index)}
          />
        </div>
      </div>
      {/* Plateau (milieu) : deck à gauche, pile à droite, centre vide */}
      <div className="row-start-3 row-end-4 flex justify-start items-center relative min-h-[140px]">
        {/* Deck à gauche */}
        <div className="flex flex-col items-center ml-6">
          <div ref={deckRef} className="w-24 h-36 bg-blue-800 border-4 border-white rounded-xl shadow-xl flex flex-col items-center justify-center mb-2 relative">
            <span className="absolute -top-3 left-2 bg-yellow-400 text-gray-900 font-bold px-2 py-1 rounded-full text-xs shadow">Cartes</span>
            <span className="text-3xl">🂠</span>
            <span className="mt-2 text-sm font-bold">Deck</span>
          </div>
        </div>
        {/* Défausse juste à droite du deck */}
        <div className="flex flex-col items-center ml-6">
          <div className="w-24 h-36 bg-gray-800 border-4 border-yellow-400 rounded-xl shadow-xl flex flex-col items-center justify-center mb-2 relative">
            <span className="mb-1">Pile</span>
            <span className="text-2xl">🗑️</span>
            <span className="absolute -top-3 left-2 bg-gray-300 text-gray-800 font-bold px-2 py-1 rounded-full text-xs shadow">Défausse</span>
          </div>
        </div>
        {/* Le centre reste vide */}
      </div>
      {/* Joueur 2 (bas) */}
      <div className="row-start-4 row-end-5 flex items-start justify-center min-h-[60px]">
        <div ref={player2HandRef} style={{minHeight: 0}}>
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
  );
};

export default TrainingPage;
