import React, { useState, useEffect, useCallback } from 'react';
import { Phase, Player, GameState, HandType, HandResult } from './types';
import { rollDice, evaluateHand, calculateOutcome } from './services/gameLogic';
import { DiceDisplay } from './components/DiceDisplay';

const STARTING_BALANCE = 20000;

// UI Components
const Card: React.FC<{ children: React.ReactNode; className?: string; highlight?: boolean }> = ({ children, className = "", highlight = false }) => (
  <div className={`glass-panel rounded-xl p-6 ${highlight ? 'border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : ''} ${className}`}>
    {children}
  </div>
);

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'action' }> = ({ children, variant = 'primary', className = "", ...props }) => {
  const baseStyle = "font-bold rounded transition-all duration-200 transform active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-gradient-to-b from-yellow-500 to-yellow-700 text-black hover:from-yellow-400 hover:to-yellow-600 border-b-4 border-yellow-800",
    secondary: "bg-gray-700 text-white hover:bg-gray-600 border-b-4 border-gray-900",
    danger: "bg-red-700 text-white hover:bg-red-600 border-b-4 border-red-900",
    action: "bg-gradient-to-b from-blue-600 to-blue-800 text-white hover:from-blue-500 hover:to-blue-700 border-b-4 border-blue-900 text-xl py-4"
  };

  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

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
  const [setupNames, setSetupNames] = useState<string[]>(['プレイヤー1', 'プレイヤー2']);

  const addSetupPlayer = () => {
    if (setupNames.length < 6) setSetupNames([...setupNames, `プレイヤー${setupNames.length + 1}`]);
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
        const safeAmount = Math.max(0, Math.min(p.balance, amount));
        return { ...p, currentBet: safeAmount };
      }),
    }));
  };

  const confirmBets = () => {
    const dealer = state.players[state.dealerIndex];
    const children = state.players.filter((p) => p.id !== dealer.id);
    
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

    // Sound effect placeholder could go here
    
    const animationDuration = 800; // Slightly longer for realistic feel
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
            const dealer = updatedPlayers[prev.dealerIndex];
            const dealerHand = dealer.hand || { type: HandType.MENASHI, value: -1, label: '目なし', multiplier: 1 };

            const resolvedPlayers = updatedPlayers.map(p => {
                if (p.isDealer) return { ...p, resultDiff: 0 }; 
                const pHand = p.hand || { type: HandType.MENASHI, value: -1, label: '目なし', multiplier: 1 };
                const diff = calculateOutcome(dealerHand, pHand, p.currentBet);
                return { ...p, resultDiff: diff };
            });

            let dealerTotalDiff = 0;
            resolvedPlayers.forEach(p => {
                if (!p.isDealer) {
                    dealerTotalDiff -= p.resultDiff;
                }
            });

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

  const nextGame = () => {
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
      <div className="min-h-screen flex flex-col items-center justify-center p-4 relative">
        <Card className="max-w-md w-full z-10 border border-yellow-600/30">
          <h1 className="text-5xl font-mincho font-bold text-yellow-500 mb-2 text-center drop-shadow-lg tracking-widest">租紫<br/><span className="text-2xl font-sans text-white tracking-normal opacity-80">BATTLE</span></h1>
          <p className="text-center text-gray-400 text-xs mb-8 uppercase tracking-widest">Survival Dice Game</p>
          
          <div className="space-y-3 mb-8">
            {setupNames.map((name, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-black/30 p-2 rounded border border-white/10">
                <span className="w-8 text-center font-bold text-yellow-600 font-serif">{idx + 1}</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => updateSetupName(idx, e.target.value)}
                  className="flex-1 bg-transparent border-b border-gray-600 text-white focus:border-yellow-500 outline-none px-2 py-1 transition-colors"
                  placeholder="名前を入力"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-4 justify-center mb-8">
            <Button variant="secondary" onClick={removeSetupPlayer} disabled={setupNames.length <= 2} className="px-4 py-2 text-sm">人数を減らす</Button>
            <Button variant="action" onClick={addSetupPlayer} disabled={setupNames.length >= 6} className="px-4 py-2 text-sm bg-none bg-green-700 border-green-900 hover:from-green-600 hover:to-green-800">人数を増やす</Button>
          </div>
          <Button onClick={startGame} className="w-full py-4 text-xl shadow-[0_0_20px_rgba(234,179,8,0.4)]">
            開帳
          </Button>
        </Card>
      </div>
    );
  }

  const dealer = state.players[state.dealerIndex];

  return (
    <div className="min-h-screen flex flex-col max-w-6xl mx-auto relative">
      {/* Header */}
      <header className="flex justify-between items-end px-6 py-4 border-b border-white/10 bg-black/20 backdrop-blur-md sticky top-0 z-50">
        <div>
            <h1 className="text-2xl font-mincho font-bold text-yellow-500 tracking-widest">租紫</h1>
            <div className="text-xs text-gray-400 uppercase tracking-widest">
                {state.phase === Phase.BETTING ? 'BETTING PHASE' : state.phase === Phase.ACTION ? 'ACTION PHASE' : 'RESULT'}
            </div>
        </div>
        <div className="text-right">
            <div className="text-xs text-gray-400">現在の親</div>
            <div className="text-xl font-bold text-yellow-100 font-mincho">{dealer.name}</div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 flex flex-col">
        
        {/* BETTING PHASE */}
        {state.phase === Phase.BETTING && (
            <div className="flex-1 flex flex-col items-center justify-center gap-8 animate-fade-in">
                <div className="text-center mb-4">
                    <div className="inline-block px-6 py-2 bg-black/40 rounded-full border border-yellow-500/30 mb-2">
                        <span className="text-yellow-500 text-sm uppercase tracking-widest mr-2">DEALER</span>
                        <span className="font-bold text-xl">{dealer.name}</span>
                    </div>
                    <p className="text-gray-400 font-mono">所持金: {dealer.balance.toLocaleString()} ソシー</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl">
                    {state.players.map((p) => {
                        if (p.isDealer) return null;
                        return (
                            <Card key={p.id} className="flex flex-col gap-4 border-t-4 border-t-green-600/50">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-lg">{p.name}</span>
                                    <span className="text-xs bg-black/30 px-2 py-1 rounded text-yellow-200 font-mono">{p.balance.toLocaleString()}</span>
                                </div>
                                
                                <div className="bg-black/20 p-3 rounded-lg border border-black/20 inner-shadow">
                                    <label className="text-xs text-gray-400 block mb-1">賭け金 (BET)</label>
                                    <input 
                                        type="number" 
                                        value={p.currentBet} 
                                        onChange={(e) => handleBetChange(p.id, parseInt(e.target.value) || 0)}
                                        className="w-full bg-transparent text-right text-2xl font-bold text-white outline-none font-mono"
                                        min="0"
                                        max={p.balance}
                                    />
                                </div>

                                <div className="grid grid-cols-4 gap-2">
                                    <button onClick={() => handleBetChange(p.id, 100)} className="bg-white/5 hover:bg-white/10 py-2 rounded text-xs transition">+100</button>
                                    <button onClick={() => handleBetChange(p.id, 1000)} className="bg-white/5 hover:bg-white/10 py-2 rounded text-xs transition">+1k</button>
                                    <button onClick={() => handleBetChange(p.id, Math.floor(p.balance / 2))} className="bg-white/5 hover:bg-white/10 py-2 rounded text-xs transition">半額</button>
                                    <button onClick={() => handleBetChange(p.id, p.balance)} className="bg-red-900/50 hover:bg-red-900/80 text-red-200 py-2 rounded text-xs transition border border-red-900">全ツッパ</button>
                                </div>
                            </Card>
                        );
                    })}
                </div>

                <div className="mt-8 pb-8 text-center">
                    <Button 
                        onClick={confirmBets}
                        disabled={state.players.some(p => !p.isDealer && p.currentBet <= 0)}
                        className="px-16 py-4 text-2xl shadow-2xl"
                    >
                        勝負開始
                    </Button>
                    {state.players.some(p => !p.isDealer && p.currentBet <= 0) && (
                        <p className="mt-4 text-red-400 text-sm animate-pulse">※全員、賭け金を決めてください</p>
                    )}
                </div>
            </div>
        )}

        {/* ACTION PHASE */}
        {state.phase === Phase.ACTION && currentPlayer && (
            <div className="flex-1 flex flex-col items-center">
                {/* Turn Order Strip */}
                <div className="w-full overflow-x-auto mb-6 pb-2 scrollbar-hide">
                    <div className="flex justify-center min-w-max gap-2 px-4">
                        {state.turnOrder.map((pid, idx) => {
                             const p = state.players.find(pl => pl.id === pid);
                             if (!p) return null;
                             const isActive = idx === state.currentTurnIndex;
                             const isDone = idx < state.currentTurnIndex;
                             
                             return (
                                 <div key={pid} 
                                    className={`
                                        px-4 py-2 rounded-full text-sm transition-all duration-300 border
                                        ${isActive ? 'bg-yellow-600 text-black border-yellow-400 font-bold scale-110 shadow-[0_0_15px_rgba(234,179,8,0.4)] z-10' 
                                        : isDone ? 'bg-black/40 text-gray-500 border-gray-700' 
                                        : 'bg-black/20 text-gray-300 border-gray-600'}
                                    `}
                                 >
                                     <span className="mr-2">{p.name}</span>
                                     {p.isDealer ? <span className="text-[10px] px-1 bg-black/20 rounded uppercase">Boss</span> : <span className="font-mono text-[10px] opacity-70">{p.currentBet}</span>}
                                 </div>
                             )
                        })}
                    </div>
                </div>

                {/* Main Action Area */}
                <div className="relative w-full max-w-3xl flex flex-col items-center justify-center gap-6">
                    
                    <div className="text-center space-y-1 z-10">
                        <h2 className="text-4xl font-mincho font-bold text-white drop-shadow-md">
                            {currentPlayer.name}
                            <span className="text-lg ml-3 text-yellow-500 opacity-80 font-sans">{currentPlayer.isDealer ? '親' : '子'}</span>
                        </h2>
                        <div className="h-8">
                             {currentPlayer.hand && (
                                 <span className="text-2xl font-bold text-yellow-300 animate-pulse filter drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]">
                                     {currentPlayer.hand.label}
                                 </span>
                             )}
                        </div>
                    </div>

                    {/* Bowl & Dice */}
                    <div className="transform scale-100 sm:scale-110 transition-transform duration-500 py-4">
                        <DiceDisplay values={currentPlayer.dice} isShaking={state.isRolling} />
                    </div>

                    {/* Controls */}
                    <div className="w-full max-w-sm z-10 space-y-4">
                         <div className="flex justify-center gap-2 text-gray-400 text-sm uppercase tracking-widest">
                             <span>Attempts</span>
                             <div className="flex gap-1">
                                 {[1,2,3].map(i => (
                                     <div key={i} className={`w-2 h-2 rounded-full ${i <= currentPlayer.rollCount ? 'bg-red-500' : 'bg-gray-700'}`}></div>
                                 ))}
                             </div>
                         </div>

                        {(!currentPlayer.hand || (currentPlayer.hand.type === HandType.MENASHI && currentPlayer.rollCount < 3)) ? (
                            <Button 
                                onClick={rollAction}
                                disabled={state.isRolling}
                                variant="action"
                                className="w-full py-6 text-2xl rounded-full shadow-[0_0_30px_rgba(37,99,235,0.3)] border-b-8 active:border-b-0 active:translate-y-2"
                            >
                                {state.isRolling ? '...' : '賽を振る'}
                            </Button>
                        ) : (
                            <Button 
                                onClick={finishTurn}
                                className="w-full py-6 text-2xl bg-gradient-to-b from-green-600 to-green-800 border-green-900 hover:from-green-500 hover:to-green-700 rounded-full shadow-[0_0_30px_rgba(22,163,74,0.3)] animate-bounce"
                            >
                                次へ進む
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* RESULT PHASE */}
        {state.phase === Phase.RESULT && (
            <div className="flex-1 flex flex-col items-center w-full max-w-4xl mx-auto">
                <h2 className="text-4xl font-mincho font-bold text-yellow-500 mb-8 tracking-widest drop-shadow-lg border-b-2 border-yellow-500/30 pb-2 px-8">
                    勝負結果
                </h2>
                
                <div className="w-full space-y-4 mb-12">
                    {/* Dealer Result */}
                    <Card className="flex items-center justify-between bg-gradient-to-r from-black/60 to-transparent border-l-4 border-l-yellow-500">
                        <div className="flex items-center gap-4">
                            <div className="bg-yellow-600 text-black font-bold px-3 py-1 rounded text-xs uppercase">Dealer</div>
                            <div>
                                <div className="text-xl font-bold">{dealer.name}</div>
                                <div className="text-sm text-gray-400">{dealer.hand?.label}</div>
                            </div>
                        </div>
                        <div className="text-right">
                             <div className={`text-2xl font-bold font-mono ${dealer.resultDiff >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                                {dealer.resultDiff > 0 ? '+' : ''}{dealer.resultDiff.toLocaleString()}
                             </div>
                             <div className="text-xs text-gray-500 font-mono">残: {dealer.balance.toLocaleString()}</div>
                        </div>
                    </Card>

                    {/* Players Result */}
                    <div className="space-y-2 pl-4 md:pl-8 border-l border-white/10">
                        {state.players.filter(p => !p.isDealer).map(p => (
                             <div key={p.id} className="flex items-center justify-between p-4 bg-white/5 rounded hover:bg-white/10 transition border-b border-white/5">
                                <div className="flex items-center gap-4">
                                    <div>
                                        <div className="font-bold">{p.name}</div>
                                        <div className="text-xs text-gray-400">BET: {p.currentBet.toLocaleString()} | {p.hand?.label}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                     <div className={`text-xl font-bold font-mono ${p.resultDiff >= 0 ? 'text-blue-300' : 'text-red-400'}`}>
                                        {p.resultDiff > 0 ? '+' : ''}{p.resultDiff.toLocaleString()}
                                     </div>
                                     <div className="text-xs text-gray-500 font-mono">残: {p.balance.toLocaleString()}</div>
                                </div>
                             </div>
                        ))}
                    </div>
                </div>

                <Button 
                    onClick={nextGame}
                    className="px-12 py-4 text-xl rounded-full shadow-2xl"
                >
                    次の局へ（親交代）
                </Button>
            </div>
        )}
      </main>
    </div>
  );
}