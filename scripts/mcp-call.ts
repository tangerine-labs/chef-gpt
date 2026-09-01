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
const local = has("--local");
const verbose = has("-v");
const url = flag("--url") ?? `${Deno.env.get("SUPABASE_URL")}/functions/v1/chef/mcp`;
const [cmd, name, rawArgs] = args;

const META = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "mcp-call", version: "0" },
  "io.modelcontextprotocol/clientCapabilities": {
    extensions: { "io.modelcontextprotocol/ui": { mimeTypes: ["text/html;profile=mcp-app"] } },
  },
};

async function rpc(method: string, params: Record<string, unknown>) {
  const token = await testUserToken(user);
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: { ...params, _meta: META } });
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "mcp-protocol-version": "2026-07-28",
    "mcp-method": method,
    authorization: `Bearer ${token}`,
  };
  const n = (params.name ?? params.uri) as string | undefined;
  if (n) headers["mcp-name"] = n;
  const req = new Request(url, { method: "POST", headers, body });
  const res = local
    ? await (await import("../server/.mcp-use/build/index.js")).default.fetch(req)
    : await fetch(req);
  const text = await res.text();
  if (!res.ok) {
    console.error(`HTTP ${res.status}`, res.headers.get("www-authenticate") ?? "");
    console.error(text.slice(0, 500));
    Deno.exit(1);
  }
  const line = text.split("\n").find((l) => l.startsWith("data:"));
  return JSON.parse(line ? line.slice(5) : text);
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
