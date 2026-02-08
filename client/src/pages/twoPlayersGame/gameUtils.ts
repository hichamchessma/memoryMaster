import { getCardValue } from '../../utils/cards';

// Style pour mettre en évidence le joueur actif
export const activePlayerStyle = {
  border: '3px solid #4CAF50',
  borderRadius: '8px',
  padding: '5px',
  transition: 'all 0.3s ease-in-out',
  boxShadow: '0 0 10px rgba(76, 175, 80, 0.5)',
};

// Style par défaut pour les joueurs inactifs
export const inactivePlayerStyle = {
  border: '3px solid transparent',
  borderRadius: '8px',
  padding: '5px',
  transition: 'all 0.3s ease-in-out',
  boxShadow: 'none',
};

export interface CardState {
  id: string;     // Identifiant unique pour chaque carte
  value: number;  // 0-51 pour les 52 cartes, -1 pour carte non distribuée
  isFlipped: boolean;
  updated?: number; // Timestamp pour forcer les mises à jour
}

// Calcule le score d'une carte selon les règles
export function getCardScore(value: number): number {
  if (value === -1) return 0; // slot vide
  // Jokers
  if (value >= 104 && value <= 109) return -1; // Joker type 1
  if (value >= 110 && value <= 115) return -2; // Joker type 2
  // Cartes classiques
  const rank = getCardValue(value); // 0..12 (A..K)
  if (rank === 0) return 1; // As
  if (rank >= 1 && rank <= 8) return rank + 1; // 2..9
  if (rank === 9) return 0; // 10
  // Valet, Dame, Roi
  return 10;
}
