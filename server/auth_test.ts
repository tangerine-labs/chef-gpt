import { assertEquals, assertRejects } from "@std/assert";
import { chefOAuth } from "./auth.ts";
import { dbTestsEnabled, testUserToken } from "./test-users.ts";

// Without .env (CI) the DB-backed cases skip; the URL only needs to parse.
const url = Deno.env.get("SUPABASE_URL") ?? "https://abcdefgh.supabase.co";
const resource = new URL(`${url}/functions/v1/chef/mcp`);
const jwksUrl = `${url}/auth/v1/.well-known/jwks.json`;

/** Run `fn` with fetch replaced; returns how many times it was called. */
async function withFetch(impl: typeof fetch, fn: () => Promise<void>): Promise<number> {
  const real = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = ((input, init) => {
    calls++;
    return impl(input, init);
  }) as typeof fetch;
  try {
    await fn();
  } finally {
    globalThis.fetch = real;
  }
  return calls;
}

Deno.test({
  name: "embedded JWKS verifies a real token with no network",
  ignore: !dbTestsEnabled,
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const token = await testUserToken("a");
    const jwks = await (await fetch(jwksUrl)).text();
    const verifier = chefOAuth({
      supabaseUrl: url,
      resource: resource.href,
      resourceName: "t",
      jwks,
    }).createTokenVerifier(resource);
    const calls = await withFetch(
      () => Promise.reject(new Error("network used")),
      async () => {
        const info = await verifier.verifyAccessToken(token);
        assertEquals(typeof info.expiresAt, "number");
      },
    );
    assertEquals(calls, 0);
  },
});

Deno.test({
  name: "unknown key id falls back to the remote JWKS once",
  ignore: !dbTestsEnabled,
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const token = await testUserToken("a");
    const real = await (await fetch(jwksUrl)).json();
    const stale = JSON.stringify({
      keys: real.keys.map((k: { kid: string }) => ({ ...k, kid: `old-${k.kid}` })),
    });
    const verifier = chefOAuth({
      supabaseUrl: url,
      resource: resource.href,
      resourceName: "t",
      jwks: stale,
    }).createTokenVerifier(resource);
    const calls = await withFetch(
      () => Promise.resolve(Response.json(real)),
      async () => {
        await verifier.verifyAccessToken(token);
        await verifier.verifyAccessToken(token); // the remote set is cached for the worker's life
      },
    );
    assertEquals(calls, 1);
  },
});

Deno.test("a bad token is still rejected", async () => {
  const verifier = chefOAuth({
    supabaseUrl: "https://abcdefgh.supabase.co",
    resource: "https://abcdefgh.supabase.co/functions/v1/chef/mcp",
    resourceName: "t",
    jwks: '{"keys":[{"kty":"EC","crv":"P-256","alg":"ES256","kid":"k","x":"koPfFcRdpwKzX5ezgSGeSU9jidOLneHy4jPUllw-9EE","y":"CW9Hmy-3SAIGWhRuMX9wd7l6bgMqGxnQ4FKFvu5adkk"}]}',
  }).createTokenVerifier(new URL("https://abcdefgh.supabase.co/functions/v1/chef/mcp"));
  await assertRejects(() => verifier.verifyAccessToken("not.a.jwt"));
});
