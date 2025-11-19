import React, { useState, useEffect, useCallback } from 'react';
import { Phase, Player, GameState, HandType, HandResult } from './types';
import { rollDice, evaluateHand, calculateOutcome } from './services/gameLogic';
import { DiceDisplay } from './components/DiceDisplay';

const STARTING_BALANCE = 20000;

export default function App() {
  // --- State ---
  const [state, setState] = useState<GameState>({
    phase: Phase.SETUP,
    players: [],
    dealerIndex: 0,
    turnOrder: [],
    currentTurnIndex: 0,
    isRolling: false,
  });

  // --- Setup Phase Input ---
  const [setupNames, setSetupNames] = useState<string[]>(['Player 1', 'Player 2']);

  const addSetupPlayer = () => {
    if (setupNames.length < 6) setSetupNames([...setupNames, `Player ${setupNames.length + 1}`]);
  };

  const removeSetupPlayer = () => {
    if (setupNames.length > 2) setSetupNames(setupNames.slice(0, -1));
  };

  const updateSetupName = (index: number, name: string) => {
    const newNames = [...setupNames];
    newNames[index] = name;
    setSetupNames(newNames);
  };

  const startGame = () => {
    const initialPlayers: Player[] = setupNames.map((name, idx) => ({
      id: `p-${idx}`,
      name: name.trim() || `Player ${idx + 1}`,
      balance: STARTING_BALANCE,
      currentBet: 0,
      isDealer: idx === 0,
      dice: [1, 1, 1],
      hand: null,
      rollCount: 0,
      isTurnFinished: false,
      resultDiff: 0,
    }));

    setState({
      ...state,
      phase: Phase.BETTING,
      players: initialPlayers,
      dealerIndex: 0,
    });
  };

  // --- Betting Phase Logic ---
  const handleBetChange = (playerId: string, amount: number) => {
    setState((prev) => ({
      ...prev,
      players: prev.players.map((p) => {
        if (p.id !== playerId) return p;
        // Clamp bet between 0 and balance
        const safeAmount = Math.max(0, Math.min(p.balance, amount));
        return { ...p, currentBet: safeAmount };
      }),
    }));
  };

  const confirmBets = () => {
    // 1. Determine Turn Order: Children (Low Bet -> High Bet) then Dealer
    const dealer = state.players[state.dealerIndex];
    const children = state.players.filter((p) => p.id !== dealer.id);
    
    // Sort children: Lowest bet first. If equal, stable sort (registration order)
    children.sort((a, b) => a.currentBet - b.currentBet);

    const newTurnOrder = [...children.map(p => p.id), dealer.id];

    setState({
      ...state,
      phase: Phase.ACTION,
      turnOrder: newTurnOrder,
      currentTurnIndex: 0,
      players: state.players.map(p => ({
        ...p, 
        rollCount: 0, 
        hand: null, 
        isTurnFinished: false 
      }))
    });
  };

  // --- Action Phase Logic ---
  const currentPlayerId = state.turnOrder[state.currentTurnIndex];
  const currentPlayer = state.players.find(p => p.id === currentPlayerId);

  const rollAction = useCallback(async () => {
    if (state.isRolling || !currentPlayer) return;

    setState(prev => ({ ...prev, isRolling: true }));

    // Animation Loop
    const animationDuration = 600;
    const intervalTime = 50;
    const steps = animationDuration / intervalTime;
    
    for (let i = 0; i < steps; i++) {
       await new Promise(r => setTimeout(r, intervalTime));
       setState(prev => ({
         ...prev,
         players: prev.players.map(p => 
           p.id === currentPlayerId ? { ...p, dice: rollDice() } : p
         )
       }));
    }

    // Final Result
    const finalDice = rollDice();
    const handResult = evaluateHand(finalDice);
    
    setState(prev => {
      const updatedPlayers = prev.players.map(p => {
        if (p.id !== currentPlayerId) return p;
        return {
          ...p,
          dice: finalDice,
          rollCount: p.rollCount + 1,
          hand: handResult
        };
      });
      
      return { ...prev, isRolling: false, players: updatedPlayers };
    });
  }, [state.isRolling, currentPlayerId, currentPlayer]);


  const finishTurn = useCallback(() => {
    const isLastPlayer = state.currentTurnIndex === state.turnOrder.length - 1;

    setState(prev => {
        const updatedPlayers = prev.players.map(p => 
            p.id === currentPlayerId ? { ...p, isTurnFinished: true } : p
        );

        if (isLastPlayer) {
            // Calculate Results immediately
            const dealer = updatedPlayers[prev.dealerIndex];
            // Dealer hand fallback if somehow null (shouldn't happen if logic is sound)
            const dealerHand = dealer.hand || { type: HandType.MENASHI, value: -1, label: '目なし', multiplier: 1 };

            const resolvedPlayers = updatedPlayers.map(p => {
                if (p.isDealer) return { ...p, resultDiff: 0 }; // Calculated via summing children
                const pHand = p.hand || { type: HandType.MENASHI, value: -1, label: '目なし', multiplier: 1 };
                const diff = calculateOutcome(dealerHand, pHand, p.currentBet);
                return { ...p, resultDiff: diff };
            });

            // Calculate Dealer's total diff
            let dealerTotalDiff = 0;
            resolvedPlayers.forEach(p => {
                if (!p.isDealer) {
                    dealerTotalDiff -= p.resultDiff; // Inverse of player
                }
            });

            // Apply Balances
            const finalPlayers = resolvedPlayers.map(p => {
                if (p.isDealer) {
                    return { ...p, resultDiff: dealerTotalDiff, balance: p.balance + dealerTotalDiff };
                }
                return { ...p, balance: p.balance + p.resultDiff };
            });

            return {
                ...prev,
                phase: Phase.RESULT,
                players: finalPlayers
            };
        } else {
            return {
                ...prev,
                currentTurnIndex: prev.currentTurnIndex + 1,
                players: updatedPlayers
            };
        }
    });
  }, [state.currentTurnIndex, state.turnOrder.length, currentPlayerId, state.dealerIndex]);

  // Auto-advance if instant win/loss or max rolls reached
  useEffect(() => {
    if (state.phase !== Phase.ACTION || state.isRolling || !currentPlayer) return;

    const hand = currentPlayer.hand;
    if (!hand) return; // Hasn't rolled yet this turn

    const hasValidHand = hand.type !== HandType.MENASHI;
    const maxRollsReached = currentPlayer.rollCount >= 3;

    // If we have a valid hand (Point, Arashi, etc.) OR max rolls, the turn is effectively done.
    // However, for UX, we might want the user to click "Next" to confirm they saw the dice.
    // BUT, the requirement says "3 times max. If no hand, it's menashi".
    // If valid hand is rolled on 1st try, they stop. 
  }, [state.phase, state.isRolling, currentPlayer]);


  const nextGame = () => {
      // Rotate Dealer
      const nextDealerIndex = (state.dealerIndex + 1) % state.players.length;
      
      const resetPlayers = state.players.map((p, idx) => ({
          ...p,
          isDealer: idx === nextDealerIndex,
          currentBet: 0,
          dice: [1, 1, 1] as [number, number, number],
          hand: null,
          rollCount: 0,
          isTurnFinished: false,
          resultDiff: 0,
      }));

      setState({
          ...state,
          phase: Phase.BETTING,
          dealerIndex: nextDealerIndex,
          players: resetPlayers,
      });
  };


  // --- Renders ---

  if (state.phase === Phase.SETUP) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="bg-green-800 p-8 rounded-xl shadow-2xl border-4 border-yellow-600 max-w-md w-full">
          <h1 className="text-4xl font-bold text-yellow-400 mb-6 text-center drop-shadow-md">ソシー・バトル</h1>
          <div className="space-y-4 mb-6">
            {setupNames.map((name, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-6 text-center font-bold">{idx + 1}.</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => updateSetupName(idx, e.target.value)}
                  className="flex-1 p-2 rounded text-black"
                  placeholder="名前を入力"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-4 justify-center mb-6">
            <button onClick={addSetupPlayer} disabled={setupNames.length >= 6} className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 disabled:opacity-50 text-sm font-bold">＋ 人数追加</button>
            <button onClick={removeSetupPlayer} disabled={setupNames.length <= 2} className="px-4 py-2 bg-red-600 rounded hover:bg-red-500 disabled:opacity-50 text-sm font-bold">ー 削除</button>
          </div>
          <button 
            onClick={startGame}
            className="w-full py-4 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black font-bold text-xl rounded shadow-lg transform transition hover:scale-105"
          >
            ゲーム開始
          </button>
        </div>
      </div>
    );
  }

  const dealer = state.players[state.dealerIndex];

  return (
    <div className="min-h-screen flex flex-col p-2 max-w-5xl mx-auto">
      {/* Header */}
      <header className="flex justify-between items-center bg-green-800 p-4 rounded-lg mb-4 border-b-4 border-yellow-600">
        <h1 className="text-xl font-bold text-yellow-400">Phase: {state.phase === Phase.BETTING ? '賭け金設定' : state.phase === Phase.ACTION ? '勝負' : '結果'}</h1>
        <div className="text-sm">親: <span className="font-bold text-yellow-300 text-lg">{dealer.name}</span></div>
      </header>

      {/* BETTING PHASE */}
      {state.phase === Phase.BETTING && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <div className="text-center mb-4">
                <h2 className="text-3xl font-bold mb-2">親: {dealer.name}</h2>
                <p className="text-green-200">所持金: {dealer.balance.toLocaleString()}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                {state.players.map((p) => {
                    if (p.isDealer) return null;
                    return (
                        <div key={p.id} className="bg-green-800 p-4 rounded-lg border border-green-600 flex flex-col">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-lg">{p.name}</span>
                                <span className="text-yellow-300">所持: {p.balance.toLocaleString()}</span>
                            </div>
                            <label className="text-sm mb-1">賭け金 (Bet)</label>
                            <input 
                                type="number" 
                                value={p.currentBet} 
                                onChange={(e) => handleBetChange(p.id, parseInt(e.target.value) || 0)}
                                className="w-full p-2 rounded text-black font-bold text-right text-xl"
                                min="0"
                                max={p.balance}
                            />
                            <div className="flex gap-2 mt-2">
                                <button onClick={() => handleBetChange(p.id, 100)} className="bg-white/10 hover:bg-white/20 px-2 py-1 text-xs rounded">+100</button>
                                <button onClick={() => handleBetChange(p.id, 1000)} className="bg-white/10 hover:bg-white/20 px-2 py-1 text-xs rounded">+1,000</button>
                                <button onClick={() => handleBetChange(p.id, Math.floor(p.balance / 2))} className="bg-white/10 hover:bg-white/20 px-2 py-1 text-xs rounded">半額</button>
                                <button onClick={() => handleBetChange(p.id, p.balance)} className="bg-red-600 hover:bg-red-500 px-2 py-1 text-xs rounded font-bold">全額</button>
                            </div>
                        </div>
                    );
                })}
            </div>

            <button 
                onClick={confirmBets}
                disabled={state.players.some(p => !p.isDealer && p.currentBet <= 0)}
                className="mt-8 px-12 py-4 bg-yellow-500 text-black font-bold text-2xl rounded-full shadow-lg hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                勝負開始！
            </button>
            {state.players.some(p => !p.isDealer && p.currentBet <= 0) && (
                <p className="text-red-300 text-sm animate-pulse">※全員賭け金を設定してください</p>
            )}
        </div>
      )}

      {/* ACTION PHASE */}
      {state.phase === Phase.ACTION && currentPlayer && (
        <div className="flex-1 flex flex-col items-center">
            {/* Turn Indicator */}
            <div className="w-full flex justify-center mb-8 overflow-x-auto">
                <div className="flex space-x-2">
                    {state.turnOrder.map((pid, idx) => {
                         const p = state.players.find(pl => pl.id === pid);
                         if (!p) return null;
                         const isActive = idx === state.currentTurnIndex;
                         const isDone = idx < state.currentTurnIndex;
                         return (
                             <div key={pid} className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${isActive ? 'bg-yellow-500 text-black font-bold ring-4 ring-yellow-500/30' : isDone ? 'bg-gray-600 text-gray-400' : 'bg-green-700'}`}>
                                 {p.name} {p.isDealer ? '(親)' : `Bet: ${p.currentBet}`}
                             </div>
                         )
                    })}
                </div>
            </div>

            {/* Active Player Stage */}
            <div className="bg-green-800 w-full max-w-2xl p-8 rounded-2xl border-4 border-yellow-600/50 shadow-2xl flex flex-col items-center min-h-[400px] justify-between relative">
                
                <div className="absolute top-4 left-4 bg-black/30 px-3 py-1 rounded text-sm">
                    残り回数: <span className="font-bold text-xl text-yellow-400">{3 - currentPlayer.rollCount}</span>
                </div>

                <div className="text-center">
                    <h2 className="text-4xl font-bold mb-2">{currentPlayer.name} <span className="text-xl font-normal text-green-300">{currentPlayer.isDealer ? ' (親)' : ' (子)'}</span></h2>
                    <p className="text-xl text-yellow-200 min-h-[32px]">
                        {currentPlayer.hand ? currentPlayer.hand.label : "サイコロを振ってください"}
                    </p>
                </div>

                <div className="py-8">
                    <DiceDisplay values={currentPlayer.dice} isShaking={state.isRolling} />
                </div>

                <div className="w-full flex justify-center gap-4">
                    {/* Roll Button Logic */}
                    {(!currentPlayer.hand || (currentPlayer.hand.type === HandType.MENASHI && currentPlayer.rollCount < 3)) ? (
                        <button 
                            onClick={rollAction}
                            disabled={state.isRolling}
                            className="w-full max-w-xs py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-2xl rounded-lg shadow-lg transform transition active:scale-95 disabled:opacity-50"
                        >
                            {state.isRolling ? '...' : (currentPlayer.rollCount === 0 ? '振る！' : 'もう一回！')}
                        </button>
                    ) : (
                        <button 
                            onClick={finishTurn}
                            className="w-full max-w-xs py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-2xl rounded-lg shadow-lg animate-bounce"
                        >
                            {(state.currentTurnIndex === state.turnOrder.length - 1) ? '結果を見る' : '次の人へ'}
                        </button>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* RESULT PHASE */}
      {state.phase === Phase.RESULT && (
        <div className="flex-1 flex flex-col items-center">
            <h2 className="text-3xl font-bold mb-6 text-yellow-400 drop-shadow-lg">結果発表</h2>
            
            <div className="w-full overflow-x-auto bg-green-800 rounded-lg shadow-xl mb-8">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-green-900 text-green-200 border-b border-green-700">
                            <th className="p-4">プレイヤー</th>
                            <th className="p-4">役</th>
                            <th className="p-4 text-right">賭け金</th>
                            <th className="p-4 text-right">収支</th>
                            <th className="p-4 text-right">残高</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Show Dealer First */}
                        <tr className="bg-black/20 border-b border-green-700/50">
                            <td className="p-4 font-bold text-yellow-300 flex items-center gap-2">
                                {dealer.name} <span className="bg-yellow-600 text-black text-[10px] px-1 rounded">親</span>
                            </td>
                            <td className="p-4">{dealer.hand?.label}</td>
                            <td className="p-4 text-right">-</td>
                            <td className={`p-4 text-right font-bold ${dealer.resultDiff >= 0 ? 'text-blue-300' : 'text-red-400'}`}>
                                {dealer.resultDiff > 0 ? '+' : ''}{dealer.resultDiff.toLocaleString()}
                            </td>
                            <td className="p-4 text-right font-mono text-lg">{dealer.balance.toLocaleString()}</td>
                        </tr>
                        {/* Show Players */}
                        {state.players.filter(p => !p.isDealer).map(p => (
                            <tr key={p.id} className="border-b border-green-700/30 hover:bg-white/5">
                                <td className="p-4 font-medium">{p.name}</td>
                                <td className="p-4">{p.hand?.label}</td>
                                <td className="p-4 text-right text-gray-300">{p.currentBet.toLocaleString()}</td>
                                <td className={`p-4 text-right font-bold ${p.resultDiff >= 0 ? 'text-blue-300' : 'text-red-400'}`}>
                                    {p.resultDiff > 0 ? '+' : ''}{p.resultDiff.toLocaleString()}
                                </td>
                                <td className="p-4 text-right font-mono">{p.balance.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <button 
                onClick={nextGame}
                className="px-10 py-4 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black font-bold text-2xl rounded-full shadow-lg transform transition hover:scale-105"
            >
                次のゲームへ（親交代）
            </button>
        </div>
      )}
    </div>
  );
}
