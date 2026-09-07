/**
 * Benchmark the deployed server as the test user (docs/performance.md §3).
 *
 *   deno task bench                 run the script, print p50/p95 + Server-Timing, store samples
 *   deno task bench --no-store      print only
 *   deno task bench --runs 3        fewer repetitions
 *
 * Stores rows in perf_samples (source 'bench') through the service role. The names and budgets
 * below are the contract; a p95 over budget × 1.25 exits non-zero once --enforce is passed.
 */
import { createClient } from "@supabase/supabase-js";
import { mcpClient, parseServerTiming } from "./mcp-client.ts";

const args = [...Deno.args];
const has = (f: string) => {
  const i = args.indexOf(f);
  if (i >= 0) args.splice(i, 1);
  return i >= 0;
};
const flag = (f: string) => {
  const i = args.indexOf(f);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const store = !has("--no-store");
const enforce = has("--enforce");
const runs = Number(flag("--runs") ?? 5);

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const base = `${supabaseUrl}/functions/v1/chef`;
const url = flag("--url") ?? `${base}/mcp`;

/** What we time, how often, and the p95 budget in ms (docs/performance.md §3). */
const SCRIPT: { name: string; budget: number; run: () => Promise<{ ms: number; timing: string }> }[] = [];
const rpc = await mcpClient({ url });
const tool = (name: string, budget: number, args: Record<string, unknown> = {}) =>
  SCRIPT.push({ name, budget, run: () => rpc.call("tools/call", { name, arguments: args }) });
const plain = (name: string, budget: number, path: string) =>
  SCRIPT.push({
    name,
    budget,
    run: async () => {
      const s = performance.now();
      const res = await fetch(`${base}${path}`);
      await res.arrayBuffer();
      return { ms: performance.now() - s, timing: res.headers.get("server-timing") ?? "" };
    },
  });

plain("floor (404)", 300, "/nothing");
plain("well-known", 300, "/.well-known/oauth-protected-resource");
tool("whoami", 500);
tool("get_household", 700);
tool("get_week", 700);
tool("search_recipes", 900, { query: "pasta" });
tool("show_week", 900);
tool("show_shopping_list", 900);

const q = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))];
};

type Row = {
  name: string;
  ms: number;
  boot?: number;
  handle?: number;
  db?: number;
  dbCalls?: number;
  worker?: string;
};
const rows: Row[] = [];
for (const step of SCRIPT) {
  for (let i = 0; i < runs; i++) {
    const r = await step.run();
    rows.push({ name: step.name, ms: r.ms, ...parseServerTiming(r.timing) });
  }
}

const commit = new TextDecoder()
  .decode((await new Deno.Command("git", { args: ["rev-parse", "--short", "HEAD"] }).output()).stdout)
  .trim();
const workers = new Set(rows.map((r) => r.worker).filter(Boolean));
console.log(
  `bench · ${runs} runs each · ${commit} · ${workers.size} worker id(s) seen: ${[...workers].join(" ")}`,
);
console.log("name                  p50     p95   budget   handle    db  calls");
let over = 0;
for (const step of SCRIPT) {
  const mine = rows.filter((r) => r.name === step.name);
  const p50 = q(
    mine.map((r) => r.ms),
    0.5,
  );
  const p95 = q(
    mine.map((r) => r.ms),
    0.95,
  );
  const handle = q(
    mine.map((r) => r.handle ?? 0),
    0.5,
  );
  const db = q(
    mine.map((r) => r.db ?? 0),
    0.5,
  );
  const calls = q(
    mine.map((r) => r.dbCalls ?? 0),
    0.5,
  );
  const bad = p95 > step.budget * 1.25;
  if (bad) over++;
  console.log(
    `${step.name.padEnd(20)} ${p50.toFixed(0).padStart(5)} ${p95.toFixed(0).padStart(7)} ${String(step.budget).padStart(8)} ${handle.toFixed(0).padStart(8)} ${db.toFixed(0).padStart(5)} ${String(calls).padStart(6)}${bad ? "  ← over budget" : ""}`,
  );
}

if (store) {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) console.warn("no SUPABASE_SERVICE_ROLE_KEY: not storing");
  else {
    const db = createClient(supabaseUrl, key, { auth: { persistSession: false } });
    const { error } = await db.from("perf_samples").insert(
      rows.map((r) => ({
        source: "bench",
        name: r.name,
        ms_total: r.ms,
        ms_boot: r.boot ?? null,
        ms_handle: r.handle ?? null,
        ms_db: r.db ?? null,
        db_calls: r.dbCalls ?? null,
        worker: r.worker ?? null,
        commit,
        host: "bench",
      })),
    );
    if (error) console.warn("store:", error.message);
    else console.log(`stored ${rows.length} samples`);
  }
}
if (enforce && over > 0) {
  console.error(`${over} name(s) over budget`);
  Deno.exit(1);
}
Deno.exit(0);
