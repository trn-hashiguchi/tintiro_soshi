
import React, { useState, useEffect, useCallback } from 'react';
import { Phase, Player, GameState, HandType, HandResult } from './types';
import { rollDice, evaluateHand, calculateOutcome, getShonbenHand } from './services/gameLogic';
import { DiceDisplay } from './components/DiceDisplay';

// UI Components
const Card: React.FC<{ children: React.ReactNode; className?: string; highlight?: boolean }> = ({ children, className = "", highlight = false }) => (
  <div className={`glass-panel rounded-xl p-6 ${highlight ? 'border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : ''} ${className}`}>
    {children}
  </div>
);

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'action' | 'success' }> = ({ children, variant = 'primary', className = "", ...props }) => {
  const baseStyle = "font-bold rounded transition-all duration-200 transform active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-gradient-to-b from-yellow-500 to-yellow-700 text-black hover:from-yellow-400 hover:to-yellow-600 border-b-4 border-yellow-800",
    secondary: "bg-gray-700 text-white hover:bg-gray-600 border-b-4 border-gray-900",
    danger: "bg-red-700 text-white hover:bg-red-600 border-b-4 border-red-900",
    success: "bg-green-700 text-white hover:bg-green-600 border-b-4 border-green-900",
    action: "bg-gradient-to-b from-blue-600 to-blue-800 text-white hover:from-blue-500 hover:to-blue-700 border-b-4 border-blue-900 text-xl py-4"
  };

  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

// 特殊役演出用コンポーネント
const CutInOverlay: React.FC<{ hand: HandResult | null; onClose: () => void }> = ({ hand, onClose }) => {
  useEffect(() => {
    if (hand) {
      const timer = setTimeout(onClose, 2500); // 2.5秒後に自動で消える
      return () => clearTimeout(timer);
    }
  }, [hand, onClose]);

  if (!hand) return null;

  // 通常の役なら表示しない（あるいは控えめに）
  const isSpecial = [HandType.PINZORO, HandType.ARASHI, HandType.SHIGORO, HandType.HIFUMI, HandType.SHONBEN].includes(hand.type);
  if (!isSpecial) return null;

  let bgClass = "bg-black/80";
  let textClass = "text-white";
  let subText = "";

  switch (hand.type) {
    case HandType.PINZORO:
      bgClass = "bg-red-900/90";
      textClass = "text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.8)]";
      subText = "五倍付け!!";
      break;
    case HandType.ARASHI:
      bgClass = "bg-blue-900/90";
      textClass = "text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]";
      subText = "三倍付け!!";
      break;
    case HandType.SHIGORO:
      bgClass = "bg-green-900/90";
      textClass = "text-green-300 drop-shadow-[0_0_20px_rgba(74,222,128,0.8)]";
      subText = "二倍付け!!";
      break;
    case HandType.HIFUMI:
      bgClass = "bg-purple-900/90";
      textClass = "text-purple-300 drop-shadow-[0_0_20px_rgba(192,132,252,0.8)]";
      subText = "倍払い...";
      break;
    case HandType.SHONBEN:
      bgClass = "bg-yellow-900/90";
      textClass = "text-yellow-200 drop-shadow-[0_0_20px_rgba(200,200,0,0.8)]";
      subText = "役なし以下...";
      break;
  }

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center ${bgClass} animate-flash overflow-hidden`}>
      <div className="relative w-full text-center animate-cut-in">
        <h1 className={`text-9xl font-brush font-black ${textClass} tracking-widest whitespace-nowrap`}>
          {hand.label.split(' ')[0]}
        </h1>
        <p className="text-4xl mt-4 font-mincho text-white font-bold tracking-[1em] opacity-90">{subText}</p>
      </div>
      <div className="absolute inset-0 pointer-events-none opacity-30 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9IiNmZmYiLz48L3N2Zz4=')] animate-tumble"></div>
    </div>
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
  const [initialBalance, setInitialBalance] = useState<number>(20000);

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
      balance: initialBalance,
      topUpAmount: 0,
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
  const handleSetBet = (playerId: string, amount: number) => {
    setState((prev) => ({
      ...prev,
      players: prev.players.map((p) => {
        if (p.id !== playerId) return p;
        const safeAmount = Math.max(0, Math.min(p.balance, amount));
        return { ...p, currentBet: safeAmount };
      }),
    }));
  };

  const handleAddBet = (playerId: string, amountToAdd: number) => {
    setState((prev) => ({
      ...prev,
      players: prev.players.map((p) => {
        if (p.id !== playerId) return p;
        const newAmount = p.currentBet + amountToAdd;
        const safeAmount = Math.max(0, Math.min(p.balance, newAmount));
        return { ...p, currentBet: safeAmount };
      }),
    }));
  };

  const handleTopUp = (playerId: string, amount: number) => {
     setState((prev) => ({
      ...prev,
      players: prev.players.map((p) => {
        if (p.id !== playerId) return p;
        return { 
            ...p, 
            balance: p.balance + amount,
            topUpAmount: p.topUpAmount + amount
        };
      }),
    }));
  };

  // 返ソシー（借金返済）
  const handleRepay = (playerId: string, amount: number) => {
    setState((prev) => ({
      ...prev,
      players: prev.players.map((p) => {
        if (p.id !== playerId) return p;
        // 返済額は「指定額」「借金額」「所持金」のうち最も小さい額
        const actualRepay = Math.min(amount, p.topUpAmount, p.balance);
        
        if (actualRepay <= 0) return p;

        return {
          ...p,
          balance: p.balance - actualRepay,
          topUpAmount: p.topUpAmount - actualRepay
        };
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
  const [cutInHand, setCutInHand] = useState<HandResult | null>(null);

  const rollAction = useCallback(async () => {
    if (state.isRolling || !currentPlayer) return;

    setState(prev => ({ ...prev, isRolling: true }));
    
    const animationDuration = 800;
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

    // Determine Outcome (including 1% Shonben chance)
    const isShonben = Math.random() < 0.01;
    let finalDice = rollDice();
    let handResult = isShonben ? getShonbenHand() : evaluateHand(finalDice);

    // If shonben, maybe scramble dice visually to look weird? 
    // For now, just keep the rolled dice but the result overrides.
    
    const isSpecial = [HandType.PINZORO, HandType.ARASHI, HandType.SHIGORO, HandType.HIFUMI, HandType.SHONBEN].includes(handResult.type);
    
    if (isSpecial) {
        setCutInHand(handResult);
    }

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
            const dealerHand = dealer.hand || { type: HandType.MENASHI, value: -1, label: '目なし', multiplier: 1, winMultiplier: 1, lossMultiplier: 1 };

            const resolvedPlayers = updatedPlayers.map(p => {
                if (p.isDealer) return { ...p, resultDiff: 0 }; 
                const pHand = p.hand || { type: HandType.MENASHI, value: -1, label: '目なし', multiplier: 1, winMultiplier: 1, lossMultiplier: 1 };
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
          <h1 className="text-6xl font-brush font-bold text-yellow-500 mb-4 text-center drop-shadow-lg tracking-widest transform -rotate-3">
            チンチロ
          </h1>
          
          <div className="mb-6 p-4 bg-black/40 rounded-lg border border-white/10">
              <label className="block text-xs text-gray-400 mb-1">初期ソシー設定</label>
              <input 
                type="number" 
                value={initialBalance} 
                onChange={(e) => setInitialBalance(parseInt(e.target.value) || 0)}
                className="w-full bg-transparent text-right text-xl font-bold text-yellow-200 outline-none font-mono border-b border-gray-600 focus:border-yellow-500"
              />
          </div>
          
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
            <Button variant="success" onClick={addSetupPlayer} disabled={setupNames.length >= 6} className="px-4 py-2 text-sm">人数を増やす</Button>
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
    <div className="min-h-screen flex flex-col max-w-6xl mx-auto relative sm:px-4 pb-8">
      <CutInOverlay hand={cutInHand} onClose={() => setCutInHand(null)} />

      {/* Header */}
      <header className="flex justify-between items-end px-6 py-2 border-b border-white/10 bg-black sticky top-0 z-50">
        <div>
            <h1 className="text-3xl font-brush font-bold text-yellow-500 tracking-widest">チンチロ</h1>
            <div className="text-xs text-gray-400 uppercase tracking-widest">
                {state.phase === Phase.BETTING ? 'BETTING PHASE' : state.phase === Phase.ACTION ? 'ACTION PHASE' : 'RESULT'}
            </div>
        </div>
        <div className="text-right">
            <div className="text-xs text-gray-400">現在の親</div>
            <div className="text-2xl font-bold text-yellow-100 font-mincho bg-red-900/50 px-3 py-1 rounded border border-red-500/30 inline-block">
                {dealer.name}
            </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 flex flex-col">
        
        {/* BETTING PHASE */}
        {state.phase === Phase.BETTING && (
            <div className="flex-1 flex flex-col items-center justify-center gap-8 animate-fade-in">
                <div className="text-center mb-4">
                    <div className="inline-block px-6 py-2 bg-black/40 rounded-full border border-yellow-500/30 mb-2">
                        <span className="text-yellow-500 text-sm uppercase tracking-widest mr-2">親</span>
                        <span className="font-bold text-xl font-mincho">{dealer.name}</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <p className="text-gray-400 font-mono">所持: {dealer.balance.toLocaleString()} ソシー</p>
                        {dealer.topUpAmount > 0 && <span className="text-xs text-red-400">（追: {dealer.topUpAmount.toLocaleString()}）</span>}
                    </div>
                    <div className="mt-2 flex gap-2 justify-center">
                        <button 
                            onClick={() => handleTopUp(dealer.id, 10000)}
                            className="text-xs bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded text-yellow-500 border border-yellow-900"
                        >
                           + 追いソシー (1万)
                        </button>
                        {dealer.topUpAmount > 0 && dealer.balance > 0 && (
                            <button 
                                onClick={() => handleRepay(dealer.id, 10000)}
                                className="text-xs bg-blue-900/30 hover:bg-blue-900/50 px-2 py-1 rounded text-blue-300 border border-blue-800"
                            >
                                - 返ソシー
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl">
                    {state.players.map((p) => {
                        if (p.isDealer) return null;
                        return (
                            <Card key={p.id} className="flex flex-col gap-4 border-t-4 border-t-green-600/50">
                                <div className="flex justify-between items-start">
                                    <span className="font-bold text-lg font-mincho">{p.name}</span>
                                    <div className="text-right">
                                        <span className="text-xs bg-black/30 px-2 py-1 rounded text-yellow-200 font-mono block">
                                            {p.balance.toLocaleString()}
                                        </span>
                                        {p.topUpAmount > 0 && (
                                            <span className="text-[10px] text-red-400 block text-right">
                                                (追: {p.topUpAmount.toLocaleString()})
                                            </span>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="flex justify-end gap-2">
                                    <button 
                                        onClick={() => handleTopUp(p.id, 10000)}
                                        className="text-[10px] bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded text-yellow-500 border border-yellow-900 flex items-center gap-1"
                                    >
                                        <span>💰 追いソシー(+1万)</span>
                                    </button>
                                    {p.topUpAmount > 0 && p.balance > 0 && (
                                        <button 
                                            onClick={() => handleRepay(p.id, 10000)}
                                            className="text-[10px] bg-blue-900/30 hover:bg-blue-900/50 px-2 py-1 rounded text-blue-300 border border-blue-800 flex items-center gap-1"
                                        >
                                            <span>💸 返ソシー</span>
                                        </button>
                                    )}
                                </div>
                                
                                <div className="bg-black/20 p-3 rounded-lg border border-black/20 inner-shadow">
                                    <label className="text-xs text-gray-400 block mb-1">賭け金 (BET)</label>
                                    <input 
                                        type="number" 
                                        value={p.currentBet} 
                                        onChange={(e) => handleSetBet(p.id, parseInt(e.target.value) || 0)}
                                        className="w-full bg-transparent text-right text-2xl font-bold text-white outline-none font-mono"
                                        min="0"
                                        max={p.balance}
                                    />
                                </div>

                                <div className="grid grid-cols-4 gap-2">
                                    <button onClick={() => handleAddBet(p.id, 100)} className="bg-white/5 hover:bg-white/10 py-2 rounded text-xs transition flex flex-col items-center justify-center"><span>+100</span></button>
                                    <button onClick={() => handleAddBet(p.id, 1000)} className="bg-white/5 hover:bg-white/10 py-2 rounded text-xs transition flex flex-col items-center justify-center"><span>+1k</span></button>
                                    <button onClick={() => handleAddBet(p.id, 10000)} className="bg-white/5 hover:bg-white/10 py-2 rounded text-xs transition flex flex-col items-center justify-center"><span>+10k</span></button>
                                    <button onClick={() => handleSetBet(p.id, p.balance)} className="bg-red-900/50 hover:bg-red-900/80 text-red-200 py-2 rounded text-xs transition border border-red-900 font-bold">オールイン</button>
                                </div>
                            </Card>
                        );
                    })}
                </div>

                <div className="mt-8 pb-8 text-center">
                    <Button 
                        onClick={confirmBets}
                        disabled={state.players.some(p => !p.isDealer && p.currentBet <= 0)}
                        className="px-16 py-4 text-2xl shadow-2xl font-mincho tracking-widest"
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
            <div className="flex-1 flex flex-col items-center justify-center">
                {/* Turn Order Strip */}
                <div className="w-full overflow-x-auto my-2 pb-2 scrollbar-hide">
                    <div className="flex justify-center min-w-max gap-2 px-4">
                        {state.turnOrder.map((pid, idx) => {
                             const p = state.players.find(pl => pl.id === pid);
                             if (!p) return null;
                             const isActive = idx === state.currentTurnIndex;
                             const isDone = idx < state.currentTurnIndex;
                             
                             return (
                                 <div key={pid} 
                                    className={`
                                        px-4 py-2 rounded-full text-sm transition-all duration-300 border flex flex-col items-center min-w-[80px]
                                        ${isActive ? 'bg-yellow-600 text-black border-yellow-400 font-bold scale-110 shadow-[0_0_15px_rgba(234,179,8,0.4)] z-10' 
                                        : isDone ? 'bg-black/40 text-gray-500 border-gray-700' 
                                        : 'bg-black/20 text-gray-300 border-gray-600'}
                                    `}
                                 >
                                     <span className="whitespace-n-wrap">{p.name}</span>
                                     {p.isDealer ? <span className="text-[10px] px-1 bg-red-800/50 rounded font-bold text-white">親</span> : <span className="font-mono text-[10px] opacity-70">{p.currentBet}</span>}
                                 </div>
                             )
                        })}
                    </div>
                </div>

                {/* Main Action Area */}
                <div className="relative w-full max-w-3xl flex flex-col items-center justify-start gap-2 flex-1">
                    
                    <div className="text-center space-y-1 z-10 mb-3">
                        <h2 className="text-5xl font-brush font-bold text-white drop-shadow-md flex items-center gap-4">
                            {currentPlayer.name}
                            <span className={`text-lg px-3 py-1 rounded ${currentPlayer.isDealer ? 'bg-red-700 text-white' : 'bg-blue-800 text-white'} opacity-80 font-sans`}>
                                {currentPlayer.isDealer ? '親' : '子'}
                            </span>
                        </h2>
                        <div className="flex items-center justify-center">
                             {currentPlayer.hand && !state.isRolling && !cutInHand && (
                                 <span className={`text-3xl font-bold font-mincho animate-stamp filter drop-shadow-[0_0_10px_rgba(234,179,8,0.5)] ${currentPlayer.hand.type === HandType.SHONBEN ? 'text-yellow-600' : 'text-yellow-300'}`}>
                                     {currentPlayer.hand.label}
                                 </span>
                             )}
                        </div>
                    </div>

                    {/* Bowl & Dice */}
                    <div className="transform scale-100 sm:scale-110 transition-transform duration-500">
                        <DiceDisplay values={currentPlayer.dice} isShaking={state.isRolling} />
                    </div>

                    {/* Controls */}
                    <div className="w-full max-w-sm z-10 space-y-4 mt-1">
                         <div className="flex justify-center gap-2 text-gray-400 text-sm uppercase tracking-widest">
                             <span className="w-20 text-center">
                               {currentPlayer.rollCount < 3 ? `${currentPlayer.rollCount + 1}投目` : '投了'}
                             </span>
                             <div className="flex gap-1 items-center">
                                 {[1,2,3].map(i => (
                                     <div key={i} className={`w-3 h-3 rounded-full border border-black ${i <= currentPlayer.rollCount ? 'bg-red-500 shadow-[0_0_5px_red]' : 'bg-gray-800'}`}></div>
                                 ))}
                             </div>
                         </div>

                        {(!currentPlayer.hand || ((currentPlayer.hand.type === HandType.MENASHI) && currentPlayer.rollCount < 3)) ? (
                            <Button 
                                onClick={rollAction}
                                disabled={state.isRolling || cutInHand !== null}
                                variant="action"
                                className="w-full py-6 text-2xl rounded-full shadow-[0_0_30px_rgba(37,99,235,0.3)] border-b-8 active:border-b-0 active:translate-y-2 font-mincho"
                            >
                                {state.isRolling ? '...' : '賽を振る'}
                            </Button>
                        ) : (
                            <Button 
                                onClick={finishTurn}
                                disabled={cutInHand !== null}
                                className="w-full py-6 text-2xl bg-gradient-to-b from-green-600 to-green-800 border-green-900 hover:from-green-500 hover:to-green-700 rounded-full shadow-[0_0_30px_rgba(22,163,74,0.3)] animate-bounce font-mincho"
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
                <h2 className="text-4xl font-brush font-bold text-yellow-500 mb-8 tracking-widest drop-shadow-lg border-b-2 border-yellow-500/30 pb-2 px-8">
                    勝負結果
                </h2>
                
                <div className="w-full space-y-4 mb-12">
                    {/* Dealer Result */}
                    <Card className="flex items-center justify-between bg-gradient-to-r from-red-950/80 to-transparent border-l-4 border-l-yellow-500">
                        <div className="flex items-center gap-4">
                            <div className="bg-red-700 text-white font-bold px-3 py-1 rounded text-sm font-mincho">親</div>
                            <div>
                                <div className="text-2xl font-bold font-mincho">{dealer.name}</div>
                                <div className="text-sm text-gray-400">{dealer.hand?.label}</div>
                            </div>
                        </div>
                        <div className="text-right">
                             <div className={`text-3xl font-bold font-mono ${dealer.resultDiff >= 0 ? 'text-yellow-400' : 'text-red-500'}`}>
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
                                        <div className="font-bold font-mincho text-lg">{p.name}</div>
                                        <div className="text-xs text-gray-400">BET: {p.currentBet.toLocaleString()} | <span className="text-white font-bold">{p.hand?.label}</span></div>
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
                    className="px-12 py-4 text-xl rounded-full shadow-2xl font-mincho"
                >
                    次の局へ（親交代）
                </Button>
            </div>
        )}
      </main>
    </div>
  );
}
