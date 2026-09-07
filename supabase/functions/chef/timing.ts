/**
 * Per-request timing (docs/performance.md §2). The edge shim opens a store for each request;
 * the database client adds every PostgREST round trip to it; the shim writes a `Server-Timing`
 * header and one JSON log line. Nothing here touches arguments or user data.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export type RequestTiming = { start: number; db: number; dbCalls: number };

/*
 * server.js is bundled from server/index.ts and carries its own copy of this module, while
 * edge.ts imports it directly, so the two copies must share state through globalThis.
 */
type Shared = { boot: number; bootMs: number; worker: string; als: AsyncLocalStorage<RequestTiming> };
const g = globalThis as unknown as { __chefTiming?: Shared };
if (!g.__chefTiming) {
  g.__chefTiming = {
    /** Wall clock when the first copy evaluated: `age` in Server-Timing. */
    boot: Date.now(),
    /** Milliseconds from isolate start to our first module: the boot cost the platform paid. */
    bootMs: performance.now(),
    /** Fixed for the life of the worker, so a changing value across responses means a boot per request. */
    worker: crypto.randomUUID().slice(0, 8),
    als: new AsyncLocalStorage<RequestTiming>(),
  };
}
const shared: Shared = g.__chefTiming;

export const BOOT = shared.boot;
export const WORKER = shared.worker;
export const timing = shared.als;

/** A fetch that charges its duration to the current request's `db` bucket. */
export const timedFetch: typeof fetch = async (input, init) => {
  const s = performance.now();
  try {
    return await fetch(input, init);
  } finally {
    const t = timing.getStore();
    if (t) {
      t.db += performance.now() - s;
      t.dbCalls++;
    }
  }
};

export function serverTiming(t: RequestTiming, handleMs: number): string {
  const ms = (n: number) => n.toFixed(1);
  return [
    `boot;dur=${ms(shared.bootMs)};desc="worker ${WORKER} age ${Date.now() - BOOT}ms"`,
    `handle;dur=${ms(handleMs)}`,
    `db;dur=${ms(t.db)};desc="${t.dbCalls} calls"`,
  ].join(", ");
}
