const { v4: uuidv4 } = require('uuid');

// ─── Deck ────────────────────────────────────────────────────────────────────

function buildDeck() {
  const cards = [];
  for (let d = 0; d < 2; d++)
    for (let v = 0; v < 52; v++)
      cards.push({ id: uuidv4(), value: v, isFlipped: false });
  for (let v = 104; v < 110; v++) cards.push({ id: uuidv4(), value: v, isFlipped: false });
  for (let v = 110; v < 116; v++) cards.push({ id: uuidv4(), value: v, isFlipped: false });
  return shuffle(cards);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

function getCardScore(value) {
  if (value >= 104 && value <= 109) return -1;  // Joker1
  if (value >= 110 && value <= 115) return -2;  // Joker2
  const rank = value % 13;
  if (rank === 0) return 1;   // Ace
  if (rank === 9) return 0;   // 10
  if (rank >= 10) return 10;  // J Q K
  return rank + 1;            // 2-9
}

function calcScore(cards) {
  return cards.reduce((sum, c) => sum + getCardScore(c.value), 0);
}

// ─── Game State Factory ───────────────────────────────────────────────────────

function createGameState(players, config = {}) {
  const CARDS_PER_PLAYER = [4, 6, 8].includes(config.cardsPerPlayer) ? config.cardsPerPlayer : 4;
  const memoDuration     = Math.round(
    Math.min(Math.max(Number(config.memoDuration) || 7, 3), 30)
  ) * 1000;

  const deck = buildDeck();
  const hands = {};

  for (const p of players) {
    hands[p.userId] = deck.splice(0, CARDS_PER_PLAYER);
  }

  const turnOrder = players.map(p => p.userId);

  return {
    phase: 'memorization',
    deck,
    discardPile: [],
    hands,
    turnOrder,
    currentTurnIndex: 0,
    drawnCard: null,
    drawPhase: true,
    bombomBy: null,
    bombomCancelUsed: {},
    powers: {},
    activePower: null,
    scores: {},
    winner: null,
    memoStartTime: Date.now(),
    memoDuration,
    cardsPerPlayer: CARDS_PER_PLAYER,  // exposé pour le client
  };
}

// ─── Quick-discard matching ───────────────────────────────────────────────────

function canQuickDiscard(cardValue, topDiscard) {
  if (!topDiscard) return false;
  const isJoker1 = (v) => v >= 104 && v <= 109;
  const isJoker2 = (v) => v >= 110 && v <= 115;
  if (isJoker1(cardValue) && isJoker1(topDiscard.value)) return true;
  if (isJoker2(cardValue) && isJoker2(topDiscard.value)) return true;
  return (cardValue % 13) === (topDiscard.value % 13);
}

module.exports = {
  buildDeck,
  shuffle,
  generateCode,
  getCardScore,
  calcScore,
  createGameState,
  canQuickDiscard,
};
