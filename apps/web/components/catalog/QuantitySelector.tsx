'use client';

import React from 'react';
import { Minus, Plus } from 'lucide-react';

interface Props {
  quantity: number;
  max: number;
  onChange: (quantity: number) => void;
}

export function QuantitySelector({ quantity, max, onChange }: Props) {
  const decrement = () => {
    if (quantity > 1) onChange(quantity - 1);
  };

  const increment = () => {
    if (quantity < max) onChange(quantity + 1);
  };

  const isMaxed = quantity >= max || max === 0;

  return (
    <div className="flex items-center border border-border rounded-lg w-fit">
      <button
        type="button"
        onClick={decrement}
        disabled={quantity <= 1}
        className="px-3 py-2 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
        aria-label="Decrease quantity"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="px-4 py-2 text-sm font-medium text-center min-w-[3rem] border-x border-border tabular-nums">
        {quantity}
      </span>
      <button
        type="button"
        onClick={increment}
        disabled={isMaxed}
        className="px-3 py-2 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
        aria-label="Increase quantity"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}