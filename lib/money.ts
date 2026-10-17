// All amounts are stored as integers in poisha (1 Taka = 100 poisha).

export const HOME_DELIVERY_FEE = 6000;

export function toPoisha(taka: number) {
  return Math.round(taka * 100);
}

export function toTaka(poisha: number) {
  return poisha / 100;
}

export function formatTaka(poisha: number) {
  const negative = poisha < 0;
  const abs = Math.abs(Math.round(poisha));
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = (abs % 100).toString().padStart(2, "0");
  return `${negative ? "-" : ""}৳${whole}.${fraction}`;
}

export function calculateDiscount(amount: number, percent: number) {
  const safePercent = Math.min(Math.max(percent, 0), 100);
  const discount = Math.round((amount * safePercent) / 100);
  return { discount, total: amount - discount };
}
