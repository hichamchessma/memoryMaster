const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const cardSchema = new mongoose.Schema({
  id: {
    type: String,
    default: () => uuidv4(),
    required: true
  },
  value: {
    type: String,
    required: true,
    enum: ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'JOKER']
  },
  isFlipped: {
    type: Boolean,
    default: false
  },
  isVisible: {
    type: Boolean,
    default: false
  },
  position: {
    type: Number,
    required: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  isDiscarded: {
    type: Boolean,
    default: false
  },
  revealedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, { _id: false, timestamps: true });

const playerSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  socketId: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true
  },
  position: {
    type: Number,
    required: true
  },
  score: {
    type: Number,
    default: 0
  },
  actualScore: {
    type: Number,
    default: 0
  },
  cards: [cardSchema],
  isReady: {
    type: Boolean,
    default: false
  },
  isHost: {
    type: Boolean,
    default: false
  },
  isEliminated: {
    type: Boolean,
    default: false
  },
  hasBombom: {
    type: Boolean,
    default: false
  },
  bombomActivated: {
    type: Boolean,
    default: false
  },
  bombomCanceled: {
    type: Boolean,
    default: false
  },
  powers: {
    jUsed: {
      type: Boolean,
      default: false
    },
    qUsed: {
      type: Boolean,
      default: false
    },
    kUsed: {
      type: Boolean,
      default: false
    }
  },
  lastAction: {
    type: String,
    enum: ['DRAW', 'PLAY', 'DISCARD', 'POWER_J', 'POWER_Q', 'POWER_K', 'BOMBOM', 'END_TURN'],
    default: null
  }
}, { _id: false });

const gameSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    minlength: 4,
    maxlength: 6
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  players: [playerSchema],
  deck: [cardSchema],
  discardPile: [cardSchema],
  currentPlayer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  phase: {
    type: String,
    enum: ['waiting', 'exploration', 'playing', 'showtime', 'finished'],
    default: 'waiting'
  },
  status: {
    type: String,
    enum: ['waiting', 'playing', 'finished'],
    default: 'waiting'
  },
  maxPlayers: {
    type: Number,
    required: true,
    min: 2,
    max: 6,
    default: 4
  },
  cardsPerPlayer: {
    type: Number,
    required: true,
    enum: [4, 6, 8, 10],
    default: 6
  },
  currentTurn: {
    type: Number,
    default: 0
  },
  explorationEndTime: {
    type: Date,
    default: null
  },
  turnEndTime: {
    type: Date,
    default: null
  },
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  settings: {
    turnDuration: {
      type: Number,
      default: 30 // secondes
    },
    explorationDuration: {
      type: Number,
      default: 10 // secondes
    },
    powerJDuration: {
      type: Number,
      default: 3 // secondes
    },
    powerQDuration: {
      type: Number,
      default: 3 // secondes
    }
  },
  lastDiscardedCard: cardSchema,
  discardedCards: [{
    card: cardSchema,
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  drawPile: [cardSchema],
  explorationEndTime: {
    type: Date
  },
  turnEndTime: {
    type: Date
  },
  turnTimeLimit: {
    type: Number,
    default: 30000 // 30 secondes par défaut
  },
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  startedAt: {
    type: Date
  },
  finishedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Méthode pour obtenir le joueur actif
gameSchema.methods.getCurrentPlayer = function() {
  return this.players[this.currentPlayerIndex];
};

// Méthode pour passer au joueur suivant
gameSchema.methods.nextPlayer = function() {
  do {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
  } while (this.players[this.currentPlayerIndex].isEliminated);
  
  // Vérifier si la partie est terminée (un seul joueur restant)
  const activePlayers = this.players.filter(p => !p.isEliminated);
  if (activePlayers.length === 1) {
    this.status = 'FINISHED';
    this.winner = activePlayers[0].user;
    this.finishedAt = new Date();
  }
  
  return this.save();
};

// Méthode pour calculer le score d'une carte
gameSchema.statics.calculateCardPoints = function(cardValue) {
  if (cardValue === 'A') return 1;
  if (cardValue === '10') return 0;
  if (['J', 'Q', 'K'].includes(cardValue)) return 10;
  if (cardValue === 'JOKER') return -1;
  return parseInt(cardValue, 10);
};

// Méthode pour initialiser le jeu
gameSchema.methods.initializeGame = function() {
  // Créer un jeu de cartes complet
  const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const suits = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];
  
  // Créer les cartes normales
  let cards = [];
  values.forEach(value => {
    suits.forEach(suit => {
      cards.push({
        value,
        suit,
        points: this.constructor.calculateCardPoints(value)
      });
    });
  });
  
  // Ajouter des jokers (2 par défaut)
  for (let i = 0; i < 2; i++) {
    cards.push({
      value: 'JOKER',
      suit: 'NONE',
      points: -1
    });
  }
  
  // Mélanger les cartes
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  
  // Distribuer les cartes aux joueurs
  this.players.forEach((player, index) => {
    const start = index * this.cardsPerPlayer;
    const end = start + this.cardsPerPlayer;
    player.cards = cards.slice(start, end).map(card => ({
      ...card,
      isVisible: false
    }));
  });
  
  // Le reste des cartes va dans la pioche
  this.drawPile = cards.slice(this.players.length * this.cardsPerPlayer);
  
  // Définir le statut à EXPLORATION et définir le timer
  this.status = 'EXPLORATION';
  this.explorationEndTime = new Date(Date.now() + 10000); // 10 secondes d'exploration
  
  return this.save();
};

const Game = mongoose.model('Game', gameSchema);

module.exports = Game;
