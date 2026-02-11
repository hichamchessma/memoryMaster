export type GamePhase = 'preparation' | 'before_round' | 'player1_turn' | 'player2_turn';

export type TurnPlayer = 'player1' | 'player2';

export interface CardStateLike {
  id?: string | number;
  value: number;
  isFlipped: boolean;
  [key: string]: unknown;
}

export interface TablePlayer {
  _id: string;
  firstName: string;
  lastName: string;
  position: number;
  isReady?: boolean;
}

export interface TableDataLike {
  tableId?: string;
  tableCode?: string;
  currentUserId?: string;
  players?: TablePlayer[];
}

export interface PlayerInfoLike {
  name: string;
  isReal: boolean;
  userId: string;
}

export interface SocketLike {
  id?: string;
  connected?: boolean;
  emit: (event: string, payload?: unknown) => void;
  on: (event: string, handler: (payload: unknown) => void) => void;
  off: (event: string, handler?: (payload: unknown) => void) => void;
}

export interface PlayerJoinedPayload {
  table?: {
    players?: TablePlayer[];
  };
}

export interface ReadyChangedPayload {
  userId: string;
  isReady: boolean;
}

export interface CardsDealtPayload {
  myCards: Array<{ value: number }>;
  opponentCards: Array<{ value: number }>;
  amIPlayer1: boolean;
}

export interface TurnChangedPayload {
  currentPlayerId: string;
  timeLeft?: number;
}

export interface CardDrawnPayload {
  card: { value: number };
}

export interface OpponentDrewCardPayload {
  drawnFromDeck: boolean;
}

export interface CardDiscardedPayload {
  userId: string;
  cardIndex: number;
  discardedCard: number;
  currentPlayerId?: string;
  isQuickDiscard?: boolean;
  playerCards?: Array<{ value: number }>;
}

export interface CardReplacedPayload {
  userId: string;
  cardIndex: number;
  newCard: { value: number };
  currentPlayerId?: string;
}

export interface PenaltyCardsReceivedPayload {
  penaltyCards: Array<{ value: number }>;
  totalCards: number;
}

export interface QuickDiscardPenaltyAppliedPayload {
  penalizedPlayer: string;
  faultyCardIndex: number;
}

export interface BombomDeclaredPayload {
  player: TurnPlayer;
  userId: string;
}

export interface BombomCancelledPayload {
  player: TurnPlayer;
  userId: string;
}

export interface BombomPromptPayload {
  player: TurnPlayer;
}

export interface PowerActivatedPayload {
  userId: string;
  powerType: 'jack' | 'queen' | 'king';
}

export interface PowerCompletedPayload {
  userId: string;
  powerType: 'jack' | 'queen' | 'king';
  nextPlayerId?: string;
}

export interface KingSwapCardsPayload {
  userId: string;
  card1: { index: number; position: 'top' | 'bottom'; oldValue: number; newValue: number };
  card2: { index: number; position: 'top' | 'bottom'; oldValue: number; newValue: number };
}

export interface TimersStoppedPayload {
  tableId: string;
}

export interface TimerUpdatePayload {
  phase: 'memorization' | 'game' | 'choice';
  timeLeft: number;
  memoTimeLeft?: number;
  gameTimeLeft?: number;
  choiceTimeLeft?: number;
}

export interface ShowTimePayload {
  player1Cards: CardStateLike[];
  player2Cards: CardStateLike[];
  player1Id: string;
  player2Id: string;
}
