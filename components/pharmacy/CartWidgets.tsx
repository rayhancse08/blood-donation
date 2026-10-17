"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatTaka } from "@/lib/money";
import { buttonClass } from "../ui";
import { cartActions, cartTotals, useCart, type CartItem } from "./cart-store";

export function AddToCartButton({
  pharmacy,
  medicine,
}: {
  pharmacy: { id: string; name: string; discountPercent: number };
  medicine: Omit<CartItem, "quantity">;
}) {
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(false), 1500);
    return () => clearTimeout(timer);
  }, [added]);

  if (medicine.maxQuantity <= 0) return <span className="text-xs text-gray-500">Out of stock</span>;

  return (
    <button type="button" onClick={() => setAdded(cartActions.add(pharmacy, medicine))} className={buttonClass.primary}>
      {added ? "Added ✓" : "Add to cart"}
    </button>
  );
}

export function CartBar() {
  const cart = useCart();
  const { subtotal, count } = cartTotals(cart);
  if (!cart || count === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1100] border-t border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="text-sm">
          <p className="font-semibold">
            {count} item(s) · {formatTaka(subtotal)}
          </p>
          <p className="text-xs text-gray-500">From {cart.pharmacyName}</p>
        </div>
        <Link href="/pharmacy/checkout" className={buttonClass.primary}>
          Checkout
        </Link>
      </div>
    </div>
  );
}

export function ClearCartOnMount() {
  useEffect(() => {
    cartActions.clear();
  }, []);
  return null;
}
