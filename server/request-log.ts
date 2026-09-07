/**
 * One perf_samples row per MCP request (source 'tool', docs/performance.md §3): when it arrived,
 * what the host asked for, how long we took. This is the only record of what a host actually sends
 * per tool call (one request, or initialize + list + call) and when, which a bench cannot show.
 * Written through the service role after the response is on its way; nothing about the user or
 * the arguments is stored, only the host's user agent.
 */
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config.ts";

export type RequestRecord = {
  at: Date;
  method: string;
  name?: string;
  path: string;
  status: number;
  ms: number;
  db: number;
  dbCalls: number;
  worker: string;
  host: string | null;
};

/** The AWS region this worker runs in; Supabase sets it per invocation. */
export const REGION = (() => {
  try {
    return Deno.env.get("SB_REGION") ?? null;
  } catch {
    return null;
  }
})();

const serviceKey = (): string => {
  try {
    return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  } catch {
    return "";
  }
};

/** Runs `p` after the response without holding it; the platform keeps the worker alive for it. */
const afterResponse = (p: PromiseLike<unknown>) => {
  const rt = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(Promise.resolve(p));
};

export function recordRequest(r: RequestRecord): void {
  const key = serviceKey();
  if (!key) return;
  const db = createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
  afterResponse(
    db
      .from("perf_samples")
      .insert({
        at: r.at.toISOString(),
        source: "tool",
        name: r.name ?? r.method,
        ms_total: r.ms,
        ms_handle: r.ms,
        ms_db: r.db,
        db_calls: r.dbCalls,
        worker: r.worker,
        region: REGION,
        host: r.host,
        extra: { method: r.method, status: r.status, path: r.path },
      })
      .then(({ error }) => {
        if (error) console.warn("request log:", error.message);
      }),
  );
}
