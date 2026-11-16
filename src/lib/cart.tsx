"use client";

import React, { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import type { PriceTier, Product } from "./types";

export interface CartItem {
  product: Product;
  quantityKg: number;
}

export interface FarmerCartGroup {
  farmerId: string;
  farmerName: string;
  region: string | null;
  items: Array<CartItem & { unitPrice: number; lineTotal: number }>;
  subtotal: number;
}

const CART_STORAGE_KEY = "agromarket_cart_v1";
const CART_EVENT = "agromarket_cart_changed";
const EMPTY_ITEMS: CartItem[] = [];

let cachedRaw: string | null = null;
let cachedParsed: CartItem[] = EMPTY_ITEMS;

function readCartSnapshot(): CartItem[] {
  if (typeof window === "undefined") return EMPTY_ITEMS;
  const raw = localStorage.getItem(CART_STORAGE_KEY);
  if (raw === cachedRaw) return cachedParsed;
  cachedRaw = raw;
  if (!raw) {
    cachedParsed = EMPTY_ITEMS;
    return cachedParsed;
  }
  try {
    cachedParsed = JSON.parse(raw) as CartItem[];
  } catch {
    cachedParsed = EMPTY_ITEMS;
  }
  return cachedParsed;
}

function writeCartSnapshot(next: CartItem[]) {
  const serialized = JSON.stringify(next);
  cachedRaw = serialized;
  cachedParsed = next;
  localStorage.setItem(CART_STORAGE_KEY, serialized);
  window.dispatchEvent(new Event(CART_EVENT));
}

function subscribeCart(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CART_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CART_EVENT, callback);
  };
}

export function computeEffectiveUnitPrice(
  basePricePerKg: number,
  tiers: PriceTier[],
  quantityKg: number
): number {
  const matched = [...tiers]
    .filter((t) => quantityKg >= t.minQuantityKg)
    .sort((a, b) => b.minQuantityKg - a.minQuantityKg)[0];
  return matched ? matched.pricePerKg : basePricePerKg;
}

interface CartContextValue {
  items: CartItem[];
  farmerGroups: FarmerCartGroup[];
  totalKg: number;
  subtotal: number;
  addItem: (product: Product, quantityKg: number) => void;
  updateQuantity: (productId: string, quantityKg: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const items = useSyncExternalStore(
    subscribeCart,
    readCartSnapshot,
    () => EMPTY_ITEMS
  );

  const addItem = useCallback((product: Product, quantityKg: number) => {
    const prev = readCartSnapshot();
    const existing = prev.find((i) => i.product.id === product.id);
    const nextQty = Math.min(
      product.availableStockKg,
      Math.max(product.minOrderKg, (existing?.quantityKg ?? 0) + quantityKg)
    );
    const next = existing
      ? prev.map((i) => (i.product.id === product.id ? { product, quantityKg: nextQty } : i))
      : [...prev, { product, quantityKg: nextQty }];
    writeCartSnapshot(next);
  }, []);

  const updateQuantity = useCallback((productId: string, quantityKg: number) => {
    const prev = readCartSnapshot();
    const next = prev
      .map((i) => {
        if (i.product.id !== productId) return i;
        const clamped = Math.min(
          i.product.availableStockKg,
          Math.max(i.product.minOrderKg, quantityKg)
        );
        return { ...i, quantityKg: clamped };
      })
      .filter((i) => i.quantityKg > 0);
    writeCartSnapshot(next);
  }, []);

  const removeItem = useCallback((productId: string) => {
    writeCartSnapshot(readCartSnapshot().filter((i) => i.product.id !== productId));
  }, []);

  const clearCart = useCallback(() => writeCartSnapshot([]), []);

  const farmerGroups = useMemo<FarmerCartGroup[]>(() => {
    const groups = new Map<string, FarmerCartGroup>();
    for (const item of items) {
      const unitPrice = computeEffectiveUnitPrice(
        item.product.basePricePerKg,
        item.product.priceTiers,
        item.quantityKg
      );
      const lineTotal = Number((unitPrice * item.quantityKg).toFixed(2));
      const farmerName =
        item.product.farmer?.businessName ||
        item.product.farmer?.fullName ||
        "Local Farm";
      const existing = groups.get(item.product.farmerId);
      if (existing) {
        existing.items.push({ ...item, unitPrice, lineTotal });
        existing.subtotal = Number((existing.subtotal + lineTotal).toFixed(2));
      } else {
        groups.set(item.product.farmerId, {
          farmerId: item.product.farmerId,
          farmerName,
          region: item.product.farmer?.region ?? null,
          items: [{ ...item, unitPrice, lineTotal }],
          subtotal: lineTotal,
        });
      }
    }
    return Array.from(groups.values());
  }, [items]);

  const totalKg = useMemo(
    () => items.reduce((acc, i) => acc + i.quantityKg, 0),
    [items]
  );

  const subtotal = useMemo(
    () =>
      Number(
        farmerGroups.reduce((acc, g) => acc + g.subtotal, 0).toFixed(2)
      ),
    [farmerGroups]
  );

  return (
    <CartContext.Provider
      value={{
        items,
        farmerGroups,
        totalKg,
        subtotal,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
