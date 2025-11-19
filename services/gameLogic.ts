
import { HandResult, HandType } from '../types';

export const rollDie = (): number => Math.floor(Math.random() * 6) + 1;

export const rollDice = (): [number, number, number] => [rollDie(), rollDie(), rollDie()];

export const getShonbenHand = (): HandResult => ({
  type: HandType.SHONBEN,
  value: -100,
  label: 'ションベン (1倍)',
  multiplier: 1,
  winMultiplier: 1,
  lossMultiplier: 1
});

export const evaluateHand = (dice: [number, number, number]): HandResult => {
  const sorted = [...dice].sort((a, b) => a - b);
  const [d1, d2, d3] = sorted;

  // Rank 1: Pinzoro (1-1-1)
  if (d1 === 1 && d2 === 1 && d3 === 1) {
    return { type: HandType.PINZORO, value: 15, label: 'ピンゾロ (5倍)', multiplier: 5, winMultiplier: 5, lossMultiplier: 1 };
  }

  // Rank 2: Arashi (Triples)
  if (d1 === d2 && d2 === d3) {
    return { type: HandType.ARASHI, value: 10 + d1, label: `アラシ ${d1} (3倍)`, multiplier: 3, winMultiplier: 3, lossMultiplier: 1 };
  }

  // Rank 3: Shigoro (4-5-6)
  if (d1 === 4 && d2 === 5 && d3 === 6) {
    return { type: HandType.SHIGORO, value: 10, label: 'シゴロ (2倍勝)', multiplier: 2, winMultiplier: 2, lossMultiplier: 1 };
  }

  // Rank 5: Hifumi (1-2-3)
  if (d1 === 1 && d2 === 2 && d3 === 3) {
    return { type: HandType.HIFUMI, value: 0, label: 'ヒフミ (2倍負)', multiplier: 2, winMultiplier: 1, lossMultiplier: 2 };
  }

  // Rank 4: Point (Pair + Single)
  if (d1 === d2) {
    return { type: HandType.POINT, value: d3, label: `${d3}の目 (1倍)`, multiplier: 1, winMultiplier: 1, lossMultiplier: 1 };
  }
  if (d2 === d3) {
    return { type: HandType.POINT, value: d1, label: `${d1}の目 (1倍)`, multiplier: 1, winMultiplier: 1, lossMultiplier: 1 };
  }
  if (d1 === d3) {
    return { type: HandType.POINT, value: d2, label: `${d2}の目 (1倍)`, multiplier: 1, winMultiplier: 1, lossMultiplier: 1 };
  }

  // Rank 6: Menashi (No Score)
  return { type: HandType.MENASHI, value: -1, label: '目なし', multiplier: 1, winMultiplier: 1, lossMultiplier: 1 };
};

// Returns positive if Player wins, negative if Dealer wins.
// Returns absolute amount of Sosi to transfer.
export const calculateOutcome = (dealerHand: HandResult, playerHand: HandResult, bet: number): number => {
  
  let playerWins = false;
  let dealerWins = false;

  // Rank Hierarchy: Higher score is stronger
  const getRankScore = (h: HandResult) => {
    switch(h.type) {
      case HandType.PINZORO: return 60;
      case HandType.ARASHI: return 50; // + value (2-6)
      case HandType.SHIGORO: return 40;
      case HandType.POINT: return 30; // + value (1-6)
      case HandType.MENASHI: return 20; 
      case HandType.HIFUMI: return 10;
      case HandType.SHONBEN: return 0;
      default: return 0;
    }
  };

  let dealerRank = getRankScore(dealerHand);
  let playerRank = getRankScore(playerHand);

  // Add values for tie-breaking within same type
  if (dealerHand.type === HandType.ARASHI || dealerHand.type === HandType.POINT) {
    dealerRank += dealerHand.value;
  }
  if (playerHand.type === HandType.ARASHI || playerHand.type === HandType.POINT) {
    playerRank += playerHand.value;
  }

  // Compare
  if (dealerRank >= playerRank) {
    dealerWins = true;
  } else {
    playerWins = true;
  }

  let payoutMultiplier = 1;

  if (dealerWins) {
    // Payout is determined by max(DealerWinMult, PlayerLossMult)
    // e.g. Dealer Pinzoro(5) vs Player Point(1) -> 5
    // e.g. Dealer Point(1) vs Player Hifumi(2) -> 2
    payoutMultiplier = Math.max(dealerHand.winMultiplier, playerHand.lossMultiplier);
    return -(bet * payoutMultiplier);
  } else {
    // Player Wins
    // e.g. Player Pinzoro(5) vs Dealer Point(1) -> 5
    // e.g. Player Point(1) vs Dealer Hifumi(2) -> 2
    payoutMultiplier = Math.max(playerHand.winMultiplier, dealerHand.lossMultiplier);
    return bet * payoutMultiplier;
  }
};
