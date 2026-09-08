/**
 * Screenshot the website's household screens signed in as test user A, phone first, against a
 * local build of the site and the deployed dev server (the browser calls the tools over HTTP, so
 * the server's CORS has to be deployed; ADR 0007).
 *
 *   deno task snap:household                 week, vote, shopping → scratch/household-<screen>.png
 *   deno task snap:household --width 700     a wider viewport
 *
 * Read-only: nothing is changed in the test household. Builds the site, serves site/dist with the
 * Pages 404 fallback on a free port, injects the session into localStorage the way supabase-js
 * stores it, and shoots each screen once its tool has answered.
 */

import { chromium } from "npm:playwright-core@1";
import { createClient } from "@supabase/supabase-js";
import { testUserToken } from "../server/test-users.ts";

const args = [...Deno.args];
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const width = Number(flag("--width") ?? 390);
const dir = flag("--out") ?? Deno.env.get("SNAP_DIR") ?? "scratch";
const url = Deno.env.get("SUPABASE_URL");
const anon = Deno.env.get("SUPABASE_ANON_KEY");
if (!url || !anon) throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are needed (.env)");

const root = new URL("../", import.meta.url);
const build = await new Deno.Command("deno", {
  args: ["task", "build:site"],
  cwd: root.pathname,
  stdout: "null",
  stderr: "piped",
}).output();
if (!build.success) {
  console.error(new TextDecoder().decode(build.stderr));
  Deno.exit(1);
}
const dist = new URL("site/dist/", root);
const server = Deno.serve({ port: 0, onListen: () => {} }, async (req) => {
  let path = new URL(req.url).pathname.replace(/^\/chef-gpt\/?/, "") || "index.html";
  if (!/\.[a-z0-9]+$/i.test(path)) path = "index.html"; // any path serves the app (Pages 404.html)
  try {
    const file = await Deno.readFile(new URL(path, dist));
    const type = path.endsWith(".js")
      ? "text/javascript"
      : path.endsWith(".css")
        ? "text/css"
        : path.endsWith(".svg")
          ? "image/svg+xml"
          : path.endsWith(".png")
            ? "image/png"
            : "text/html";
    return new Response(file, { headers: { "content-type": type } });
  } catch {
    return new Response("not found", { status: 404 });
  }
});
const port = (server.addr as Deno.NetAddr).port;

// The session supabase-js would have stored after a sign-in: test user A's (testUserToken creates it).
await testUserToken("a");
const client = createClient(url, anon, { auth: { persistSession: false } });
const { data, error } = await client.auth.signInWithPassword({
  email: "test-a@chef-gpt.test",
  password: Deno.env.get("TEST_USER_PASSWORD") ?? "",
});
if (error || !data.session) throw error ?? new Error("no session");
const key = `sb-${new URL(url).host.split(".")[0]}-auth-token`;

Deno.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 2 });
await ctx.addInitScript(
  ([k, v]: string[]) => localStorage.setItem(k, v),
  [key, JSON.stringify(data.session)],
);
const page = await ctx.newPage();
const errors: string[] = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
for (const screen of ["week", "vote", "shopping"]) {
  await page.goto(`http://127.0.0.1:${port}/chef-gpt/household/${screen}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const out = `${dir}/household-${screen}${width === 390 ? "" : `-${width}`}.png`;
  await page.screenshot({ path: out, fullPage: true });
  console.log(out);
}
if (errors.length) console.error(`console errors:\n${errors.join("\n")}`);
await browser.close();
await server.shutdown();
