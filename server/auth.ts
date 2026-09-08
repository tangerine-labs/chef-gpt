/**
 * Token verification without a network round trip (docs/performance.md, 2026-09-08 entry).
 *
 * mcp-use's Supabase provider verifies every ES256 bearer against the project's JWKS URL. Each
 * request here runs in a fresh worker, so that was a TLS handshake and a fetch per tool call,
 * about 150 ms before any query. The signing keys change rarely: `deno task deploy` stores the
 * project's JWKS in the `CHEF_JWKS` secret, the verifier tries those keys first, and the remote
 * set stays as the fallback for a key id it does not know (a rotation between deploys). Without
 * the secret the provider is mcp-use's own, unchanged.
 */
import {
  createLocalJWKSet,
  createRemoteJWKSet,
  errors,
  type JSONWebKeySet,
  type JWTVerifyGetKey,
} from "jose";
import { createJwtVerifier, type OAuthProvider } from "mcp-use/oauth";
import { oauthSupabaseProvider, type SupabaseOAuthUser } from "mcp-use/oauth/supabase";

export type ChefOAuthOptions = {
  supabaseUrl: string;
  resource: string;
  resourceName: string;
  /** The project's `auth/v1/.well-known/jwks.json` as text; absent means verify remotely. */
  jwks?: string;
};

export function chefOAuth(opts: ChefOAuthOptions): OAuthProvider<SupabaseOAuthUser> {
  const base = oauthSupabaseProvider({
    supabaseUrl: opts.supabaseUrl,
    resource: opts.resource,
    resourceName: opts.resourceName,
  });
  const keys = parseJwks(opts.jwks);
  if (!keys) return base;
  const supabaseUrl = opts.supabaseUrl.replace(/\/$/, "");
  const jwksUrl = new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`);
  const key = localFirst(keys, jwksUrl);
  return {
    ...base,
    createTokenVerifier: (resource) =>
      createJwtVerifier({
        issuer: `${supabaseUrl}/auth/v1`,
        jwksUrl,
        resource,
        audience: "authenticated",
        algorithms: ["ES256"],
        // Typed as symmetric key bytes; at runtime it is handed straight to jose's jwtVerify,
        // which takes a key getter too.
        key: key as unknown as Uint8Array,
      }),
  };
}

/** A jose key getter: the embedded keys, then the remote set for a key id they lack. */
export function localFirst(keys: JSONWebKeySet, jwksUrl: URL): JWTVerifyGetKey {
  const local = createLocalJWKSet(keys);
  let remote: JWTVerifyGetKey | undefined;
  return async (header, token) => {
    try {
      return await local(header, token);
    } catch (e) {
      if (!(e instanceof errors.JWKSNoMatchingKey)) throw e;
      remote ??= createRemoteJWKSet(jwksUrl);
      return remote(header, token);
    }
  };
}

function parseJwks(text: string | undefined): JSONWebKeySet | undefined {
  if (!text) return undefined;
  try {
    const doc = JSON.parse(text);
    if (Array.isArray(doc?.keys) && doc.keys.length > 0) return doc as JSONWebKeySet;
  } catch {
    // fall through
  }
  console.warn("CHEF_JWKS is not a JWK set; verifying tokens remotely");
  return undefined;
}
