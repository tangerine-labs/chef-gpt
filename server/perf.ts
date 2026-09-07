/**
 * Views report what a person felt: how long from mount until the sheet showed, and how long the
 * assets took (docs/performance.md §2.3). The views' CSP allows the call (same origin as their
 * assets), but the document's origin is the host's, so the endpoint answers CORS. Rows go to perf_samples through the service role; no user data is sent.
 */
import { createClient } from "@supabase/supabase-js";
import type { MCPServer } from "mcp-use";
import type { SupabaseOAuthUser } from "mcp-use/oauth/supabase";
import { PUBLIC_BASE, SUPABASE_URL } from "./config.ts";

const service = () => {
  try {
    return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  } catch {
    return "";
  }
};

type Sample = { view: string; host?: string; mountMs: number; assetMs?: number; assetBytes?: number };

const isSample = (x: unknown): x is Sample =>
  typeof x === "object" &&
  x !== null &&
  typeof (x as Sample).view === "string" &&
  (x as Sample).view.length < 40 &&
  typeof (x as Sample).mountMs === "number";

/** Views run on the host's origin (claudemcpcontent.com in Claude), so the post is cross-origin. */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

export function registerPerf(server: MCPServer<SupabaseOAuthUser>) {
  server.app.options(`${PUBLIC_BASE}/perf`, (c) => c.body(null, 204, CORS));
  server.app.post(`${PUBLIC_BASE}/perf`, async (c) => {
    for (const [k, v] of Object.entries(CORS)) c.header(k, v);
    const text = await c.req.text();
    if (text.length > 2000) return c.text("too big", 413);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return c.text("bad json", 400);
    }
    if (!isSample(body)) return c.text("bad sample", 400);
    const key = service();
    if (!key) return c.body(null, 204);
    const db = createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
    const { error } = await db.from("perf_samples").insert({
      source: "view",
      name: body.view,
      ms_total: body.mountMs,
      extra: { assetMs: body.assetMs ?? null, assetBytes: body.assetBytes ?? null },
      host: typeof body.host === "string" ? body.host.slice(0, 40) : null,
    });
    if (error) console.warn("perf insert:", error.message);
    return c.body(null, 204);
  });
}
