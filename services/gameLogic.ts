import { HandResult, HandType } from '../types';

export const rollDie = (): number => Math.floor(Math.random() * 6) + 1;

export const rollDice = (): [number, number, number] => [rollDie(), rollDie(), rollDie()];

export const evaluateHand = (dice: [number, number, number]): HandResult => {
  const sorted = [...dice].sort((a, b) => a - b);
  const [d1, d2, d3] = sorted;

  // Rank 1: Pinzoro (1-1-1)
  if (d1 === 1 && d2 === 1 && d3 === 1) {
    return { type: HandType.PINZORO, value: 15, label: 'ピンゾロ (5倍)', multiplier: 5 };
  }

  // Rank 2: Arashi (Triples)
  if (d1 === d2 && d2 === d3) {
    return { type: HandType.ARASHI, value: 10 + d1, label: `アラシ ${d1} (3倍)`, multiplier: 3 };
  }

  // Rank 3: Shigoro (4-5-6)
  if (d1 === 4 && d2 === 5 && d3 === 6) {
    return { type: HandType.SHIGORO, value: 10, label: 'シゴロ (2倍勝)', multiplier: 2, isInstantWin: true };
  }

  // Rank 5: Hifumi (1-2-3)
  if (d1 === 1 && d2 === 2 && d3 === 3) {
    return { type: HandType.HIFUMI, value: 0, label: 'ヒフミ (2倍負)', multiplier: 2, isInstantLoss: true };
  }

  // Rank 4: Point (Pair + Single)
  if (d1 === d2) {
    return { type: HandType.POINT, value: d3, label: `${d3}の目 (1倍)`, multiplier: 1 };
  }
  if (d2 === d3) {
    return { type: HandType.POINT, value: d1, label: `${d1}の目 (1倍)`, multiplier: 1 };
  }
  if (d1 === d3) {
    // Since sorted, this case d1==d3 implies d1==d2==d3 which is Arashi, caught above.
    // But theoretically for non-sorted inputs:
    return { type: HandType.POINT, value: d2, label: `${d2}の目 (1倍)`, multiplier: 1 };
  }

  // Rank 6: Menashi (No Score)
  return { type: HandType.MENASHI, value: -1, label: '目なし', multiplier: 1, isInstantLoss: true };
};

// Returns positive if Player wins, negative if Dealer wins.
// Returns absolute amount of Sosi to transfer.
export const calculateOutcome = (dealerHand: HandResult, playerHand: HandResult, bet: number): number => {
  
  // Compare strengths
  let playerWins = false;
  let dealerWins = false;
  let multiplier = 1;

  // Rank Hierarchy Check
  const getRankScore = (h: HandResult) => {
    switch(h.type) {
      case HandType.PINZORO: return 6;
      case HandType.ARASHI: return 5;
      case HandType.SHIGORO: return 4;
      case HandType.POINT: return 3;
      case HandType.MENASHI: return 1; // Treat menashi as weak
      case HandType.HIFUMI: return 0; // Treat hifumi as weakest for comparison logic, but it triggers instant loss
      default: return 0;
    }
  };

  const dealerRank = getRankScore(dealerHand);
  const playerRank = getRankScore(playerHand);

  // Special Instant Win/Loss Cases
  if (dealerHand.type === HandType.SHIGORO) return -bet * 2; // Dealer Shigoro -> Player loses 2x
  if (playerHand.type === HandType.SHIGORO) return bet * 2;  // Player Shigoro -> Player wins 2x
  if (dealerHand.type === HandType.HIFUMI) return bet * 2;   // Dealer Hifumi -> Player wins 2x (Dealer loses)
  if (playerHand.type === HandType.HIFUMI) return -bet * 2;  // Player Hifumi -> Player loses 2x

  // If Ranks are different
  if (dealerRank > playerRank) {
    dealerWins = true;
    multiplier = dealerHand.multiplier;
  } else if (playerRank > dealerRank) {
    playerWins = true;
    multiplier = playerHand.multiplier;
  } else {
    // Same Rank
    if (dealerHand.type === HandType.ARASHI) {
       // Compare Arashi Numbers
       if (dealerHand.value >= playerHand.value) {
         dealerWins = true; // Dealer wins ties
         multiplier = 3;
       } else {
         playerWins = true;
         multiplier = 3;
       }
    } else if (dealerHand.type === HandType.POINT) {
      // Compare Points
      if (dealerHand.value >= playerHand.value) {
        dealerWins = true; // Dealer wins ties
        multiplier = 1;
      } else {
        playerWins = true;
        multiplier = 1;
      }
    } else if (dealerHand.type === HandType.PINZORO) {
      // Both Pinzoro (Rare) -> Dealer wins ties
      dealerWins = true;
      multiplier = 5;
    } else {
      // Both Menashi -> Dealer wins
      dealerWins = true;
      multiplier = 1;
    }
  }

  return playerWins ? (bet * multiplier) : -(bet * multiplier);
};
