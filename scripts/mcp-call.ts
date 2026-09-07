/**
 * Poke the chef MCP server as a signed-in user.
 *
 *   deno task mcp list                                  tools/list (names only; -v for schemas)
 *   deno task mcp call whoami
 *   deno task mcp call search_recipes '{"query":"tofu","limit":3}'
 *   deno task mcp read ui://views/vote.html             resources/read
 *
 * Flags: --user a|b (test user, default a) · --url <mcp url> (default $SUPABASE_URL/functions/v1/chef/mcp)
 *        --local (in-process against server/.mcp-use/build — run `deno task build` first) · -v (full JSON)
 *
 * Auth: mints a real token for test-a/b@chef-gpt.test via the service role (.env).
 */
import { mcpClient } from "./mcp-client.ts";

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
const local = has("--local");
const verbose = has("-v");
const url = flag("--url") ?? `${Deno.env.get("SUPABASE_URL")}/functions/v1/chef/mcp`;
const [cmd, name, rawArgs] = args;

const client = await mcpClient({ url, user, local });
async function rpc(method: string, params: Record<string, unknown>) {
  try {
    const { msg, ms, timing } = await client.call(method, params);
    if (verbose) console.error(`${ms.toFixed(0)} ms · ${timing}`);
    return msg;
  } catch (e) {
    console.error(String((e as Error).message ?? e));
    Deno.exit(1);
  }
}

switch (cmd) {
  case "list": {
    const msg = await rpc("tools/list", {});
    const tools = msg.result?.tools ?? [];
    if (verbose) console.log(JSON.stringify(tools, null, 2));
    else for (const t of tools) console.log(`${t.name}${t._meta?.ui ? "  [view]" : ""}`);
    console.log(`\n${tools.length} tools`);
    break;
  }
  case "call": {
    if (!name) throw new Error("usage: mcp call <tool> ['{json args}']");
    const msg = await rpc("tools/call", { name, arguments: rawArgs ? JSON.parse(rawArgs) : {} });
    const r = msg.result ?? msg.error;
    if (verbose) console.log(JSON.stringify(r, null, 2));
    else {
      for (const c of r.content ?? []) console.log(c.text);
      if (r.isError) console.log("(isError)");
      else if (r.structuredContent)
        console.log("\nstructured:", JSON.stringify(r.structuredContent).slice(0, 400));
    }
    break;
  }
  case "read": {
    if (!name) throw new Error("usage: mcp read <uri>");
    const msg = await rpc("resources/read", { uri: name });
    const c = msg.result?.contents?.[0];
    console.log(c ? `${c.mimeType}, ${c.text?.length ?? 0} chars` : JSON.stringify(msg));
    break;
  }
  default:
    console.log("usage: deno task mcp <list|call|read> … (see scripts/mcp-call.ts header)");
}
Deno.exit(0);
