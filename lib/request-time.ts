import { io } from "next/cache";

/** The current time for rendering, kept out of the prerendered static shell by `io()`. */
export async function requestTime() {
  await io();
  return new Date();
}
