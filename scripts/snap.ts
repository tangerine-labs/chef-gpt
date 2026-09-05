/**
 * Render a view-backed tool as the test user and save a PNG — the way to *see* an MCP App
 * without a chat host.
 *
 *   deno task snap show_shopping_list                 → scratch/snap-show_shopping_list.png
 *   deno task snap open_voting '{"roundId":"…"}' --out /tmp/vote.png --dark --width 480
 *
 * Flags: --user a|b · --url <mcp url> · --out <png> (default $SNAP_DIR/snap-<tool>.png, SNAP_DIR=scratch)
 *        --width <px> · --dark
 * Wraps `mcp-use screenshot` (needs @mcp-use/client, in deno.json) with a minted token.
 */
import { testUserToken } from "../server/test-users.ts";

const args = [...Deno.args];
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const has = (name: string): boolean => {
  const i = args.indexOf(name);
  if (i < 0) return false;
  args.splice(i, 1);
  return true;
};

const user = (flag("--user") ?? "a") as "a" | "b";
const url = flag("--url") ?? `${Deno.env.get("SUPABASE_URL")}/functions/v1/chef/mcp`;
const width = flag("--width") ?? "600";
const dark = has("--dark");
const [tool, json] = args;
if (!tool) throw new Error("usage: snap <tool> ['{json args}'] [--out png] [--width px] [--dark]");
// mcp-use runs with cwd=server/, so resolve the path here (relative to where the task was run).
const outArg = flag("--out") ?? `${Deno.env.get("SNAP_DIR") ?? "scratch"}/snap-${tool}.png`;
const out = outArg.startsWith("/") ? outArg : `${Deno.cwd()}/${outArg}`;
Deno.mkdirSync(out.replace(/[^/]*$/, ""), { recursive: true });

const token = await testUserToken(user);
const cmd = new Deno.Command("deno", {
  args: [
    "run",
    "-A",
    "npm:mcp-use@2.3.4",
    "screenshot",
    "--mcp",
    url,
    "-H",
    `Authorization: Bearer ${token}`,
    "--tool",
    tool,
    "--output",
    out,
    "--width",
    width,
    "--theme",
    dark ? "dark" : "light",
    "--json",
    ...(json ? [json] : []),
  ],
  cwd: new URL("../server/", import.meta.url).pathname,
  stdout: "piped",
  stderr: "piped",
});
const res = await cmd.output();
const text = new TextDecoder().decode(res.stdout) + new TextDecoder().decode(res.stderr);
const line = text.split("\n").find((l) => l.startsWith("{"));
console.log(line ?? text.slice(-600));
Deno.exit(res.success ? 0 : 1);
