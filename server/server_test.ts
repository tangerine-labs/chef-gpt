import { assertEquals, assertMatch } from "@std/assert";

const ORIGIN = "https://abcdefgh.supabase.co";
Deno.env.set("SUPABASE_URL", ORIGIN);
Deno.env.set("SUPABASE_ANON_KEY", "sb_publishable_test");
// mcp-use only serves view-bound tools from a built entry, so tests run against the bundle (`deno task build`).
const { default: server } = await import("./.mcp-use/build/index.js");
const { createEdgeHandler } = await import("./edge.ts");
const handle = createEdgeHandler((req) => server.fetch(req));

const rpc = (method: string, params: Record<string, unknown> = {}, extra: HeadersInit = {}) =>
  new Request(`${ORIGIN}/chef/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2026-07-28",
      "mcp-method": method,
      ...extra,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });

Deno.test("unauthenticated MCP request gets a 401 whose resource_metadata lives under the function", async () => {
  const res = await handle(rpc("tools/list"));
  assertEquals(res.status, 401);
  const challenge = res.headers.get("www-authenticate") ?? "";
  assertMatch(challenge, /^Bearer /);
  assertEquals(
    challenge.match(/resource_metadata="([^"]*)"/)?.[1],
    `${ORIGIN}/functions/v1/chef/.well-known/oauth-protected-resource`,
  );
  await res.body?.cancel();
});

Deno.test("protected resource metadata is served under the function and names the Supabase issuer", async () => {
  const res = await handle(new Request(`${ORIGIN}/functions/v1/chef/.well-known/oauth-protected-resource`));
  assertEquals(res.status, 200);
  const doc = await res.json();
  assertEquals(doc.resource, `${ORIGIN}/functions/v1/chef/mcp`);
  assertEquals(doc.authorization_servers, [`${ORIGIN}/auth/v1`]);
});

Deno.test("paths work whether or not Supabase keeps the /functions/v1 prefix", async () => {
  for (const p of [
    "/chef/.well-known/oauth-protected-resource",
    "/functions/v1/chef/.well-known/oauth-protected-resource",
  ]) {
    const res = await handle(new Request(`${ORIGIN}${p}`));
    assertEquals(res.status, 200, p);
    assertEquals((await res.json()).resource, `${ORIGIN}/functions/v1/chef/mcp`);
  }
});

Deno.test("requests arriving over the internal http proxy are re-based on the public https origin", async () => {
  const res = await handle(
    new Request(
      `http://sinerswegkbhlpoudbtx.supabase.co/chef/mcp`.replace("sinerswegkbhlpoudbtx", "abcdefgh"),
      {
        method: "POST",
        headers: { "content-type": "application/json", "mcp-method": "tools/list" },
        body: "{}",
      },
    ),
  );
  assertEquals(res.status, 401);
  assertMatch(res.headers.get("www-authenticate") ?? "", /resource_metadata="https:\/\//);
  await res.body?.cancel();
});

Deno.test("a bogus bearer token is rejected, not crashed on", async () => {
  const res = await handle(rpc("tools/list", {}, { authorization: "Bearer not-a-jwt" }));
  assertEquals(res.status, 401);
  await res.body?.cancel();
});
