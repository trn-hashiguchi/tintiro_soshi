
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
  MENASHI = 'MENASHI', // No score (1x Loss)
  HIFUMI = 'HIFUMI',   // 1-2-3 (2x Loss)
  SHONBEN = 'SHONBEN', // Off table (1x Loss, Weakest)
}

export interface HandResult {
  type: HandType;
  value: number; // Used for tie-breaking
  label: string;
  multiplier: number; // Legacy support
  winMultiplier: number; // Payout multiplier if this hand wins
  lossMultiplier: number; // Payout multiplier if this hand loses
}

export interface Player {
  id: string;
  name: string;
  balance: number;
  topUpAmount: number;
  currentBet: number;
  isDealer: boolean;
  dice: [number, number, number];
  hand: HandResult | null;
  rollCount: number; // 0 to 3
  isTurnFinished: boolean;
  resultDiff: number;
}

export interface GameState {
  phase: Phase;
  players: Player[];
  dealerIndex: number;
  turnOrder: string[];
  currentTurnIndex: number;
  isRolling: boolean;
}
