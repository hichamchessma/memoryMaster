const SUITS = ['c', 'd', 'h', 's'] as const
const RANKS = ['a', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'j', 'q', 'k'] as const

export function getCardImage(value: number): string {
  if (value === -1) return ''
  if (value >= 104 && value <= 109) return '/assets/cards/joker.png'
  if (value >= 110 && value <= 115) return '/assets/cards/joker2.png'
  const rank = value % 13
  const suit = Math.floor((value % 52) / 13)
  return `/assets/cards/card_${RANKS[rank]}${SUITS[suit]}.png`
}

export function getCardBack(): string {
  return '/assets/cards/card_back.png'
}

export function getCardScore(value: number): number {
  if (value >= 104 && value <= 109) return -1
  if (value >= 110 && value <= 115) return -2
  const rank = value % 13
  if (rank === 0) return 1   // Ace
  if (rank === 9) return 0   // 10
  if (rank >= 10) return 10  // J Q K
  return rank + 1
}

export function getRankLabel(value: number): string {
  if (value >= 104 && value <= 109) return 'Joker'
  if (value >= 110 && value <= 115) return 'Joker★'
  const labels = ['As', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Valet', 'Dame', 'Roi']
  return labels[value % 13] ?? '?'
}

export function isJack(value: number) { return value % 13 === 10 }
export function isQueen(value: number) { return value % 13 === 11 }
export function isKing(value: number)  { return value % 13 === 12 }
export function isFigure(value: number) { return isJack(value) || isQueen(value) || isKing(value) }
