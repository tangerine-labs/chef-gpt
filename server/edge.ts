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
 */
import { MCP_PATH, PUBLIC_BASE, SITE_ORIGIN } from "./config.ts";

type Fetcher = (req: Request) => Promise<Response> | Response;

const ROOT_PRM = `/.well-known/oauth-protected-resource${MCP_PATH}`;
const PUBLIC_PRM = `${PUBLIC_BASE}/.well-known/oauth-protected-resource`;

export function publicPath(pathname: string): string {
  const p = pathname.startsWith("/functions/v1/") ? pathname.slice("/functions/v1".length) : pathname;
  return `/functions/v1${p}`;
}

export function createEdgeHandler(fetch: Fetcher): (req: Request) => Promise<Response> {
  return async (req) => {
    const incoming = new URL(req.url);
    const url = new URL(SITE_ORIGIN);
    url.pathname = publicPath(incoming.pathname);
    url.search = incoming.search;
    if (url.pathname === PUBLIC_PRM) url.pathname = ROOT_PRM;

    const forwarded = new Request(url, req);
    const res = await fetch(forwarded);

    // Always hand the runtime a plain Response with materialised headers.
    const headers = new Headers(res.headers);
    const challenge = headers.get("www-authenticate");
    if (res.status === 401 && challenge?.includes("resource_metadata=")) {
      headers.set(
        "www-authenticate",
        challenge.replace(/resource_metadata="[^"]*"/, `resource_metadata="${url.origin}${PUBLIC_PRM}"`),
      );
    }
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  };
}
