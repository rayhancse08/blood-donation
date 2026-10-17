"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ORDER_PAYMENT_METHOD_VALUES, orderStatusLabel, nextOrderStatuses, type OrderStatusValue } from "@/lib/constants";
import { generateReference } from "@/lib/crypto";
import { db } from "@/lib/db";
import {
  type ActionState,
  FormError,
  getFile,
  optStr,
  reqEnum,
  reqPhone,
  reqStr,
  toFormErrorState,
} from "@/lib/form";
import { calculateDiscount, formatTaka, HOME_DELIVERY_FEE } from "@/lib/money";
import { notifyUsers } from "@/lib/notify";
import { startCheckout } from "@/lib/payments";
import { saveUpload } from "@/lib/storage";

type CartLine = { medicineId: string; quantity: number };

function parseCart(raw: FormDataEntryValue | null): CartLine[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw ?? "[]"));
  } catch {
    throw new FormError("Your cart could not be read. Please refresh and try again.");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) throw new FormError("Your cart is empty.");

  const merged = new Map<string, number>();
  for (const item of parsed) {
    const medicineId = typeof item?.medicineId === "string" ? item.medicineId : "";
    const quantity = Number(item?.quantity);
    if (!medicineId || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      throw new FormError("Your cart contains an invalid item.");
    }
    merged.set(medicineId, (merged.get(medicineId) ?? 0) + quantity);
  }
  return [...merged].map(([medicineId, quantity]) => ({ medicineId, quantity }));
}

export async function placeOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  let redirectTo = "";

  try {
    const pharmacyId = reqStr(formData, "pharmacyId", "Pharmacy", 50);
    const lines = parseCart(formData.get("items"));
    const fulfillment = reqEnum(formData, "fulfillment", ["DELIVERY", "PICKUP"] as const, "Delivery option");
    const deliveryAddress = fulfillment === "DELIVERY" ? reqStr(formData, "deliveryAddress", "Delivery address", 300) : null;
    const contactPhone = reqPhone(formData, "contactPhone", "Contact phone");
    const paymentMethod = reqEnum(formData, "paymentMethod", ORDER_PAYMENT_METHOD_VALUES, "Payment method");

    const pharmacy = await db.facility.findFirst({ where: { id: pharmacyId, type: "PHARMACY", isActive: true } });
    if (!pharmacy) throw new FormError("This pharmacy is not accepting orders right now.");

    const stock = await db.pharmacyStock.findMany({
      where: { pharmacyId, medicineId: { in: lines.map((l) => l.medicineId) } },
      include: { medicine: true },
    });
    const stockById = new Map(stock.map((s) => [s.medicineId, s]));
    for (const line of lines) {
      const item = stockById.get(line.medicineId);
      if (!item) throw new FormError("One of the medicines is no longer sold by this pharmacy.");
      if (item.quantity < line.quantity) throw new FormError(`Only ${item.quantity} of ${item.medicine.name} left in stock.`);
    }

    const prescription = getFile(formData, "prescription");
    if (stock.some((s) => s.medicine.requiresPrescription) && !prescription) {
      throw new FormError("A prescription is required for one or more medicines in your cart.");
    }
    const prescriptionKey = prescription ? await saveUpload(prescription, "prescriptions", user.id) : null;

    const subtotal = lines.reduce((sum, line) => sum + stockById.get(line.medicineId)!.price * line.quantity, 0);
    const discountPercent = pharmacy.partnerStatus === "APPROVED" ? pharmacy.discountPercent : 0;
    const { discount } = calculateDiscount(subtotal, discountPercent);
    const deliveryFee = fulfillment === "DELIVERY" ? HOME_DELIVERY_FEE : 0;
    const total = subtotal - discount + deliveryFee;

    const order = await db.$transaction(async (tx) => {
      for (const line of lines) {
        const updated = await tx.pharmacyStock.updateMany({
          where: { pharmacyId, medicineId: line.medicineId, quantity: { gte: line.quantity } },
          data: { quantity: { decrement: line.quantity } },
        });
        if (updated.count === 0) throw new FormError(`${stockById.get(line.medicineId)!.medicine.name} just went out of stock.`);
      }
      return tx.order.create({
        data: {
          orderNo: generateReference("ORD"),
          userId: user.id,
          pharmacyId,
          fulfillment,
          deliveryAddress,
          contactPhone,
          prescriptionKey,
          note: optStr(formData, "note", 500),
          subtotal,
          discount,
          deliveryFee,
          total,
          paymentMethod,
          items: {
            create: lines.map((line) => {
              const item = stockById.get(line.medicineId)!;
              return {
                medicineId: line.medicineId,
                name: `${item.medicine.name}${item.medicine.strength ? ` ${item.medicine.strength}` : ""}`,
                unitPrice: item.price,
                quantity: line.quantity,
              };
            }),
          },
        },
      });
    });

    if (pharmacy.ownerId) {
      await notifyUsers([pharmacy.ownerId], {
        type: "ORDER",
        title: "New medicine order",
        body: `Order ${order.orderNo} for ${formatTaka(total)} (${fulfillment === "DELIVERY" ? "home delivery" : "pickup"}).`,
        link: `/partner/${pharmacy.id}?tab=orders`,
      });
    }

    if (paymentMethod === "CASH") {
      redirectTo = `/orders/${order.id}?placed=1`;
    } else {
      const payment = await db.payment.create({
        data: {
          receiptNo: generateReference("RCT"),
          userId: user.id,
          facilityId: pharmacy.id,
          orderId: order.id,
          purpose: "MEDICINE_ORDER",
          description: `Medicine order ${order.orderNo}`,
          amount: subtotal + deliveryFee,
          discount,
          total,
          method: paymentMethod,
        },
      });
      redirectTo = await startCheckout(payment).catch(() => `/orders/${order.id}?placed=1&payment=error`);
    }
  } catch (error) {
    return toFormErrorState(error);
  }

  redirect(redirectTo);
}

async function restock(orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return;
  await db.$transaction(
    order.items.map((item) =>
      db.pharmacyStock.updateMany({
        where: { pharmacyId: order.pharmacyId, medicineId: item.medicineId },
        data: { quantity: { increment: item.quantity } },
      }),
    ),
  );
}

export async function cancelOrderAction(orderId: string) {
  const user = await requireUser();
  const order = await db.order.findFirst({ where: { id: orderId, userId: user.id }, include: { pharmacy: true } });
  if (!order || order.status !== "PENDING") return;

  await db.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
  await db.payment.updateMany({ where: { orderId, status: "PENDING" }, data: { status: "CANCELLED" } });
  await restock(orderId);

  if (order.pharmacy.ownerId) {
    await notifyUsers([order.pharmacy.ownerId], {
      type: "ORDER",
      title: "Order cancelled",
      body: `Order ${order.orderNo} was cancelled by the customer.`,
      link: `/partner/${order.pharmacyId}?tab=orders`,
    });
  }
  revalidatePath(`/orders/${orderId}`);
}

export async function updateOrderStatusAction(orderId: string, status: OrderStatusValue) {
  const user = await requireUser();
  const order = await db.order.findUnique({ where: { id: orderId }, include: { pharmacy: true } });
  if (!order) return;
  if (order.pharmacy.ownerId !== user.id && user.role !== "ADMIN") return;
  if (!nextOrderStatuses(order.status, order.fulfillment).includes(status)) return;

  await db.order.update({ where: { id: orderId }, data: { status } });
  if (status === "CANCELLED") {
    await restock(orderId);
    await db.payment.updateMany({ where: { orderId, status: "PENDING" }, data: { status: "CANCELLED" } });
  }

  await notifyUsers([order.userId], {
    type: "ORDER",
    title: `Order ${orderStatusLabel(status).toLowerCase()}`,
    body: `Your order ${order.orderNo} from ${order.pharmacy.name} is now: ${orderStatusLabel(status)}.`,
    link: `/orders/${orderId}`,
  });

  revalidatePath(`/partner/${order.pharmacyId}`);
  revalidatePath(`/orders/${orderId}`);
}
