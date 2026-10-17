import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET must be set in production");
  return "dev-only-insecure-secret";
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hmac(value: string) {
  return createHmac("sha256", authSecret()).update(value).digest("hex");
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function generateOtp() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function encryptionKey() {
  return createHash("sha256")
    .update(process.env.ENCRYPTION_KEY ?? authSecret())
    .digest();
}

/** AES-256-GCM encryption for sensitive personal data such as NID numbers. */
export function encrypt(plainText: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decrypt(payload: string) {
  const [iv, tag, encrypted] = payload.split(".").map((part) => Buffer.from(part, "base64url"));
  if (!iv || !tag || !encrypted) throw new Error("Invalid encrypted payload");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function maskIdentifier(value: string) {
  if (value.length <= 4) return "****";
  return `${"*".repeat(value.length - 4)}${value.slice(-4)}`;
}

export function generateReference(prefix: string) {
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const random = randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
  return `${prefix}-${date}-${random}`;
}
