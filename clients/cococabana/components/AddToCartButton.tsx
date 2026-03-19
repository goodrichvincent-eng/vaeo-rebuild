'use client';

import { useState } from 'react';
import { useCart } from '@/components/CartProvider';

interface AddToCartButtonProps {
  variantId: string;
  available: boolean;
}

export default function AddToCartButton({ variantId, available }: AddToCartButtonProps) {
  const { addToCart } = useCart();
  const [state, setState] = useState<'idle' | 'adding' | 'added'>('idle');

  async function handleClick() {
    if (!available || !variantId || state !== 'idle') return;
    setState('adding');
    try {
      await addToCart(variantId, 1);
      setState('added');
      setTimeout(() => setState('idle'), 2000);
    } catch {
      setState('idle');
    }
  }

  if (!available) {
    return (
      <button
        disabled
        className="w-full py-4 bg-coco-gray text-coco-gray-mid text-xs font-semibold tracking-widest uppercase cursor-not-allowed"
      >
        Sold Out
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={state !== 'idle'}
      className={`w-full py-4 text-xs font-semibold tracking-widest uppercase transition-colors ${
        state === 'added'
          ? 'bg-green-600 text-white'
          : 'bg-coco-black text-white hover:bg-coco-gray-dark disabled:opacity-70'
      }`}
    >
      {state === 'adding' ? 'Adding…' : state === 'added' ? '✓ Added to Cart' : 'Add to Cart'}
    </button>
  );
}
