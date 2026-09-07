/**
 * Adapts the mcp-use server to Supabase Edge Functions.
 *
 * Supabase exposes the function at https://<ref>.supabase.co/functions/v1/chef/... and hands
 * the function a request whose path may or may not still carry /functions/v1. We normalise
 * every incoming path to the public form (/functions/v1/chef/...) so mcp-use's basePath,
 * auth routes and generated URLs all match what the browser sees.
 *
 * mcp-use also puts the protected-resource-metadata document at the origin root
 * (/.well-known/oauth-protected-resource/functions/v1/chef/mcp), which Supabase cannot serve.
 * We expose it at {PUBLIC_BASE}/.well-known/oauth-protected-resource instead and rewrite the
 * 401 challenge's resource_metadata URL to point there (RFC 9728 allows any URL).
 *
 * Supabase's internal proxy also presents the request as plain http://; we re-base every
 * forwarded URL on SITE_ORIGIN so generated URLs, cookies and challenges use the public https origin.
 *
 * Every response carries a Server-Timing header (boot age, handle time, database time) and the
 * function logs one JSON line per request; see docs/performance.md.
 */
import { MCP_PATH, PUBLIC_BASE, SITE_ORIGIN } from "./config.ts";
import { recordRequest } from "./request-log.ts";
import { type RequestTiming, serverTiming, timing, WORKER } from "./timing.ts";

type Fetcher = (req: Request) => Promise<Response> | Response;

const ROOT_PRM = `/.well-known/oauth-protected-resource${MCP_PATH}`;
const PUBLIC_PRM = `${PUBLIC_BASE}/.well-known/oauth-protected-resource`;

export function publicPath(pathname: string): string {
  const p = pathname.startsWith("/functions/v1/") ? pathname.slice("/functions/v1".length) : pathname;
  return `/functions/v1${p}`;
}

export function createEdgeHandler(fetch: Fetcher): (req: Request) => Promise<Response> {
  return (req) => {
    const t: RequestTiming = { start: performance.now(), db: 0, dbCalls: 0 };
    const arrived = new Date();
    return timing.run(t, async () => {
      const incoming = new URL(req.url);
      const url = new URL(SITE_ORIGIN);
      url.pathname = publicPath(incoming.pathname);
      url.search = incoming.search;
      if (url.pathname === PUBLIC_PRM) url.pathname = ROOT_PRM;

      const forwarded = new Request(url, req);
      const res = await fetch(forwarded);
      const handleMs = performance.now() - t.start;

      // Always hand the runtime a plain Response with materialised headers.
      const headers = new Headers(res.headers);
      const challenge = headers.get("www-authenticate");
      if (res.status === 401 && challenge?.includes("resource_metadata=")) {
        headers.set(
          "www-authenticate",
          challenge.replace(/resource_metadata="[^"]*"/, `resource_metadata="${url.origin}${PUBLIC_PRM}"`),
        );
      }
      headers.set("server-timing", serverTiming(t, handleMs));
      console.log(
        JSON.stringify({
          perf: 1,
          worker: WORKER,
          path: url.pathname,
          method: req.headers.get("mcp-method") ?? req.method,
          name: req.headers.get("mcp-name") ?? undefined,
          status: res.status,
          ms: Math.round(handleMs),
          db: Math.round(t.db),
          dbCalls: t.dbCalls,
        }),
      );
      if (url.pathname === MCP_PATH)
        recordRequest({
          at: arrived,
          method: req.headers.get("mcp-method") ?? req.method,
          name: req.headers.get("mcp-name") ?? undefined,
          path: url.pathname,
          status: res.status,
          ms: handleMs,
          db: t.db,
          dbCalls: t.dbCalls,
          worker: WORKER,
          host: req.headers.get("user-agent")?.slice(0, 60) ?? null,
        });
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
    });
  };
}
