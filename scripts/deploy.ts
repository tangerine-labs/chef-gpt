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
 * 3. Stages server.js, edge.ts and config.ts into supabase/functions/chef and deploys.
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
    const { error } = await supabase.storage.from(BUCKET).upload(key, body, {
      contentType: types[ext] ?? "application/octet-stream",
      cacheControl: "31536000", // hashed names never change
      upsert: true,
    });
    if (error) throw new Error(`upload ${key}: ${error.message}`);
    uploaded++;
  }
}
console.log(`→ uploaded ${uploaded} view assets to ${BUCKET}/${keyPrefix}/views/`);

const fn = path("supabase/functions/chef/");
await Deno.copyFile(path("server/.mcp-use/build/index.js"), `${fn}server.js`);
await Deno.copyFile(path("server/edge.ts"), `${fn}edge.ts`);
await Deno.copyFile(path("server/config.ts"), `${fn}config.ts`);
const size = (await Deno.stat(`${fn}server.js`)).size;
console.log(`→ staged server.js (${(size / 1024).toFixed(0)} KB); deploying chef to ${ref}`);
await run(["supabase", "functions", "deploy", "chef", "--project-ref", ref, "--no-verify-jwt"], {
  cwd: root.pathname,
});
console.log(`✓ deployed. Probe: deno task mcp list · deno task snap vote`);
