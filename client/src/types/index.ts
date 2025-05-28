// Types pour les utilisateurs
export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  age: number;
  nationality: string;
  elo: number;
  totalPoints: number;
  avatar?: string;
  token?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Types pour les cartes
export type CardValue = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'JOKER';

export interface Card {
  id: string;
  value: CardValue;
  isFlipped: boolean;
  isVisible: boolean;
  position: number;
  ownerId: string | null;
  isDiscarded: boolean;
}

// Types pour les joueurs
export interface Player {
  _id: string;
  user: string | User;
  socketId: string;
  username: string;
  position: number;
  score: number;
  actualScore: number;
  cards: Card[];
  isReady: boolean;
  isHost: boolean;
  isEliminated: boolean;
  hasBombom: boolean;
  bombomActivated: boolean;
  bombomCanceled: boolean;
  powers: {
    jUsed: boolean;
    qUsed: boolean;
    kUsed: boolean;
  };
}

// Types pour le jeu
export interface Game {
  _id: string;
  code: string;
  host: string | User;
  players: Player[];
  deck: Card[];
  discardPile: Card[];
  currentPlayer: string | null;
  phase: 'waiting' | 'exploration' | 'playing' | 'showtime' | 'finished';
  status: 'waiting' | 'playing' | 'finished';
  maxPlayers: number;
  cardsPerPlayer: number;
  currentTurn: number;
  explorationEndTime: number | null;
  turnEndTime: number | null;
  winner: string | null;
  createdAt: string;
  updatedAt: string;
}

// Types pour les événements Socket.IO
export interface ServerToClientEvents {
  // Gestion des parties
  'game:created': (game: Game) => void;
  'game:updated': (game: Game) => void;
  'game:player-joined': (player: Player) => void;
  'game:player-left': (playerId: string) => void;
  'game:started': (game: Game) => void;
  'game:finished': (game: Game) => void;
  
  // Phases de jeu
  'game:exploration-started': (endTime: number) => void;
  'game:turn-started': (playerId: string, endTime: number) => void;
  'game:turn-ended': (game: Game) => void;
  'game:showtime': () => void;
  
  // Actions de jeu
  'game:card-drawn': (card: Card) => void;
  'game:card-played': (card: Card) => void;
  'game:card-discarded': (card: Card) => void;
  'game:card-revealed': (cardId: string, isVisible: boolean) => void;
  'game:cards-swapped': (card1Id: string, card2Id: string) => void;
  'game:bombom-activated': (playerId: string) => void;
  'game:bombom-canceled': (playerId: string) => void;
  'game:player-eliminated': (playerId: string) => void;
  
  // Erreurs
  'game:error': (error: string) => void;
}

export interface ClientToServerEvents {
  // Gestion des parties
  'game:create': (data: { 
    maxPlayers: number; 
    cardsPerPlayer: 4 | 6 | 8 | 10 
  }, callback: (game: Game) => void) => void;
  
  'game:join': (gameCode: string, callback: (game: Game) => void) => void;
  'game:start': (gameId: string, callback: (game: Game) => void) => void;
  'game:leave': (gameId: string, callback: () => void) => void;
  'game:player-ready': (gameId: string, isReady: boolean, callback: (game: Game) => void) => void;
  
  // Actions de jeu
  'game:draw-card': (gameId: string, callback: (game: Game) => void) => void;
  'game:play-card': (data: { 
    gameId: string; 
    cardId: string; 
    replaceCardId?: string 
  }, callback: (game: Game) => void) => void;
  
  'game:discard-card': (data: { 
    gameId: string; 
    cardId: string 
  }, callback: (game: Game) => void) => void;
  
  'game:use-power-j': (data: {
    gameId: string;
    cardId: string;
  }, callback: (game: Game) => void) => void;
  
  'game:use-power-q': (data: {
    gameId: string;
    playerId: string;
    cardIndex: number;
  }, callback: (game: Game) => void) => void;
  
  'game:use-power-k': (data: {
    gameId: string;
    card1Id: string;
    card2Id: string;
  }, callback: (game: Game) => void) => void;
  
  'game:activate-bombom': (gameId: string, callback: (game: Game) => void) => void;
  'game:cancel-bombom': (gameId: string, callback: (game: Game) => void) => void;
  'game:end-turn': (gameId: string, callback: (game: Game) => void) => void;
}

// Types pour les réponses API
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Types pour les formulaires
export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

// Types pour les erreurs de formulaire
export interface FormErrors {
  [key: string]: string;
}

// Types pour les paramètres de requête
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

export interface GameFilters extends PaginationParams {
  status?: 'waiting' | 'playing' | 'finished';
  playerId?: string;
}
