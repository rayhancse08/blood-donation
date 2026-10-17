"use client";

import { useSyncExternalStore } from "react";

export type CartItem = {
  medicineId: string;
  name: string;
  price: number;
  quantity: number;
  maxQuantity: number;
  requiresPrescription: boolean;
};

export type Cart = {
  pharmacyId: string;
  pharmacyName: string;
  discountPercent: number;
  items: CartItem[];
};

const STORAGE_KEY = "bloodapp.cart";
const listeners = new Set<() => void>();
let cache: { raw: string | null; value: Cart | null } = { raw: null, value: null };

function read(): Cart | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw !== cache.raw) {
    let value: Cart | null = null;
    try {
      value = raw ? (JSON.parse(raw) as Cart) : null;
    } catch {
      value = null;
    }
    cache = { raw, value };
  }
  return cache.value;
}

function write(cart: Cart | null) {
  if (cart && cart.items.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  else localStorage.removeItem(STORAGE_KEY);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => event.key === STORAGE_KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCart() {
  return useSyncExternalStore(subscribe, read, () => null);
}

export const cartActions = {
  add(pharmacy: { id: string; name: string; discountPercent: number }, item: Omit<CartItem, "quantity">, quantity = 1) {
    let cart = read();
    if (cart && cart.pharmacyId !== pharmacy.id) {
      if (!window.confirm(`Your cart has items from ${cart.pharmacyName}. Start a new cart from ${pharmacy.name}?`)) return false;
      cart = null;
    }
    const next: Cart = cart
      ? { ...cart, items: [...cart.items] }
      : { pharmacyId: pharmacy.id, pharmacyName: pharmacy.name, discountPercent: pharmacy.discountPercent, items: [] };
    const existing = next.items.findIndex((i) => i.medicineId === item.medicineId);
    if (existing >= 0) {
      const current = next.items[existing]!;
      next.items[existing] = { ...current, quantity: Math.min(current.quantity + quantity, item.maxQuantity) };
    } else {
      next.items.push({ ...item, quantity: Math.min(quantity, item.maxQuantity) });
    }
    write(next);
    return true;
  },
  setQuantity(medicineId: string, quantity: number) {
    const cart = read();
    if (!cart) return;
    write({
      ...cart,
      items: cart.items
        .map((i) => (i.medicineId === medicineId ? { ...i, quantity: Math.min(Math.max(quantity, 0), i.maxQuantity) } : i))
        .filter((i) => i.quantity > 0),
    });
  },
  clear() {
    write(null);
  },
};

export function cartTotals(cart: Cart | null) {
  const subtotal = cart?.items.reduce((sum, item) => sum + item.price * item.quantity, 0) ?? 0;
  const discount = Math.round((subtotal * (cart?.discountPercent ?? 0)) / 100);
  return { subtotal, discount, count: cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0 };
}
