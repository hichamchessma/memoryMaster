const Game = require('../models/Game');

// Générer un code de partie unique
exports.generateGameCode = async () => {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Éviter les caractères ambigus
  const codeLength = 5;
  let code;
  let isUnique = false;

  while (!isUnique) {
    code = '';
    for (let i = 0; i < codeLength; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    // Vérifier si le code existe déjà
    const existingGame = await Game.findOne({ code });
    if (!existingGame) {
      isUnique = true;
    }
  }

  return code;
};

// Calculer les points d'une carte
exports.calculateCardPoints = (cardValue) => {
  if (cardValue === 'A') return 1;
  if (cardValue === '10') return 0;
  if (['J', 'Q', 'K'].includes(cardValue)) return 10;
  if (cardValue === 'JOKER') return -1;
  return parseInt(cardValue, 10);
};

// Mélanger un tableau (algorithme de Fisher-Yates)
exports.shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// Créer un jeu de cartes complet
exports.createDeck = () => {
  const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const suits = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];
  
  let cards = [];
  
  // Ajouter les cartes normales
  values.forEach(value => {
    suits.forEach(suit => {
      cards.push({
        value,
        suit,
        points: this.calculateCardPoints(value),
        isVisible: false
      });
    });
  });
  
  // Ajouter des jokers (2 par défaut)
  for (let i = 0; i < 2; i++) {
    cards.push({
      value: 'JOKER',
      suit: 'NONE',
      points: -1,
      isVisible: false
    });
  }
  
  return this.shuffleArray(cards);
};

// Distribuer les cartes aux joueurs
exports.dealCards = (deck, playerCount, cardsPerPlayer) => {
  const playersCards = [];
  const remainingDeck = [...deck];
  
  for (let i = 0; i < playerCount; i++) {
    const playerHand = [];
    
    // Distribuer les cartes du bas (visibles)
    const bottomCards = remainingDeck.splice(0, cardsPerPlayer / 2)
      .map(card => ({ ...card, position: 'BOTTOM' }));
    
    // Distribuer les cartes du haut (cachées)
    const topCards = remainingDeck.splice(0, cardsPerPlayer / 2)
      .map(card => ({ ...card, position: 'TOP' }));
    
    // Mélanger les cartes du haut et du bas pour le joueur
    playerHand.push(...this.shuffleArray([...bottomCards, ...topCards]));
    playersCards.push(playerHand);
  }
  
  return {
    playersCards,
    remainingDeck
  };
};
