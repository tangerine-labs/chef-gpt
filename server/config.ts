/**
 * Runtime configuration. Supabase Edge Functions inject SUPABASE_URL and
 * friends automatically; locally it comes from .env (see .env.example)
 * or default to `supabase start`'s local stack.
 */
const env = (key: string): string | undefined => {
  try {
    return Deno.env.get(key) ?? undefined;
  } catch {
    return (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.[key];
  }
};

/** Public path prefix under which Supabase exposes the `chef` function. */
export const PUBLIC_BASE = "/functions/v1/chef";
/** Where the MCP endpoint lives, relative to the origin. */
export const MCP_PATH = `${PUBLIC_BASE}/mcp`;

const LOCAL_SUPABASE = "http://127.0.0.1:54321";

export const SUPABASE_URL = (env("SUPABASE_URL") ?? LOCAL_SUPABASE).replace(/\/$/, "");

/** Absolute origin the browser uses to reach us: the Supabase project origin in the cloud. */
export const SITE_ORIGIN = (env("SITE_ORIGIN") ?? env("SUPABASE_URL") ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);
