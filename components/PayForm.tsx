"use client";

import { useState } from "react";
import { createServicePaymentAction } from "@/lib/actions/payments";
import { facilityTypeLabel, ONLINE_PAYMENT_METHODS } from "@/lib/constants";
import { calculateDiscount, formatTaka, toPoisha } from "@/lib/money";
import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./SubmitButton";
import { buttonClass, Field, inputClass } from "./ui";

export type PayProvider = { id: string; name: string; type: string; district: string | null; discountPercent: number };

export function PayForm({ providers, defaultProviderId }: { providers: PayProvider[]; defaultProviderId?: string }) {
  const [providerId, setProviderId] = useState(defaultProviderId ?? "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("BKASH");

  const provider = providers.find((p) => p.id === providerId);
  const poisha = toPoisha(Number(amount) || 0);
  const { discount, total } = calculateDiscount(poisha, provider?.discountPercent ?? 0);

  return (
    <ActionForm action={createServicePaymentAction}>
      <Field label="Pay to" required>
        <select name="facilityId" value={providerId} onChange={(e) => setProviderId(e.target.value)} required className={inputClass}>
          <option value="">Select a partner provider</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {facilityTypeLabel(p.type)}
              {p.district ? ` · ${p.district}` : ""}
              {p.discountPercent ? ` · ${p.discountPercent}% off` : ""}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Amount (Taka)" required>
        <input
          name="amount"
          type="number"
          min={10}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          className={inputClass}
        />
      </Field>

      <Field label="What is this payment for?">
        <input name="description" maxLength={200} placeholder="e.g. CBC test, consultation, ambulance trip" className={inputClass} />
      </Field>

      <Field label="Payment method" required>
        <div className="grid grid-cols-2 gap-2">
          {ONLINE_PAYMENT_METHODS.map((m) => (
            <label key={m.value} className="flex items-center gap-2 rounded-lg border border-gray-300 p-2 text-sm has-checked:border-red-500 has-checked:bg-red-50">
              <input type="radio" name="method" value={m.value} checked={method === m.value} onChange={() => setMethod(m.value)} />
              {m.label}
            </label>
          ))}
        </div>
      </Field>

      {poisha > 0 && (
        <dl className="space-y-1 rounded-lg bg-gray-50 p-3 text-sm">
          <div className="flex justify-between">
            <dt>Amount</dt>
            <dd>{formatTaka(poisha)}</dd>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-green-700">
              <dt>Partner discount ({provider?.discountPercent}%)</dt>
              <dd>-{formatTaka(discount)}</dd>
            </div>
          )}
          <div className="flex justify-between text-base font-bold">
            <dt>You pay</dt>
            <dd>{formatTaka(total)}</dd>
          </div>
        </dl>
      )}

      <SubmitButton className={`${buttonClass.primary} w-full`} pendingText="Redirecting to payment…">
        Continue to payment
      </SubmitButton>
    </ActionForm>
  );
}
