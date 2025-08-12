// Utils for card assets and ranks
export const getCardImage = (value: number): string => {
  if (value === -1) return '';
  const suits = ['c', 'd', 'h', 's'];
  const ranks = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'j', 'q', 'k'];
  const suitIndex = Math.floor((value % 52) / 13);
  const rankIndex = (value % 52) % 13;
  const imageName = `card_${ranks[rankIndex]}${suits[suitIndex]}.png`;
  try {
    return new URL(`../assets/cards/${imageName}`, import.meta.url).href;
  } catch (e) {
    console.error(`Impossible de charger l'image de la carte: ${imageName} (valeur: ${value})`, e);
    return '';
  }
};

// 0-12 for ranks (A..K)
export const getCardValue = (card: number): number => card % 13;

export const getRankLabel = (value: number): string => {
  const rankIndex = (value % 52) % 13;
  const labels = ['As', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Valet', 'Dame', 'Roi'];
  return labels[rankIndex] || '';
};
