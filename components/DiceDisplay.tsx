import React from 'react';

interface DiceDisplayProps {
  values: [number, number, number];
  isShaking: boolean;
  size?: 'sm' | 'lg';
}

// 目の位置定義（サイコロのドット）
const pips: Record<number, number[][]> = {
  1: [[50, 50]],
  2: [[20, 20], [80, 80]],
  3: [[20, 20], [50, 50], [80, 80]],
  4: [[20, 20], [20, 80], [80, 20], [80, 80]],
  5: [[20, 20], [20, 80], [50, 50], [80, 20], [80, 80]],
  6: [[20, 20], [20, 50], [20, 80], [80, 20], [80, 50], [80, 80]],
};

const Die: React.FC<{ value: number; isShaking: boolean; index: number }> = ({ value, isShaking, index }) => {
  // ランダムな動きをCSS変数で注入するためのスタイル
  const style: React.CSSProperties = isShaking
    ? {
        animationDelay: `${index * 0.05}s`,
        animationDuration: `${0.2 + Math.random() * 0.1}s`,
      }
    : {
        transform: `rotate(${Math.random() * 10 - 5}deg)`, // 止まった時に少しずらす
        transition: 'transform 0.3s ease-out',
      };

  // 1の目は赤く大きく
  const pipColor = value === 1 ? 'bg-red-600' : 'bg-black';
  const pipSize = value === 1 ? 'w-5 h-5' : 'w-3 h-3';

  return (
    <div
      className={`
        relative bg-white rounded-xl shadow-[2px_4px_6px_rgba(0,0,0,0.4),inset_-2px_-2px_5px_rgba(0,0,0,0.1)]
        w-16 h-16 flex items-center justify-center overflow-hidden border border-gray-200
        ${isShaking ? 'animate-tumble' : ''}
      `}
      style={style}
    >
      {pips[value].map(([top, left], i) => (
        <div
          key={i}
          className={`absolute rounded-full ${pipColor} ${pipSize} shadow-sm`}
          style={{ top: `${top}%`, left: `${left}%`, transform: 'translate(-50%, -50%)' }}
        />
      ))}
    </div>
  );
};

export const DiceDisplay: React.FC<DiceDisplayProps> = ({ values, isShaking, size = 'lg' }) => {
  // size propは現在お椀サイズ固定だが、将来的な拡張のために維持
  // お椀のデザイン
  return (
    <div className="relative flex justify-center items-center py-4">
      {/* お椀本体 */}
      <div 
        className={`
          relative w-72 h-72 rounded-full 
          bg-gradient-to-br from-[#3d2b1f] via-[#1a110a] to-[#0f0805]
          shadow-[inset_0_10px_30px_rgba(0,0,0,0.9),0_20px_40px_rgba(0,0,0,0.6),0_0_0_8px_#5c4030]
          flex items-center justify-center
          ${isShaking ? 'animate-vibrate' : ''}
        `}
      >
        {/* お椀の底のハイライト */}
        <div className="absolute inset-4 rounded-full border border-white/5 opacity-50 pointer-events-none"></div>
        
        {/* サイコロの配置コンテナ */}
        <div className="relative w-48 h-48">
            {/* 
               サイコロの位置: 
               isShaking時はCSSアニメーションで動き回る。
               静止時は三角形に配置する。
            */}
            <div className={`absolute transition-all duration-300 ${isShaking ? 'top-10 left-4' : 'top-4 left-1/2 -translate-x-1/2'}`}>
                <Die value={values[0]} isShaking={isShaking} index={0} />
            </div>
            <div className={`absolute transition-all duration-300 ${isShaking ? 'top-20 left-20' : 'bottom-8 left-4'}`}>
                <Die value={values[1]} isShaking={isShaking} index={1} />
            </div>
            <div className={`absolute transition-all duration-300 ${isShaking ? 'top-8 left-28' : 'bottom-8 right-4'}`}>
                <Die value={values[2]} isShaking={isShaking} index={2} />
            </div>
        </div>
      </div>
    </div>
  );
};