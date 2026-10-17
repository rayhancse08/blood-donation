"use client";

import Link from "next/link";
import { useState } from "react";
import { placeOrderAction } from "@/lib/actions/pharmacy";
import { ORDER_PAYMENT_METHODS } from "@/lib/constants";
import { formatTaka, HOME_DELIVERY_FEE } from "@/lib/money";
import { ActionForm } from "../ActionForm";
import { SubmitButton } from "../SubmitButton";
import { buttonClass, Card, EmptyState, Field, inputClass } from "../ui";
import { cartActions, cartTotals, useCart } from "./cart-store";

export function CheckoutForm({ defaultPhone, defaultAddress }: { defaultPhone: string; defaultAddress: string }) {
  const cart = useCart();
  const [fulfillment, setFulfillment] = useState<"DELIVERY" | "PICKUP">("DELIVERY");

  if (!cart || cart.items.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        description="Search for a medicine and add it from a nearby pharmacy."
        action={
          <Link href="/pharmacy" className={buttonClass.primary}>
            Find medicine
          </Link>
        }
      />
    );
  }

  const { subtotal, discount } = cartTotals(cart);
  const deliveryFee = fulfillment === "DELIVERY" ? HOME_DELIVERY_FEE : 0;
  const total = subtotal - discount + deliveryFee;
  const needsPrescription = cart.items.some((item) => item.requiresPrescription);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card title={`Items from ${cart.pharmacyName}`}>
        <ul className="divide-y divide-gray-100">
          {cart.items.map((item) => (
            <li key={item.medicineId} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.name}</p>
                <p className="text-xs text-gray-500">
                  {formatTaka(item.price)} each{item.requiresPrescription ? " · Prescription required" : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" className={buttonClass.small} onClick={() => cartActions.setQuantity(item.medicineId, item.quantity - 1)}>
                  −
                </button>
                <span className="w-8 text-center text-sm">{item.quantity}</span>
                <button
                  type="button"
                  className={buttonClass.small}
                  disabled={item.quantity >= item.maxQuantity}
                  onClick={() => cartActions.setQuantity(item.medicineId, item.quantity + 1)}
                >
                  +
                </button>
              </div>
              <p className="w-24 text-right text-sm font-semibold">{formatTaka(item.price * item.quantity)}</p>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => cartActions.clear()} className="mt-3 text-sm text-red-600 hover:underline">
          Clear cart
        </button>
      </Card>

      <Card title="Checkout">
        <ActionForm action={placeOrderAction}>
          <input type="hidden" name="pharmacyId" value={cart.pharmacyId} />
          <input
            type="hidden"
            name="items"
            value={JSON.stringify(cart.items.map((item) => ({ medicineId: item.medicineId, quantity: item.quantity })))}
          />

          <Field label="Delivery option" required>
            <div className="grid grid-cols-2 gap-2">
              {(["DELIVERY", "PICKUP"] as const).map((value) => (
                <label key={value} className="flex items-center gap-2 rounded-lg border border-gray-300 p-2 text-sm has-checked:border-red-500 has-checked:bg-red-50">
                  <input type="radio" name="fulfillment" value={value} checked={fulfillment === value} onChange={() => setFulfillment(value)} />
                  {value === "DELIVERY" ? "Home delivery" : "Pharmacy pickup"}
                </label>
              ))}
            </div>
          </Field>

          {fulfillment === "DELIVERY" && (
            <Field label="Delivery address" required>
              <textarea name="deliveryAddress" rows={2} defaultValue={defaultAddress} required maxLength={300} className={inputClass} />
            </Field>
          )}

          <Field label="Contact phone" required>
            <input name="contactPhone" type="tel" defaultValue={defaultPhone} required className={inputClass} />
          </Field>

          <Field
            label="Prescription"
            required={needsPrescription}
            hint={needsPrescription ? "Required for prescription-only medicines (JPG, PNG or PDF, max 5 MB)." : "Optional"}
          >
            <input name="prescription" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required={needsPrescription} className="text-sm" />
          </Field>

          <Field label="Payment method" required>
            <select name="paymentMethod" defaultValue="BKASH" className={inputClass}>
              {ORDER_PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Note for the pharmacy">
            <input name="note" maxLength={500} className={inputClass} />
          </Field>

          <dl className="space-y-1 border-t border-gray-100 pt-3 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatTaka(subtotal)}</dd>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-700">
                <dt>Partner discount ({cart.discountPercent}%)</dt>
                <dd>-{formatTaka(discount)}</dd>
              </div>
            )}
            {deliveryFee > 0 && (
              <div className="flex justify-between">
                <dt>Delivery fee</dt>
                <dd>{formatTaka(deliveryFee)}</dd>
              </div>
            )}
            <div className="flex justify-between text-base font-bold">
              <dt>Total</dt>
              <dd>{formatTaka(total)}</dd>
            </div>
          </dl>

          <SubmitButton className={`${buttonClass.primary} w-full`} pendingText="Placing order…">
            Place order
          </SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
