import { assertEquals, assertMatch } from "@std/assert";

// Use the real dev project when .env is present (tools_test.ts needs it); otherwise a fake origin
// is enough for these HTTP-level checks. Test files share one process, so never clobber real env.
const ORIGIN = Deno.env.get("SUPABASE_URL") ?? "https://abcdefgh.supabase.co";
if (!Deno.env.get("SUPABASE_URL")) Deno.env.set("SUPABASE_URL", ORIGIN);
if (!Deno.env.get("SUPABASE_ANON_KEY")) Deno.env.set("SUPABASE_ANON_KEY", "sb_publishable_test");
// mcp-use only serves view-bound tools from a built entry, so tests run against the bundle (`deno task build`).
const { default: server } = await import("./.mcp-use/build/index.js");
const { createEdgeHandler } = await import("./edge.ts");
const handle = createEdgeHandler((req) => server.fetch(req));

// With .env present the request log writes each sample through supabase-js, which keeps fetch and
// timer handles open past the test (CLAUDE.md, Database), so these run unsanitized like the DB tests.
const test = (name: string, fn: () => Promise<void>) =>
  Deno.test({ name, fn, sanitizeOps: false, sanitizeResources: false });

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

test("unauthenticated MCP request gets a 401 whose resource_metadata lives under the function", async () => {
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

test("protected resource metadata is served under the function and names the Supabase issuer", async () => {
  const res = await handle(new Request(`${ORIGIN}/functions/v1/chef/.well-known/oauth-protected-resource`));
  assertEquals(res.status, 200);
  const doc = await res.json();
  assertEquals(doc.resource, `${ORIGIN}/functions/v1/chef/mcp`);
  assertEquals(doc.authorization_servers, [`${ORIGIN}/auth/v1`]);
});

test("paths work whether or not Supabase keeps the /functions/v1 prefix", async () => {
  for (const p of [
    "/chef/.well-known/oauth-protected-resource",
    "/functions/v1/chef/.well-known/oauth-protected-resource",
  ]) {
    const res = await handle(new Request(`${ORIGIN}${p}`));
    assertEquals(res.status, 200, p);
    assertEquals((await res.json()).resource, `${ORIGIN}/functions/v1/chef/mcp`);
  }
});

test("requests arriving over the internal http proxy are re-based on the public https origin", async () => {
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

test("a bogus bearer token is rejected, not crashed on", async () => {
  const res = await handle(rpc("tools/list", {}, { authorization: "Bearer not-a-jwt" }));
  assertEquals(res.status, 401);
  await res.body?.cancel();
});

// The website's household screens call the tools from the browser (ADR 0007), so its origin, and
// only its origin, gets CORS: the preflight must pass without a token, and a 401 must be readable.
const SITE = new URL(Deno.env.get("SITE_URL") ?? "https://tangerine-labs.com/chef-gpt").origin;

test("a browser on the site may call the MCP endpoint: the preflight passes and a 401 is readable", async () => {
  const pre = await handle(
    new Request(`${ORIGIN}/chef/mcp`, {
      method: "OPTIONS",
      headers: {
        origin: SITE,
        "access-control-request-method": "POST",
        "access-control-request-headers": "authorization,content-type,mcp-method",
      },
    }),
  );
  assertEquals(pre.headers.get("access-control-allow-origin"), SITE);
  assertMatch(pre.headers.get("access-control-allow-headers") ?? "", /authorization/i);
  assertEquals(pre.status < 400, true, `preflight answered ${pre.status}`);
  await pre.body?.cancel();

  const res = await handle(rpc("tools/list", {}, { origin: SITE }));
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("access-control-allow-origin"), SITE);
  await res.body?.cancel();
});

test("another origin gets no CORS headers", async () => {
  const res = await handle(rpc("tools/list", {}, { origin: "https://evil.example" }));
  assertEquals(res.headers.get("access-control-allow-origin"), null);
  await res.body?.cancel();
});
