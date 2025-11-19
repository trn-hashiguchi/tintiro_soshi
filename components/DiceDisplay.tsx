import React from 'react';

interface DiceDisplayProps {
  values: [number, number, number];
  isShaking: boolean;
  size?: 'sm' | 'lg';
}

const diceChars = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export const DiceDisplay: React.FC<DiceDisplayProps> = ({ values, isShaking, size = 'lg' }) => {
  const textSize = size === 'lg' ? 'text-8xl' : 'text-4xl';
  const containerClass = isShaking ? 'dice-shake opacity-70' : '';

  return (
    <div className={`flex gap-4 justify-center ${containerClass}`}>
      {values.map((val, idx) => (
        <span key={idx} className={`${textSize} leading-none text-white drop-shadow-lg filter`}>
          {diceChars[val - 1] || '?'}
        </span>
      ))}
    </div>
  );
};
