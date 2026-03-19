'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  type Cart,
  type CartLine,
  cartCreate,
  cartLinesAdd,
  cartLinesRemove,
  cartPermalink,
  getCart,
  hasStorefrontToken,
} from '@/lib/shopify';

interface CartContextValue {
  cart: Cart | null;
  isOpen: boolean;
  isLoading: boolean;
  openCart: () => void;
  closeCart: () => void;
  addToCart: (variantId: string, quantity?: number) => Promise<void>;
  removeFromCart: (lineId: string) => Promise<void>;
  checkout: () => void;
  lineCount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

const CART_ID_KEY = 'coco_cart_id';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart]       = useState<Cart | null>(null);
  const [isOpen, setIsOpen]   = useState(false);
  const [isLoading, setLoading] = useState(false);

  // Rehydrate cart on mount
  useEffect(() => {
    const storedId = typeof window !== 'undefined' ? localStorage.getItem(CART_ID_KEY) : null;
    if (storedId && hasStorefrontToken) {
      getCart(storedId).then(c => { if (c) setCart(c); }).catch(() => {});
    }
  }, []);

  const persist = (c: Cart) => {
    setCart(c);
    localStorage.setItem(CART_ID_KEY, c.id);
  };

  const addToCart = useCallback(async (variantId: string, quantity = 1) => {
    if (!hasStorefrontToken) {
      // Fallback: open the Shopify cart permalink in a new tab
      window.open(cartPermalink(variantId, quantity), '_blank');
      return;
    }
    setLoading(true);
    try {
      let updated: Cart;
      if (cart) {
        updated = await cartLinesAdd(cart.id, variantId, quantity);
      } else {
        updated = await cartCreate(variantId, quantity);
      }
      persist(updated);
      setIsOpen(true);
    } finally {
      setLoading(false);
    }
  }, [cart]);

  const removeFromCart = useCallback(async (lineId: string) => {
    if (!cart) return;
    setLoading(true);
    try {
      const updated = await cartLinesRemove(cart.id, [lineId]);
      persist(updated);
    } finally {
      setLoading(false);
    }
  }, [cart]);

  const checkout = useCallback(() => {
    if (cart?.checkoutUrl) {
      window.location.href = cart.checkoutUrl;
    }
  }, [cart]);

  const lineCount = cart?.totalQuantity ?? 0;

  return (
    <CartContext.Provider value={{
      cart, isOpen, isLoading,
      openCart:  () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      addToCart, removeFromCart, checkout, lineCount,
    }}>
      {children}
      {isOpen && <CartDrawer />}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be inside CartProvider');
  return ctx;
}

// ── Cart Drawer ───────────────────────────────────────────────────────────────

function CartDrawer() {
  const { cart, closeCart, removeFromCart, checkout, isLoading } = useCart();
  const lines: CartLine[] = cart?.lines.edges.map(e => e.node) ?? [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={closeCart}
        aria-hidden="true"
      />
      {/* Drawer */}
      <aside
        className="fixed right-0 top-0 h-full w-full max-w-sm bg-white z-50 flex flex-col shadow-xl"
        aria-label="Shopping cart"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-coco-border">
          <h2 className="text-lg font-semibold tracking-wide">Your Cart</h2>
          <button
            onClick={closeCart}
            aria-label="Close cart"
            className="p-1 hover:opacity-60 transition-opacity"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4l12 12M16 4L4 16"/>
            </svg>
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-coco-gray-mid text-sm">
            Your cart is empty
          </div>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto divide-y divide-coco-border">
              {lines.map(line => (
                <li key={line.id} className="flex gap-4 px-5 py-4">
                  {line.merchandise.image && (
                    <img
                      src={line.merchandise.image.url}
                      alt={line.merchandise.image.altText ?? line.merchandise.product.title}
                      className="w-16 h-16 object-cover rounded"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{line.merchandise.product.title}</p>
                    {line.merchandise.title !== 'Default Title' && (
                      <p className="text-xs text-coco-gray-mid">{line.merchandise.title}</p>
                    )}
                    <p className="text-sm mt-1">
                      {line.quantity} × ${parseFloat(line.merchandise.price.amount).toFixed(2)}
                    </p>
                  </div>
                  <button
                    onClick={() => removeFromCart(line.id)}
                    aria-label="Remove item"
                    className="text-coco-gray-mid hover:text-coco-black transition-colors text-xs"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <div className="p-5 border-t border-coco-border space-y-3">
              <div className="flex justify-between text-sm font-semibold">
                <span>Subtotal</span>
                <span>${parseFloat(cart?.cost.subtotalAmount.amount ?? '0').toFixed(2)}</span>
              </div>
              <button
                onClick={checkout}
                disabled={isLoading}
                className="w-full bg-coco-black text-white py-3 text-sm font-semibold tracking-widest uppercase hover:bg-coco-gray-dark transition-colors disabled:opacity-50"
              >
                Checkout
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
