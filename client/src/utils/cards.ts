// Utils for card assets and ranks
export const getCardImage = (value: number): string => {
  if (value === -1) return '';
  // Jokers: 104..109 => joker, 110..115 => joker2
  if (value >= 104 && value <= 115) {
    const isJ2 = value >= 110; // 6 dernières sont joker2
    const imageName = isJ2 ? 'joker2.png' : 'joker.png';
    try {
      return new URL(`../assets/cards/${imageName}`, import.meta.url).href;
    } catch (e) {
      console.error(`Impossible de charger l'image du joker: ${imageName} (valeur: ${value})`, e);
      return '';
    }
  }
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
  if (value >= 104 && value <= 115) {
    return value >= 110 ? 'Joker2' : 'Joker';
  }
  const rankIndex = (value % 52) % 13;
  const labels = ['As', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Valet', 'Dame', 'Roi'];
  return labels[rankIndex] || '';
};

export const isJoker = (value: number): boolean => value >= 104 && value <= 115;
