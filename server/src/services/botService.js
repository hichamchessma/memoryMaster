const { getCardScore, canQuickDiscard } = require('./gameService');

const BOT_ID = 'BOT_PLAYER_001';
const BOT_NAME = { firstName: '🤖 Bot', lastName: 'MemoryAI' };

// ── Bot decision logic ────────────────────────────────────────────────────────

function botDecideReplace(hand, drawnCard) {
  const drawnScore = getCardScore(drawnCard.value);
  let worstIdx = 0;
  let worstScore = -Infinity;
  for (let i = 0; i < hand.length; i++) {
    const s = getCardScore(hand[i].value);
    if (s > worstScore) { worstScore = s; worstIdx = i; }
  }
  // Replace if drawn card is better (lower score) than worst card
  return drawnScore < worstScore ? worstIdx : null;
}

function botShouldBombom(hand) {
  const total = hand.reduce((s, c) => s + getCardScore(c.value), 0);
  return total <= 4 && Math.random() < 0.7;
}

function botQuickDiscard(hand, topDiscard) {
  if (!topDiscard) return null;
  for (let i = 0; i < hand.length; i++) {
    if (canQuickDiscard(hand[i].value, topDiscard)) return i;
  }
  return null;
}

module.exports = { BOT_ID, BOT_NAME, botDecideReplace, botShouldBombom, botQuickDiscard };
