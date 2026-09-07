/**
 * Deploy the chef edge function with its views served from Supabase Storage (ADR 0005).
 *
 *   deno task deploy            # dev project (SUPABASE_DEV_PROJECT_REF)
 *   deno task deploy --prod     # prod project (SUPABASE_PROD_PROJECT_REF), same URL/keys from .env
 *
 * 1. Builds the server with external views: MCP_ASSETS_URL points at the public `views` bucket,
 *    so the bundle references each view's JS/CSS by URL instead of inlining ~600 KB per view.
 *    (Server-side bundling on deploy fails somewhere above 2.5 MB; inline views hit that.)
 * 2. Creates the bucket if needed and uploads server/.mcp-use/build/views/** under the same paths
 *    mcp-use put in the manifest (hashed file names, long cache).
 * 3. Bundles server.js with the edge shim into supabase/functions/chef/bundle.js (one module) and deploys.
 *
 * The bucket shares the function's origin, so the views' CSP needs no extra domain.
 */
import { createClient } from "@supabase/supabase-js";

const prod = Deno.args.includes("--prod");
const env = (k: string) => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`${k} missing from .env`);
  return v;
};
const ref = env(prod ? "SUPABASE_PROD_PROJECT_REF" : "SUPABASE_DEV_PROJECT_REF");
const url = `https://${ref}.supabase.co`;
const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
const BUCKET = "views";
const assetsUrl = `${url}/storage/v1/object/public/${BUCKET}`;
const root = new URL("../", import.meta.url);
const path = (p: string) => new URL(p, root).pathname;

const run = async (cmd: string[], opts: { cwd?: string; env?: Record<string, string> } = {}) => {
  const out = await new Deno.Command(cmd[0], {
    args: cmd.slice(1),
    cwd: opts.cwd,
    env: opts.env,
    stdout: "inherit",
    stderr: "inherit",
  }).output();
  if (!out.success) throw new Error(`${cmd.join(" ")} failed (${out.code})`);
};

/** The Storage API and the deploy API both return the odd 5xx; try three times, a few seconds apart. */
const retry = async <T>(what: string, fn: () => Promise<T>): Promise<T> => {
  let last: unknown;
  for (let i = 1; i <= 3; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      console.warn(`  ${what}: attempt ${i} failed (${String((e as Error).message ?? e).slice(0, 120)})`);
      await new Promise((r) => setTimeout(r, 4000 * i));
    }
  }
  throw last;
};

console.log(`→ building with views at ${assetsUrl}`);
await run(["deno", "run", "--env-file=../.env", "-A", "npm:mcp-use@2.3.4", "build"], {
  cwd: path("server/"),
  env: { ...Deno.env.toObject(), NODE_ENV: "production", MCP_ASSETS_URL: assetsUrl },
});

const manifest = JSON.parse(await Deno.readTextFile(path("server/.mcp-use/build/manifest.json")));
const views = Object.values(manifest.views as Record<string, { kind: string; entry: string }>);
if (views.some((v) => v.kind !== "external"))
  throw new Error("expected external views; is MCP_ASSETS_URL set?");
// Object keys are the manifest URLs minus the bucket URL, e.g. functions/v1/chef/mcp/_mcp-use/views/vote/assets/x.js
const keyPrefix = views[0].entry.slice(assetsUrl.length + 1).split("/views/")[0];

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
if (listErr) throw listErr;
if (!buckets.some((b) => b.name === BUCKET)) {
  console.log(`→ creating public bucket ${BUCKET}`);
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (error) throw error;
}

const viewsDir = path("server/.mcp-use/build/views/");
const types: Record<string, string> = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".map": "application/json",
};
let uploaded = 0;
for await (const view of Deno.readDir(viewsDir)) {
  if (!view.isDirectory) continue;
  const assets = `${viewsDir}${view.name}/assets/`;
  for await (const f of Deno.readDir(assets)) {
    if (!f.isFile) continue;
    const ext = f.name.slice(f.name.lastIndexOf("."));
    const key = `${keyPrefix}/views/${view.name}/assets/${f.name}`;
    const body = await Deno.readFile(`${assets}${f.name}`);
    await retry(`upload ${f.name}`, async () => {
      const { error } = await supabase.storage.from(BUCKET).upload(key, body, {
        contentType: types[ext] ?? "application/octet-stream",
        cacheControl: "31536000", // hashed names never change
        upsert: true,
      });
      if (error) throw new Error(error.message);
    });
    uploaded++;
  }
}
console.log(`→ uploaded ${uploaded} view assets to ${BUCKET}/${keyPrefix}/views/`);

// Stage the server and the edge shim in a scratch dir outside the workspace (deno bundle refuses a
// config file that is not a workspace member) and bundle them into one module. The platform boots a
// fresh worker for every request, and loading mcp-use's hundred-package graph costs ~1.2 s of that
// boot; one file costs ~0.1 s (docs/performance.md §5, ADR 0006).
const fn = path("supabase/functions/chef/");
const stage = await Deno.makeTempDir({ prefix: "chef-fn-" });
await Deno.copyFile(path("server/.mcp-use/build/index.js"), `${stage}/server.js`);
// edge.ts and what it imports; keep this list in step with server/edge.ts
for (const f of ["edge.ts", "config.ts", "timing.ts"])
  await Deno.copyFile(path(`server/${f}`), `${stage}/${f}`);
await Deno.copyFile(`${fn}deno.json`, `${stage}/deno.json`);
await Deno.writeTextFile(
  `${stage}/entry.ts`,
  [
    'import { createEdgeHandler } from "./edge.ts";',
    'import server from "./server.js";',
    "Deno.serve(createEdgeHandler((req) => server.fetch(req)));",
    "",
  ].join("\n"),
);
await run(
  [
    "deno",
    "bundle",
    "--platform",
    "deno",
    "--minify",
    // Left to the platform's npm loader: tslib's CommonJS shape breaks under the bundler's interop,
    // and @mcp-use/client is an optional import mcp-use never takes on the server.
    "--external",
    "tslib",
    "--external",
    "@mcp-use/client",
    "-o",
    `${fn}bundle.js`,
    "entry.ts",
  ],
  { cwd: stage },
);
await Deno.remove(stage, { recursive: true });
const size = (await Deno.stat(`${fn}bundle.js`)).size;
console.log(`→ bundled chef into one module (${(size / 1024).toFixed(0)} KB); deploying to ${ref}`);
await retry("functions deploy", () =>
  run(["supabase", "functions", "deploy", "chef", "--project-ref", ref, "--no-verify-jwt"], {
    cwd: root.pathname,
  }),
);
console.log("✓ deployed; benching (docs/performance.md)");
await run(["deno", "run", "-A", "--env-file=.env", "scripts/bench.ts", "--runs", "3"], {
  cwd: root.pathname,
});
