import React from 'react';
import { Hand } from 'lucide-react';

export default function RaiseHandButton({ isRaised, onToggle, disabled = false }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all duration-200 shadow-lg ${isRaised
          ? 'bg-amber-400 text-amber-900 hover:bg-amber-500 animate-pulse'
          : 'bg-zinc-700 text-white hover:bg-zinc-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <Hand
        size={20}
        className={isRaised ? 'animate-bounce' : ''}
      />
      <span className="text-sm md:text-base">
        {isRaised ? 'Hand Raised' : 'Raise Hand'}
      </span>
    </button>
  );
}
