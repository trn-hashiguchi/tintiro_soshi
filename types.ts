export enum Phase {
  SETUP = 'SETUP',
  BETTING = 'BETTING',
  ACTION = 'ACTION',
  RESULT = 'RESULT',
}

export enum HandType {
  PINZORO = 'PINZORO', // 1-1-1 (5x)
  ARASHI = 'ARASHI',   // 2-2-2 to 6-6-6 (3x)
  SHIGORO = 'SHIGORO', // 4-5-6 (2x Win)
  POINT = 'POINT',     // Pair + Number (1x)
  HIFUMI = 'HIFUMI',   // 1-2-3 (2x Loss)
  MENASHI = 'MENASHI', // No score (1x Loss)
}

export interface HandResult {
  type: HandType;
  value: number; // Used for tie-breaking (e.g., the single dice number, or Arashi number)
  label: string;
  multiplier: number; // The payout multiplier
  isInstantWin?: boolean; // Shigoro
  isInstantLoss?: boolean; // Hifumi, Menashi
}

export interface Player {
  id: string;
  name: string;
  balance: number;
  currentBet: number;
  isDealer: boolean;
  dice: [number, number, number];
  hand: HandResult | null;
  rollCount: number; // 0 to 3
  isTurnFinished: boolean;
  resultDiff: number; // For displaying result phase + or -
}

export interface GameState {
  phase: Phase;
  players: Player[];
  dealerIndex: number;
  turnOrder: string[]; // Array of player IDs
  currentTurnIndex: number; // Index in turnOrder
  isRolling: boolean;
}