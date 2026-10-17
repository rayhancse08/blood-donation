import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomToken } from "./crypto";
import { FormError } from "./form";

const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR ?? "uploads");
const MAX_BYTES = 5 * 1024 * 1024;

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
const EXTENSION_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(MIME_EXTENSIONS).map(([mime, ext]) => [ext, mime]),
);

export type UploadCategory = "avatars" | "content" | "donation-proofs" | "prescriptions" | "licenses" | "identity";

export const PUBLIC_UPLOAD_CATEGORIES: UploadCategory[] = ["avatars", "content"];

export async function saveUpload(
  file: File,
  category: UploadCategory,
  ownerId: string,
  options: { imagesOnly?: boolean } = {},
): Promise<string> {
  const extension = MIME_EXTENSIONS[file.type];
  if (!extension || (options.imagesOnly && extension === "pdf")) {
    throw new FormError(options.imagesOnly ? "Please upload a JPG, PNG or WEBP image." : "Please upload a JPG, PNG, WEBP or PDF file.");
  }
  if (file.size > MAX_BYTES) throw new FormError("Files must be 5 MB or smaller.");

  const key = `${category}/${ownerId}/${randomToken(12)}.${extension}`;
  const fullPath = path.join(UPLOAD_ROOT, key);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, Buffer.from(await file.arrayBuffer()));
  return key;
}

export async function readUpload(key: string): Promise<{ data: Buffer; contentType: string } | null> {
  const fullPath = path.resolve(UPLOAD_ROOT, key);
  if (!fullPath.startsWith(UPLOAD_ROOT + path.sep)) return null;
  try {
    const data = await readFile(fullPath);
    const extension = path.extname(fullPath).slice(1).toLowerCase();
    return { data, contentType: EXTENSION_MIME[extension] ?? "application/octet-stream" };
  } catch {
    return null;
  }
}

export function fileUrl(key: string | null | undefined) {
  return key ? `/api/files/${key}` : null;
}
